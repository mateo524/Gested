import express from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import { Parser } from "json2csv";
import DownloadLog from "../models/DownloadLog.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import Metric from "../models/Metric.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import School from "../models/School.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Competency from "../models/Competency.js";
import Role from "../models/Role.js";
import EvaluationScore from "../models/EvaluationScore.js";
import DatabaseFile from "../models/DatabaseFile.js";
import Announcement from "../models/Announcement.js";
import CompanySetting from "../models/CompanySetting.js";
import ImportJob from "../models/ImportJob.js";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { buildEmployeeScopedFilter } from "../utils/accessControl.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { uploadBufferToStorage } from "../utils/storageProvider.js";
import {
  IMPORT_CONFIDENCE_THRESHOLD,
  parseWorkbookRows,
  detectBestSheet,
  extractRowsFromSheet,
  buildColumnDetections,
  classifyDatasetByDetections,
  mapRowsByDetections,
  validateRowsForDataset,
  sanitizeHeader,
  normalizeText,
} from "../utils/importIntelligence.js";
import { isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const importPreviewStore = new Map();
const MAX_PREVIEW_ROWS = 3000;

const allowedDatasets = {
  employees: {
    model: Employee,
    fields: ["apellido", "nombre", "email", "cargo", "area", "tipoEmpleado", "activo"],
    filename: "empleados",
  },
  evaluations: {
    model: Evaluation,
    fields: ["tipo", "estado", "resultadoFinal", "acuerdoEmpleado", "createdAt"],
    filename: "evaluaciones",
  },
  metrics: {
    model: Metric,
    fields: ["nombre", "descripcion", "ponderacion", "cargoAplica", "activa"],
    filename: "metricas",
  },
  developmentPlans: {
    model: DevelopmentPlan,
    fields: ["aspectoDesarrollar", "medicion", "estado", "fechaSeguimiento"],
    filename: "planes-desarrollo",
  },
};

function buildBaseFilter(req) {
  const filter = {};

  if (!req.user.isSuperAdmin) {
    filter.companyId = req.user.companyId;
    if (req.user.schoolId) {
      filter.schoolId = req.user.schoolId;
    }
  } else {
    if (req.query.companyId) filter.companyId = req.query.companyId;
    if (req.query.schoolId) filter.schoolId = req.query.schoolId;
  }

  return filter;
}

async function validateImportSchool(companyId, schoolId) {
  if (!schoolId) return true;
  const school = await School.findOne({ _id: schoolId, companyId, activa: true }).select("_id").lean();
  return Boolean(school);
}

async function buildScopedFilter(req, dataset) {
  const filter = buildBaseFilter(req);
  const scopeContext = {
    companyId: req.user.companyId,
    schoolId: req.user.schoolId || null,
    employeeId: req.user.employeeId || null,
    roleKey: req.user.roleKey || null,
    roleCode: req.user.roleCode || null,
    roleScope: req.user.roleScope || req.user.scope || null,
    departmentCode: req.user.departmentCode || "",
    isSuperAdmin: req.user.isSuperAdmin || false,
  };

  if (req.query.schoolId && !req.user.isSuperAdmin) {
    filter.schoolId = req.user.schoolId;
  }

  if (dataset === "employees") {
    if (req.query.area) filter.area = req.query.area;
    if (req.query.cargo) filter.cargo = req.query.cargo;

    if (isManagerScope(scopeContext)) {
      if (scopeContext.roleScope === "DEPARTMENT" && scopeContext.departmentCode) {
        filter.area = scopeContext.departmentCode;
      } else if (scopeContext.employeeId) {
        filter.managerId = scopeContext.employeeId;
      }
    }
  }

  if (dataset === "evaluations") {
    if (req.query.estado) filter.estado = req.query.estado;
    if (req.query.tipo) filter.tipo = req.query.tipo;
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    return buildEmployeeScopedFilter(
      {
        ...req,
        scope: scopeContext,
      },
      {
        extra: filter,
        employeeField: "employeeId",
        outOfScopeMessage: "No puedes descargar evaluaciones de empleados fuera de tu alcance",
      }
    );
  }

  if (dataset === "metrics" && req.query.competencyId) {
    filter.competencyId = req.query.competencyId;
  }

  if (dataset === "developmentPlans") {
    if (req.query.estado) filter.estado = req.query.estado;
    return buildEmployeeScopedFilter(
      {
        ...req,
        scope: scopeContext,
      },
      {
        extra: filter,
        employeeField: "employeeId",
        outOfScopeMessage: "No puedes descargar planes de empleados fuera de tu alcance",
      }
    );
  }

  return filter;
}

function canDownloadDataset(req, dataset) {
  const permissions = req.user?.permisos || [];
  const scopeContext = {
    roleKey: req.user?.roleKey || null,
    roleCode: req.user?.roleCode || null,
    roleScope: req.user?.roleScope || req.user?.scope || null,
  };

  if (req.user.isSuperAdmin) return true;
  if (permissions.includes(PERMISSIONS.DOWNLOAD_REPORTS)) return true;
  if (isManagerScope(scopeContext) && permissions.includes(PERMISSIONS.DOWNLOAD_TEAM_REPORTS)) {
    return dataset === "employees" || dataset === "evaluations" || dataset === "developmentPlans";
  }
  if (isEmployeeScope(scopeContext) && permissions.includes(PERMISSIONS.DOWNLOAD_SELF_REPORT)) {
    return dataset === "evaluations" || dataset === "developmentPlans";
  }

  return false;
}

function getDownloadPolicy(req) {
  const datasets = Object.keys(allowedDatasets);
  const scopeContext = {
    roleKey: req.user?.roleKey || null,
    roleCode: req.user?.roleCode || null,
    roleScope: req.user?.roleScope || req.user?.scope || null,
  };
  return datasets.map((dataset) => {
    let scope = "global";
    if (!req.user.isSuperAdmin) {
      if (isManagerScope(scopeContext)) scope = scopeContext.roleScope === "DEPARTMENT" ? "departamento" : "equipo";
      else if (isEmployeeScope(scopeContext)) scope = "propio";
      else scope = "colegio";
    }

    const canDownload = canDownloadDataset(req, dataset);
    let reason = "Permitido";
    if (!canDownload) {
      reason = "Tu rol no tiene permiso para descargar este dataset";
    } else if (scope === "equipo") {
      reason = "Descarga limitada a tu equipo a cargo";
    } else if (scope === "departamento") {
      reason = "Descarga limitada a tu departamento asignado";
    } else if (scope === "propio") {
      reason = "Descarga limitada a tu información personal";
    } else if (scope === "colegio") {
      reason = "Descarga limitada al colegio activo";
    }

    return {
      dataset,
      label: allowedDatasets[dataset].filename,
      canDownload,
      scope,
      reason,
    };
  });
}

async function registerDownload(req, dataset, filters) {
  await DownloadLog.create({
    userId: req.user.userId,
    role: req.user.roleCode || req.user.roleName || "UNKNOWN",
    companyId: req.user.companyId,
    schoolId: req.user.schoolId || null,
    exportType: dataset,
    filters,
    downloadedAt: new Date(),
  });
}

function normalizeNarrativeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const fieldAliases = {
  nombre: ["nombre", "name", "firstname", "first_name"],
  apellido: ["apellido", "lastname", "last_name", "surname"],
  email: ["email", "correo", "mail", "correoelectronico"],
  cargo: ["cargo", "puesto", "roletitle", "rolcargo"],
  area: ["area", "departamento", "sector"],
  tipoempleado: ["tipoempleado", "tipo", "perfil"],
  activo: ["activo", "active", "habilitado"],
  competencia: ["competencia", "competency"],
  metrica: ["metrica", "metrica", "nombre", "metric"],
  descripcion: ["descripcion", "description"],
  ponderacion: ["ponderacion", "weight", "peso"],
  ciclo: ["ciclo", "nombreciclo", "evaluationcycle"],
  periodo: ["periodo", "mes", "period"],
  etapa: ["etapa", "stage"],
  estado: ["estado", "status"],
  fechainicio: ["fechainicio", "inicio", "startdate"],
  fechafin: ["fechafin", "fin", "enddate"],
  rol: ["rol", "role", "nombrerol"],
  jefe: ["jefe", "manager", "responsable", "supervisor", "lider"],
  sede: ["sede", "colegio", "escuela", "campus"],
  employeeid: ["employeeid", "idempleado", "idempleadolegajo", "idcolaborador"],
  legajo: ["legajo", "nrolegajo", "numerolegajo", "employeecode"],
};

const criticalFieldsByDataset = {
  employees: ["apellido", "nombre", "cargo", "email", "legajo"],
  metrics: ["competencia", "metrica"],
  cycles: ["periodo", "fechainicio", "fechafin"],
  roles: ["rol"],
};

function parseManualMapping(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function getLearnedMapping(companyId, dataset) {
  if (!dataset || dataset === "auto") return {};
  const settings = await CompanySetting.findOne({ companyId }).lean();
  const profile = settings?.importProfiles?.[dataset];
  return profile?.columnMapping && typeof profile.columnMapping === "object"
    ? profile.columnMapping
    : {};
}

function getRowValues(row) {
  return Object.entries(row)
    .filter(([key]) => key !== "_rowNumber")
    .map(([, value]) => value)
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function parseNameParts(fullName) {
  const clean = String(fullName || "").trim();
  if (!clean) return { nombre: "", apellido: "" };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { nombre: parts[0], apellido: "-" };
  return {
    nombre: parts.slice(0, -1).join(" "),
    apellido: parts.at(-1),
  };
}

function extractNarrativeData(rows) {
  const result = {
    fullName: "",
    cargo: "",
    area: "",
    competencias: [],
    promedioFinal: 0,
  };

  const knownCompetencies = [
    "trabajo en equipo",
    "comunicacion efectiva",
    "orientacion al logro",
    "adaptacion y gestion del cambio",
    "iniciativa y orientacion al servicio",
    "liderazgo pedagogico",
    "liderazgo",
    "toma de decisiones",
    "formacion de formadores",
  ];

  const extracted = [];
  for (const row of rows) {
    const values = getRowValues(row);
    const textValues = values
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (!textValues.length) continue;

    const allLower = normalizeNarrativeText(textValues.join(" | "));

    if (!result.fullName && allLower.includes("nombre")) {
      const labelWithValue = textValues.find((value) =>
        normalizeNarrativeText(value).startsWith("nombre:")
      );
      if (labelWithValue) {
        const clean = labelWithValue.split(":").slice(1).join(":").trim();
        if (clean) result.fullName = clean;
      } else {
        const labelIndex = textValues.findIndex(
          (value) => normalizeNarrativeText(value) === "nombre:"
            || normalizeNarrativeText(value) === "nombre"
        );
        if (labelIndex >= 0) {
          const nextValue = String(textValues[labelIndex + 1] || "").trim();
          if (nextValue) result.fullName = nextValue;
        }
      }
    }

    if (!result.cargo && allLower.includes("cargo") && !allLower.includes("jefatura")) {
      const labelWithValue = textValues.find((value) =>
        normalizeNarrativeText(value).startsWith("cargo:")
      );
      if (labelWithValue) {
        const clean = labelWithValue.split(":").slice(1).join(":").trim();
        if (clean) result.cargo = clean;
      } else {
        const labelIndex = textValues.findIndex(
          (value) => normalizeNarrativeText(value) === "cargo:"
            || normalizeNarrativeText(value) === "cargo"
        );
        if (labelIndex >= 0) {
          const nextValue = String(textValues[labelIndex + 1] || "").trim();
          if (nextValue) result.cargo = nextValue;
        }
      }
    }

    if (!result.area && allLower.includes("area / ciclo")) {
      const areaCandidate = textValues.at(-1);
      if (areaCandidate && !normalizeNarrativeText(areaCandidate).includes("area / ciclo")) {
        result.area = areaCandidate;
      }
    }

    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);

    for (const known of knownCompetencies) {
      if (allLower.includes(normalizeNarrativeText(known)) && numericValues.length) {
        extracted.push({ competencia: known, nivel: numericValues[0] });
      }
    }
  }

  const grouped = new Map();
  extracted.forEach((item) => {
    const key = item.competencia;
    const current = grouped.get(key) || { total: 0, count: 0 };
    current.total += item.nivel;
    current.count += 1;
    grouped.set(key, current);
  });

  result.competencias = [...grouped.entries()].map(([competencia, data]) => ({
    competencia,
    nivel: Math.round((data.total / data.count) * 100) / 100,
  }));

  if (result.competencias.length) {
    const total = result.competencias.reduce((acc, item) => acc + item.nivel, 0);
    result.promedioFinal = Math.round((total / result.competencias.length) * 100) / 100;
  }

  return result;
}

async function parseUploadedRows(file) {
  const { workbook } = await parseWorkbookRows(file, MAX_PREVIEW_ROWS);
  const { best, candidates } = detectBestSheet(workbook, fieldAliases);
  const worksheet = best?.worksheet;
  if (!worksheet) {
    return {
      rows: [],
      truncated: false,
      sheetName: "",
      headerRowNumber: 1,
      headers: [],
      worksheetsMeta: [],
      droppedEmptyRows: 0,
    };
  }
  const extracted = extractRowsFromSheet(worksheet, best.headerRowNumber, MAX_PREVIEW_ROWS);
  return {
    rows: extracted.rows,
    truncated: extracted.truncated,
    sheetName: worksheet.name,
    headerRowNumber: best.headerRowNumber,
    headers: extracted.headers,
    worksheetsMeta: candidates,
    droppedEmptyRows: extracted.droppedEmptyRows,
  };
}

function validateCorrectedRow(dataset, row) {
  if (dataset === "employees") {
    const apellido = String(row.apellido || "").trim();
    const nombre = String(row.nombre || "").trim();
    const cargo = String(row.cargo || "").trim();
    const email = String(row.email || "").trim().toLowerCase();
    const legajo = String(row.legajo || row.employeeId || "").trim();
    const roleRaw = String(row.roleCode || row.rol || "").trim();
    if (!apellido || !nombre || !cargo) {
      return { ok: false, message: "Faltan apellido, nombre o cargo" };
    }
    if (!email && !legajo) {
      return { ok: false, message: "Falta email o legajo/employeeId" };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      return { ok: false, message: "Email invalido" };
    }
    if (sanitizeHeader(roleRaw).includes("superadmin")) {
      return { ok: false, message: "No se permite SUPER_ADMIN por importacion" };
    }
    return {
      ok: true,
      row: {
        apellido,
        nombre,
        email,
        cargo,
        area: String(row.area || "").trim(),
        tipoempleado: String(row.tipoempleado || "DOCENTE").trim().toUpperCase(),
        activo: String(row.activo || "true").trim().toLowerCase(),
        roleCode: roleRaw || "",
        managerRef: String(row.managerRef || row.jefe || "").trim(),
        sede: String(row.sede || "").trim(),
        legajo,
      },
    };
  }

  if (dataset === "metrics") {
    const competencia = String(row.competencia || "").trim();
    const nombre = String(row.nombre || "").trim();
    const ponderacion = Number(row.ponderacion || 1);
    if (!competencia || !nombre || !Number.isFinite(ponderacion) || ponderacion <= 0) {
      return { ok: false, message: "Fila invalida para metricas" };
    }
    return {
      ok: true,
      row: {
        competencia,
        nombre,
        descripcion: String(row.descripcion || "").trim(),
        ponderacion,
      },
    };
  }

  if (dataset === "cycles") {
    const periodo = String(row.periodo || "").trim();
    const etapa = String(row.etapa || "INICIO").trim().toUpperCase();
    const estado = String(row.estado || "BORRADOR").trim().toUpperCase();
    const fechaInicio = new Date(row.fechaInicio);
    const fechaFin = new Date(row.fechaFin);
    const anio = Number(row.anio || new Date().getFullYear());
    if (!periodo || Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
      return { ok: false, message: "Fila invalida para ciclos" };
    }
    return { ok: true, row: { periodo, etapa, estado, fechaInicio, fechaFin, anio } };
  }

  if (dataset === "roles") {
    const nombre = String(row.nombre || "").trim();
    if (!nombre) return { ok: false, message: "Falta nombre de rol" };
    return { ok: true, row: { nombre } };
  }

  return { ok: false, message: "Dataset no soportado" };
}

function saveImportPreview(payload) {
  const token = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  importPreviewStore.set(token, { ...payload, createdAt: Date.now() });
  return token;
}

function getImportPreview(token) {
  const data = importPreviewStore.get(token);
  if (!data) return null;
  if (Date.now() - data.createdAt > 1000 * 60 * 30) {
    importPreviewStore.delete(token);
    return null;
  }
  return data;
}

function sanitizeIssueNormalized(normalized) {
  if (!normalized || typeof normalized !== "object") return null;
  const safe = { ...normalized };
  if ("email" in safe) safe.email = "[redacted]";
  if ("correoelectronico" in safe) safe.correoelectronico = "[redacted]";
  Object.keys(safe).forEach((key) => {
    if (typeof safe[key] === "string" && safe[key].length > 160) {
      safe[key] = `${safe[key].slice(0, 160)}...`;
    }
  });
  return safe;
}

async function createImportJob({
  req,
  companyId,
  schoolId,
  previewToken,
  datasetRequested,
  datasetDetected,
  parserType,
  totalRows,
  validRows,
  invalidRows,
  previewSummary,
  issues,
  aiRawSummary,
  sourceFileName,
  sourceMimeType,
  sourceStorageProvider = "local",
  sourceStorageKey = "",
  sourcePublicUrl = "",
  stage = "validated",
}) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  const initialIssues = Array.isArray(issues)
    ? issues.slice(0, 200).map((issue) => ({
        rowNumber: String(issue.row ?? issue.rowNumber ?? ""),
        message: String(issue.message || "Error de validacion"),
        source: issue.source || "rule",
        normalized: sanitizeIssueNormalized(issue.normalized || null),
      }))
    : [];

  return ImportJob.create({
    companyId,
    schoolId,
    createdByUserId: req.user.userId,
    sourceFileName,
    sourceMimeType,
    sourceStorageProvider,
    sourceStorageKey,
    sourcePublicUrl,
    previewToken,
    stage,
    datasetRequested,
    datasetDetected,
    parserType,
    inferenceUsed: parserType !== "rules",
    totalRows,
    validRows,
    invalidRows,
    errorCount: initialIssues.length,
    previewSummary: previewSummary || null,
    issues: initialIssues,
    aiRawSummary: aiRawSummary || null,
    auditTrail: [
      {
        action: "preview_created",
        actorUserId: req.user.userId,
        details: {
          datasetRequested,
          datasetDetected,
          validRows,
          invalidRows,
        },
      },
    ],
    expiresAt,
  });
}

router.get(
  "/overview",
  auth,
  requireAnyPermission(
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.DOWNLOAD_REPORTS,
    PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
    PERMISSIONS.DOWNLOAD_SELF_REPORT,
    PERMISSIONS.READ_ONLY_ACCESS
  ),
  async (req, res) => {
    const filter = buildBaseFilter(req);
    const [schools, employees, evaluations, metrics, plans, downloads] = await Promise.all([
      School.find(filter).sort({ nombre: 1 }).lean(),
      Employee.countDocuments(filter),
      Evaluation.countDocuments(filter),
      Metric.countDocuments(filter),
      DevelopmentPlan.countDocuments(filter),
      DownloadLog.find(filter).sort({ downloadedAt: -1 }).limit(12).lean(),
    ]);

    res.json({
      summary: {
        employees,
        evaluations,
        metrics,
        developmentPlans: plans,
      },
      schools,
      recentDownloads: downloads,
      datasets: Object.keys(allowedDatasets),
      downloadPolicy: getDownloadPolicy(req),
    });
  }
);

router.get(
  "/dataset/:dataset",
  auth,
  requireAnyPermission(
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.DOWNLOAD_REPORTS,
    PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
    PERMISSIONS.DOWNLOAD_SELF_REPORT,
    PERMISSIONS.READ_ONLY_ACCESS
  ),
  async (req, res) => {
    const config = allowedDatasets[req.params.dataset];
    if (!config) {
      return res.status(404).json({ mensaje: "Dataset no disponible" });
    }

    const filter = await buildScopedFilter(req, req.params.dataset);
    const data = await config.model.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    res.json({
      dataset: req.params.dataset,
      items: data,
      filters: req.query,
      canDownload: canDownloadDataset(req, req.params.dataset),
      policy: getDownloadPolicy(req).find((item) => item.dataset === req.params.dataset),
    });
  }
);

router.get(
  "/download/:dataset",
  auth,
  requireAnyPermission(
    PERMISSIONS.DOWNLOAD_REPORTS,
    PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
    PERMISSIONS.DOWNLOAD_SELF_REPORT
  ),
  async (req, res) => {
    const dataset = req.params.dataset;
    const config = allowedDatasets[dataset];

    if (!config) {
      return res.status(404).json({ mensaje: "Dataset no disponible" });
    }

    if (!canDownloadDataset(req, dataset)) {
      return res.status(403).json({ mensaje: "No tienes permiso para descargar este dataset" });
    }

    const filter = await buildScopedFilter(req, dataset);
    const items = await config.model.find(filter).sort({ createdAt: -1 }).lean();
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";

    await registerDownload(req, dataset, { ...req.query, format });

    if (format === "csv") {
      const parser = new Parser({ fields: config.fields });
      const csv = parser.parse(items);
      res.header("Content-Type", "text/csv");
      res.attachment(`${config.filename}.csv`);
      return res.send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Datos");
    worksheet.columns = config.fields.map((field) => ({
      header: field,
      key: field,
      width: 22,
    }));
    worksheet.addRows(items);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${config.filename}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  }
);

router.get(
  "/evaluation-report/:evaluationId",
  auth,
  requireAnyPermission(
    PERMISSIONS.DOWNLOAD_REPORTS,
    PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
    PERMISSIONS.DOWNLOAD_SELF_REPORT,
    PERMISSIONS.VIEW_REPORTS
  ),
  async (req, res) => {
    const evaluation = await Evaluation.findOne(
      await buildScopedFilter(req, "evaluations")
    )
      .where("_id")
      .equals(req.params.evaluationId)
      .lean();

    if (!evaluation) {
      return res.status(404).json({ mensaje: "Evaluación no encontrada" });
    }

    const [employee, school] = await Promise.all([
      Employee.findById(evaluation.employeeId).lean(),
      School.findById(evaluation.schoolId).lean(),
    ]);

    const report = {
      generatedAt: new Date(),
      role: req.user.roleCode,
      schoolName: school?.nombre || "Colegio",
      employee: employee
        ? {
            nombreCompleto: `${employee.apellido}, ${employee.nombre}`,
            cargo: employee.cargo || "-",
            area: employee.area || "-",
            email: employee.email || "-",
          }
        : null,
      evaluation: {
        tipo: evaluation.tipo,
        estado: evaluation.estado,
        resultadoFinal: evaluation.resultadoFinal,
        acuerdoEmpleado: evaluation.acuerdoEmpleado,
        comentariosGenerales: evaluation.comentariosGenerales || "",
        fecha: evaluation.createdAt,
      },
    };

    res.json(report);
  }
);

router.post(
  "/import/preview",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_EMPLOYEES, PERMISSIONS.MANAGE_METRICS, PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debes subir un archivo CSV o Excel" });
    }

    const requestedDataset = String(req.body.dataset || "auto").toLowerCase();
    const analyzeOnly =
      String(req.body.mode || "").toLowerCase() === "analyze"
      || String(req.body.analyzeOnly || "").toLowerCase() === "true";
    const manualMapping = parseManualMapping(req.body.manualMapping);
    const { companyId } = await resolveCompanyScope(req);
    const schoolId = req.body.schoolId || req.user.schoolId || null;
    if (!(await validateImportSchool(companyId, schoolId))) {
      return res.status(400).json({ mensaje: "El colegio seleccionado no pertenece a tu organizacion" });
    }
    const parsed = await parseUploadedRows(req.file);
    const { rows, truncated, sheetName, headerRowNumber, headers, worksheetsMeta, droppedEmptyRows } = parsed;
    if (!rows.length) {
      const importJob = await createImportJob({
        req,
        companyId,
        schoolId,
        previewToken: "",
        datasetRequested: requestedDataset,
        datasetDetected: "unknown",
        parserType: "rules",
        totalRows: 0,
        validRows: 0,
        invalidRows: 1,
        previewSummary: null,
        issues: [{ row: 0, message: "El archivo no tiene datos", source: "rule" }],
        aiRawSummary: null,
        sourceFileName: req.file.originalname,
        sourceMimeType: req.file.mimetype,
        stage: "failed",
      });
      return res.status(400).json({ mensaje: "El archivo no tiene datos", importJobId: importJob._id });
    }

    const learnedMapping = await getLearnedMapping(companyId, requestedDataset === "auto" ? "employees" : requestedDataset);
    const detections = buildColumnDetections(rows, headers || Object.keys(rows[0] || {}), fieldAliases, manualMapping, learnedMapping);
    let { dataset: detectedDataset, scores: datasetScores } = classifyDatasetByDetections(detections, requestedDataset);

    const firstRowsText = JSON.stringify(rows.slice(0, 20)).toLowerCase();
    if (
      detectedDataset === "unknown"
      && (firstRowsText.includes("evaluaciondedesempeno") || firstRowsText.includes("comentarios jefatura"))
    ) {
      detectedDataset = "narrative";
    }

    if (detectedDataset === "unknown") {
      const importJob = await createImportJob({
        req,
        companyId,
        schoolId,
        previewToken: "",
        datasetRequested: requestedDataset,
        datasetDetected: "unknown",
        parserType: "rules",
        totalRows: rows.length,
        validRows: 0,
        invalidRows: rows.length,
        previewSummary: null,
        issues: [{ row: 0, message: "No se reconocieron encabezados o estructura importable", source: "rule" }],
        aiRawSummary: null,
        sourceFileName: req.file.originalname,
        sourceMimeType: req.file.mimetype,
        stage: "failed",
      });
      return res.status(422).json({
        ok: false,
        status: "rejected_unrecognized_file",
        importJobId: importJob._id,
        detectedDataset,
        analysis: {
          sheetName,
          headerRowNumber,
          availableHeaders: headers || [],
          columnDetections: detections,
          datasetScores,
          worksheets: worksheetsMeta || [],
        },
        mensaje: "No se pudo reconocer la estructura del archivo para importacion.",
      });
    }

    if (detectedDataset === "narrative") {
      const narrativeData = extractNarrativeData(rows);
      const nameParts = parseNameParts(narrativeData.fullName);
      const previewToken = saveImportPreview({
        dataset: detectedDataset,
        schoolId,
        validRows: [],
        invalidRows: [],
        narrativeData,
        fileMeta: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          binaryBuffer: req.file.buffer,
        },
      });
      const narrativeIssues = narrativeData.competencias.length
        ? []
        : [{ row: 0, message: "No se detectaron competencias puntuables en el formulario.", source: "rule" }];
      const extractedSummary = {
        nombre: narrativeData.fullName || "",
        apellido: nameParts.apellido || "",
        cargo: narrativeData.cargo || "",
        area: narrativeData.area || "",
        competenciasDetectadas: narrativeData.competencias.length,
        promedioFinal: narrativeData.promedioFinal || 0,
      };
      const importJob = await createImportJob({
        req,
        companyId,
        schoolId,
        previewToken,
        datasetRequested: requestedDataset,
        datasetDetected: "narrative",
        parserType: "hybrid",
        totalRows: rows.length,
        validRows: narrativeData.competencias.length ? 1 : 0,
        invalidRows: narrativeData.competencias.length ? 0 : 1,
        previewSummary: extractedSummary,
        issues: narrativeIssues,
        aiRawSummary: null,
        sourceFileName: req.file.originalname,
        sourceMimeType: req.file.mimetype,
      });

      const payload = {
        ok: true,
        importJobId: importJob?._id,
        previewToken: analyzeOnly ? "" : previewToken,
        datasetDetected: "narrative",
        totalRows: rows.length,
        validCount: narrativeData.competencias.length ? 1 : 0,
        invalidCount: narrativeData.competencias.length ? 0 : 1,
        truncated,
        previewLimit: MAX_PREVIEW_ROWS,
        extractedSummary,
        sampleValidRows: narrativeData.competencias.slice(0, 20),
        sampleErrors: narrativeData.competencias.length
          ? []
          : [{ row: 0, message: "No se detectaron competencias puntuables en el formulario." }],
        analysis: {
          mode: analyzeOnly ? "analyze_only" : "preview",
          sheetName,
          headerRowNumber,
          availableHeaders: headers || [],
          columnDetections: detections,
          datasetScores,
          worksheets: worksheetsMeta || [],
        },
      };
      if (analyzeOnly) {
        return res.json({ ...payload, previewToken: "", analyzeOnly: true });
      }
      return res.json(payload);
    }

    const mappedRows = mapRowsByDetections(rows, detections, detectedDataset);
    const validation = validateRowsForDataset(mappedRows, detectedDataset, detections);
    const validRows = validation.validRows;
    const invalidRows = validation.invalidRows;
    const warnings = validation.warnings || [];
    const confidenceFields = criticalFieldsByDataset[detectedDataset] || [];
    const lowConfidenceCritical = confidenceFields
      .filter((field) => (detections[field]?.confidence || 0) < IMPORT_CONFIDENCE_THRESHOLD)
      .map((field) => ({
        field,
        confidence: detections[field]?.confidence || 0,
      }));
    const requiresManualMapping = validation.needsManualMapping || lowConfidenceCritical.length > 0;

    if (analyzeOnly) {
      const importJob = await createImportJob({
        req,
        companyId,
        schoolId,
        previewToken: "",
        datasetRequested: requestedDataset,
        datasetDetected: detectedDataset,
        parserType: "rules",
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        previewSummary: {
          droppedEmptyRows,
          requiresManualMapping,
          warnings: warnings.length,
          duplicates: validation.duplicates.length,
        },
        issues: [...invalidRows, ...warnings].slice(0, 200),
        aiRawSummary: null,
        sourceFileName: req.file.originalname,
        sourceMimeType: req.file.mimetype,
      });
      return res.json({
        ok: true,
        analyzeOnly: true,
        importJobId: importJob._id,
        datasetDetected: detectedDataset,
        totalRows: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        warningCount: warnings.length,
        duplicateCount: validation.duplicates.length,
        analysis: {
          mode: "analyze_only",
          sheetName,
          headerRowNumber,
          availableHeaders: headers || [],
          worksheets: worksheetsMeta || [],
          datasetScores,
          columnDetections: detections,
          requiresManualMapping,
          lowConfidenceCritical,
          confirmationsRequired: validation.confirmationsRequired,
          detectedRoles: validation.detectedRoles,
          droppedEmptyRows,
        },
        sampleValidRows: validRows.slice(0, 20),
        sampleErrors: invalidRows.slice(0, 20),
        sampleWarnings: warnings.slice(0, 20),
      });
    }

    const previewToken = saveImportPreview({
      dataset: detectedDataset,
      schoolId,
      validRows,
      invalidRows,
      warnings,
      detectionSummary: {
        sheetName,
        headerRowNumber,
        availableHeaders: headers || [],
        worksheets: worksheetsMeta || [],
        datasetScores,
        columnDetections: detections,
        requiresManualMapping,
        lowConfidenceCritical,
        confirmationsRequired: validation.confirmationsRequired,
        detectedRoles: validation.detectedRoles,
        duplicateCount: validation.duplicates.length,
      },
      fileMeta: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        binaryBuffer: req.file.buffer,
      },
    });
    const importJob = await createImportJob({
      req,
      companyId,
      schoolId,
      previewToken,
      datasetRequested: requestedDataset,
      datasetDetected: detectedDataset,
      parserType: "rules",
      totalRows: validRows.length + invalidRows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      previewSummary: {
        droppedEmptyRows,
        requiresManualMapping,
        warnings: warnings.length,
        duplicates: validation.duplicates.length,
      },
      issues: [...invalidRows, ...warnings],
      aiRawSummary: null,
      sourceFileName: req.file.originalname,
      sourceMimeType: req.file.mimetype,
    });

    res.json({
      ok: true,
      importJobId: importJob._id,
      previewToken,
      datasetDetected: detectedDataset,
      totalRows: validRows.length + invalidRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      warningCount: warnings.length,
      truncated,
      previewLimit: MAX_PREVIEW_ROWS,
      sampleValidRows: validRows.slice(0, 20),
      sampleErrors: invalidRows.slice(0, 20),
      sampleWarnings: warnings.slice(0, 20),
      analysis: {
        mode: "preview",
        sheetName,
        headerRowNumber,
        availableHeaders: headers || [],
        worksheets: worksheetsMeta || [],
        datasetScores,
        columnDetections: detections,
        requiresManualMapping,
        lowConfidenceCritical,
        confirmationsRequired: validation.confirmationsRequired,
        detectedRoles: validation.detectedRoles,
        duplicateCount: validation.duplicates.length,
        droppedEmptyRows,
      },
    });
  }
);

router.post(
  "/import/confirm",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_EMPLOYEES, PERMISSIONS.MANAGE_METRICS, PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const previewToken = String(req.body.previewToken || "");
    const preview = getImportPreview(previewToken);
    if (!preview) {
      return res.status(400).json({
        mensaje:
          "Preview expirada o inexistente. Puede haber vencido la sesion de importacion o reiniciado el servidor. Vuelve a subir el archivo.",
      });
    }

    const dataset = preview.dataset;
    const confirmMapping = Boolean(req.body.confirmMapping);
    const confirmWarnings = Boolean(req.body.confirmWarnings);
    const detectionSummary = preview.detectionSummary || {};
    if (detectionSummary.requiresManualMapping && !confirmMapping) {
      return res.status(400).json({
        mensaje:
          "El archivo requiere confirmar mapeo manual por baja confianza. Revisa columnas detectadas y confirma.",
        code: "IMPORT_MAPPING_CONFIRMATION_REQUIRED",
      });
    }
    if ((preview.warnings || []).length > 0 && !confirmWarnings) {
      return res.status(400).json({
        mensaje:
          "Hay advertencias de rol/jefe/sede/duplicados. Debes confirmar revisión antes de importar.",
        code: "IMPORT_WARNING_CONFIRMATION_REQUIRED",
      });
    }
    const { companyId } = await resolveCompanyScope(req);
    const schoolId = preview.schoolId || req.user.schoolId || null;
    if (!(await validateImportSchool(companyId, schoolId))) {
      return res.status(400).json({ mensaje: "El colegio seleccionado no pertenece a tu organizacion" });
    }
    const importJob = await ImportJob.findOne({
      companyId,
      previewToken,
      stage: { $in: ["validated", "uploaded"] },
    }).sort({ createdAt: -1 });
    const rows = [...preview.validRows];
    const correctedRows = Array.isArray(req.body.correctedRows) ? req.body.correctedRows : [];
    const originalInvalidRows = Array.isArray(preview.invalidRows) ? preview.invalidRows : [];
    const correctedErrors = [];
    correctedRows.forEach((item, index) => {
      const checked = validateCorrectedRow(dataset, item);
      if (checked.ok) rows.push(checked.row);
      else {
        const original = originalInvalidRows[index] || {};
        correctedErrors.push({
          row: item.row || original.row || `manual-${index + 1}`,
          message: checked.message,
          normalized: item,
        });
      }
    });
    const unresolvedInvalidRows = originalInvalidRows.slice(correctedRows.length);

    const result = {
      total: rows.length + unresolvedInvalidRows.length + correctedErrors.length,
      created: 0,
      updated: 0,
      errors: [...unresolvedInvalidRows, ...correctedErrors],
      warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
    };
    const appendAudit = (action, details = {}) => {
      if (!importJob) return;
      importJob.auditTrail.push({
        action,
        actorUserId: req.user.userId,
        details,
      });
    };

    if (["employees", "metrics", "cycles", "roles"].includes(dataset) && !rows.length) {
      if (importJob) {
        importJob.stage = "failed";
        importJob.errorCount = result.errors.length || 1;
        importJob.issues = (result.errors.length ? result.errors : [{ row: "-", message: "No hay filas validas para confirmar" }])
          .slice(0, 300)
          .map((issue) => ({
            rowNumber: String(issue.row ?? issue.rowNumber ?? ""),
            message: String(issue.message || "Error de importacion"),
            source: issue.source || "rule",
            normalized: sanitizeIssueNormalized(issue.normalized || null),
          }));
        appendAudit("import_failed", { reason: "no_valid_rows" });
        await importJob.save();
      }
      return res.status(400).json({ mensaje: "No hay filas validas para confirmar", errors: result.errors });
    }

    if (dataset === "narrative") {
      if (!schoolId) {
        return res.status(400).json({ mensaje: "Debes indicar colegio para importar formulario narrativo" });
      }
      const narrativeData = preview.narrativeData || {};
      const nameParts = parseNameParts(narrativeData.fullName || "");
      const apellido = nameParts.apellido || "SinApellido";
      const nombre = nameParts.nombre || "SinNombre";
      const cargo = String(narrativeData.cargo || "Docente").trim();
      const area = String(narrativeData.area || "General").trim();

      const employee = await Employee.findOneAndUpdate(
        { companyId, schoolId, apellido, nombre, cargo },
        {
          $set: {
            companyId,
            schoolId,
            apellido,
            nombre,
            cargo,
            area,
            tipoEmpleado: "DOCENTE",
            activo: true,
          },
        },
        { new: true, upsert: true }
      );

      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      const cycle = await EvaluationCycle.findOneAndUpdate(
        {
          companyId,
          schoolId,
          anio: now.getFullYear(),
          periodo: "Importado",
          etapa: "EVALUACION_FINAL",
        },
        {
          $set: {
            companyId,
            schoolId,
            anio: now.getFullYear(),
            periodo: "Importado",
            etapa: "EVALUACION_FINAL",
            estado: "CERRADO",
            fechaInicio: startOfYear,
            fechaFin: endOfYear,
          },
        },
        { new: true, upsert: true }
      );

      const evaluation = await Evaluation.create({
        companyId,
        schoolId,
        employeeId: employee._id,
        evaluatorUserId: req.user.userId,
        cycleId: cycle._id,
        tipo: "FINAL",
        estado: "CERRADA",
        comentariosGenerales: "Evaluacion importada desde formulario narrativo",
        acuerdoEmpleado: "PENDIENTE",
        resultadoFinal: Number(narrativeData.promedioFinal || 0),
      });

      for (const item of narrativeData.competencias || []) {
        const compName = String(item.competencia || "").trim();
        if (!compName) continue;

        const competency = await Competency.findOneAndUpdate(
          { companyId, schoolId, nombre: compName },
          {
            $setOnInsert: {
              companyId,
              schoolId,
              nombre: compName,
              descripcion: "Competencia detectada en formulario narrativo",
              tipo: "TRANSVERSAL",
              componente: "H",
              activa: true,
            },
          },
          { upsert: true, new: true }
        );

        const metricName = `Nivel general - ${compName}`;
        const metric = await Metric.findOneAndUpdate(
          { companyId, schoolId, competencyId: competency._id, nombre: metricName },
          {
            $setOnInsert: {
              companyId,
              schoolId,
              competencyId: competency._id,
              nombre: metricName,
              descripcion: "Metrica generada automaticamente desde formulario narrativo",
              ponderacion: 1,
              activa: true,
              cargoAplica: [cargo],
            },
          },
          { upsert: true, new: true }
        );

        const roundedNivel = Math.min(5, Math.max(1, Math.round(Number(item.nivel || 1))));
        await EvaluationScore.create({
          evaluationId: evaluation._id,
          metricId: metric._id,
          nivel: roundedNivel,
          comentario: "Generado automaticamente desde importacion narrativo",
        });
      }

      result.created += 1;
    }

    if (dataset === "multi") {
      const modules = preview.aiParsed?.detectedModules || {};
      const byNameCompetency = new Map();

      const employees = Array.isArray(modules.employees) ? modules.employees : [];
      for (const row of employees) {
        if (!schoolId) continue;
        const apellido = String(row.apellido || "").trim() || parseNameParts(row.nombreCompleto || row.nombre || "").apellido || "-";
        const nombre = String(row.nombre || "").trim() || parseNameParts(row.nombreCompleto || "").nombre || "-";
        const cargo = String(row.cargo || "").trim() || "Colaborador";
        const email = String(row.email || "").trim().toLowerCase();

        const existing = email ? await Employee.findOne({ companyId, schoolId, email }) : null;
        const payload = {
          companyId,
          schoolId,
          apellido,
          nombre,
          cargo,
          area: String(row.area || "General").trim(),
          tipoEmpleado: "DOCENTE",
          activo: true,
          legajo: String(row.legajo || row.employeeId || "").trim() || undefined,
        };
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          result.updated += 1;
        } else {
          await Employee.create({ ...payload, email: email || undefined });
          result.created += 1;
        }
      }

      const roles = Array.isArray(modules.roles) ? modules.roles : [];
      for (const row of roles) {
        const nombre = String(row.nombre || row.role || "").trim();
        if (!nombre) continue;
        if (sanitizeHeader(nombre).includes("superadmin")) {
          result.errors.push({ row: "-", message: "No se permite crear SUPER_ADMIN por importacion", normalized: { nombre } });
          continue;
        }
        const exists = await Role.findOne({ companyId, schoolId: schoolId || null, nombre });
        if (exists) continue;
        await Role.create({
          companyId,
          schoolId: schoolId || null,
          nombre,
          descripcion: "Rol importado automaticamente",
          permisos: [],
          scope: schoolId ? "school" : "company",
          activo: true,
        });
        result.created += 1;
      }

      const competencies = Array.isArray(modules.competencies) ? modules.competencies : [];
      for (const row of competencies) {
        if (!schoolId) continue;
        const nombre = String(row.nombre || row.competencia || "").trim();
        if (!nombre) continue;
        const competency = await Competency.findOneAndUpdate(
          { companyId, schoolId, nombre },
          {
            $setOnInsert: {
              companyId,
              schoolId,
              nombre,
              descripcion: String(row.descripcion || "Importada desde parser AI").trim(),
              tipo: "TRANSVERSAL",
              componente: "H",
              activa: true,
            },
          },
          { upsert: true, new: true }
        );
        byNameCompetency.set(normalizeText(nombre), competency);
      }

      const metrics = Array.isArray(modules.metrics) ? modules.metrics : [];
      for (const row of metrics) {
        if (!schoolId) continue;
        const nombre = String(row.nombre || row.metrica || "").trim();
        const compName = normalizeText(row.competencia || row.competency || "");
        const competency = byNameCompetency.get(compName);
        if (!nombre || !competency) continue;
        const exists = await Metric.findOne({ companyId, schoolId, competencyId: competency._id, nombre });
        if (exists) continue;
        await Metric.create({
          companyId,
          schoolId,
          competencyId: competency._id,
          nombre,
          descripcion: String(row.descripcion || "Importada automaticamente").trim(),
          cargoAplica: [],
          ponderacion: Number(row.ponderacion || 1) || 1,
          activa: true,
        });
        result.created += 1;
      }

      const cycles = Array.isArray(modules.cycles) ? modules.cycles : [];
      for (const row of cycles) {
        if (!schoolId) continue;
        const anio = Number(row.anio || new Date().getFullYear());
        const periodo = String(row.periodo || row.nombre || "Importado").trim();
        const etapa = ["INICIO", "REVISION_INTERMEDIA", "EVALUACION_FINAL"].includes(String(row.etapa || "").toUpperCase())
          ? String(row.etapa).toUpperCase()
          : "EVALUACION_FINAL";
        const fechaInicio = row.fechaInicio ? new Date(row.fechaInicio) : new Date(anio, 0, 1);
        const fechaFin = row.fechaFin ? new Date(row.fechaFin) : new Date(anio, 11, 31);
        const exists = await EvaluationCycle.findOne({ companyId, schoolId, anio, periodo, etapa });
        if (exists) continue;
        await EvaluationCycle.create({
          companyId,
          schoolId,
          anio,
          periodo,
          etapa,
          estado: "CERRADO",
          fechaInicio,
          fechaFin,
        });
        result.created += 1;
      }
    }

    if (dataset === "employees") {
      for (const row of rows) {
        if (!schoolId) {
          result.errors.push({ row: "-", message: "No hay colegio activo para crear empleados" });
          continue;
        }
        const email = String(row.email || "").trim().toLowerCase();
        const base = {
          companyId,
          schoolId,
          apellido: row.apellido,
          nombre: row.nombre,
          cargo: row.cargo,
          area: row.area || "",
          tipoEmpleado: row.tipoempleado || "DOCENTE",
          activo: row.activo !== "false",
          legajo: row.legajo || row.employeeId || undefined,
        };
        const existing = email ? await Employee.findOne({ companyId, schoolId, email }) : null;
        if (existing) {
          Object.assign(existing, base);
          await existing.save();
          result.updated += 1;
        } else {
          await Employee.create({ ...base, email: email || undefined });
          result.created += 1;
        }
      }
    }

    if (dataset === "metrics") {
      if (!schoolId) return res.status(400).json({ mensaje: "Debes indicar colegio para importar metricas" });
      const competencies = await Competency.find({ companyId, schoolId }).lean();
      const byName = new Map(competencies.map((item) => [normalizeText(item.nombre), item]));
      for (const row of rows) {
        const competency = byName.get(normalizeText(row.competencia));
        if (!competency) {
          result.errors.push({ row: "-", message: `Competencia no encontrada: ${row.competencia}` });
          continue;
        }
        const payload = {
          companyId,
          schoolId,
          competencyId: competency._id,
          nombre: row.nombre,
          descripcion: row.descripcion || "",
          ponderacion: row.ponderacion || 1,
          cargoAplica: [],
          activa: true,
        };
        const existing = await Metric.findOne({ companyId, schoolId, competencyId: competency._id, nombre: row.nombre });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          result.updated += 1;
        } else {
          await Metric.create(payload);
          result.created += 1;
        }
      }
    }

    if (dataset === "cycles") {
      if (!schoolId) return res.status(400).json({ mensaje: "Debes indicar colegio para importar ciclos" });
      for (const row of rows) {
        const payload = {
          companyId,
          schoolId,
          anio: row.anio,
          periodo: row.periodo,
          etapa: row.etapa,
          estado: row.estado,
          fechaInicio: row.fechaInicio,
          fechaFin: row.fechaFin,
        };
        const existing = await EvaluationCycle.findOne({
          companyId,
          schoolId,
          anio: row.anio,
          periodo: row.periodo,
          etapa: row.etapa,
        });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          result.updated += 1;
        } else {
          await EvaluationCycle.create(payload);
          result.created += 1;
        }
      }
    }

    if (dataset === "roles") {
      for (const row of rows) {
        if (sanitizeHeader(row.nombre).includes("superadmin")) {
          result.errors.push({ row: "-", message: "No se permite crear SUPER_ADMIN por importacion", normalized: { nombre: row.nombre } });
          continue;
        }
        const existing = await Role.findOne({
          companyId,
          schoolId: schoolId || null,
          nombre: row.nombre,
        });
        if (existing) {
          result.updated += 1;
          continue;
        }
        await Role.create({
          companyId,
          schoolId: schoolId || null,
          nombre: row.nombre,
          descripcion: "Rol importado",
          permisos: [],
          scope: schoolId ? "school" : "company",
          activo: true,
        });
        result.created += 1;
      }
    }

    const school = schoolId ? await School.findById(schoolId).lean() : null;
    const uploaded = await uploadBufferToStorage({
      buffer: preview.fileMeta.binaryBuffer,
      contentType: preview.fileMeta.mimetype,
      originalName: preview.fileMeta.originalname,
      folderPath: `performia/${companyId}/${school?.slug || schoolId || "general"}/${dataset}`,
    });

    await DatabaseFile.create({
      companyId,
      schoolId,
      nombreVisible: `Importacion ${dataset} (${new Date().toLocaleDateString("es-AR")})`,
      nombreArchivo: preview.fileMeta.originalname,
      archivo: "",
      extension: preview.fileMeta.originalname.split(".").pop()?.toLowerCase() || "csv",
      mimeType: preview.fileMeta.mimetype,
      tipoArchivo: `importacion-${dataset}`,
      storageProvider: uploaded.provider,
      storageKey: uploaded.key,
      storageBucket: uploaded.bucket,
      publicUrl: uploaded.publicUrl,
      hoja: dataset,
      registros: result.total,
      activa: true,
    });

    if (importJob) {
      importJob.stage = "confirmed";
      importJob.datasetDetected = dataset;
      importJob.validRows = rows.length;
      importJob.invalidRows = result.errors.length;
      importJob.createdCount = result.created;
      importJob.updatedCount = result.updated;
      importJob.errorCount = result.errors.length;
      importJob.confirmedAt = new Date();
      importJob.expiresAt = null;
      importJob.issues = result.errors.slice(0, 300).map((issue) => ({
        rowNumber: String(issue.row ?? issue.rowNumber ?? ""),
        message: String(issue.message || "Error de importacion"),
        source: issue.source || "rule",
        normalized: sanitizeIssueNormalized(issue.normalized || null),
      }));
      appendAudit("import_confirmed", {
        dataset,
        created: result.created,
        updated: result.updated,
        errors: result.errors.length,
      });
      await importJob.save();
    }

    if (detectionSummary?.columnDetections && ["employees", "metrics", "cycles", "roles"].includes(dataset)) {
      const columnMapping = Object.entries(detectionSummary.columnDetections).reduce((acc, [field, meta]) => {
        if (meta?.header) acc[field] = meta.header;
        return acc;
      }, {});
      if (Object.keys(columnMapping).length) {
        await CompanySetting.findOneAndUpdate(
          { companyId },
          {
            $set: {
              [`importProfiles.${dataset}`]: {
                columnMapping,
                sheetName: detectionSummary.sheetName || "",
                headerRowNumber: detectionSummary.headerRowNumber || 1,
                updatedAt: new Date(),
              },
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    importPreviewStore.delete(previewToken);
    res.json({ mensaje: "Importacion confirmada", importJobId: importJob?._id || null, ...result });
  }
);

router.get(
  "/import-jobs",
  auth,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.MANAGE_METRICS,
    PERMISSIONS.MANAGE_EVALUATION_CYCLES,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.READ_ONLY_ACCESS
  ),
  async (req, res) => {
    const filter = buildBaseFilter(req);
    if (!req.user.isSuperAdmin && req.user.schoolId) {
      filter.schoolId = req.user.schoolId;
    }
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.datasetDetected) filter.datasetDetected = req.query.datasetDetected;

    const items = await ImportJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .select(
        "sourceFileName stage datasetRequested datasetDetected parserType totalRows validRows invalidRows createdCount updatedCount errorCount createdAt confirmedAt previewSummary"
      )
      .lean();

    res.json({ items });
  }
);

router.get(
  "/import-jobs/:id",
  auth,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.MANAGE_METRICS,
    PERMISSIONS.MANAGE_EVALUATION_CYCLES,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.READ_ONLY_ACCESS
  ),
  async (req, res) => {
    const filter = buildBaseFilter(req);
    filter._id = req.params.id;

    const job = await ImportJob.findOne(filter).lean();
    if (!job) {
      return res.status(404).json({ mensaje: "Importacion no encontrada" });
    }

    res.json({ job });
  }
);

router.post(
  "/import/:dataset",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_EMPLOYEES, PERMISSIONS.MANAGE_METRICS, PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  upload.single("file"),
  async (req, res) => {
    const legacyAllowed = process.env.NODE_ENV !== "production" || req.user.isSuperAdmin;
    if (!legacyAllowed) {
      return res.status(403).json({
        mensaje:
          "El endpoint legacy de importacion directa esta deshabilitado en produccion. Usa Subir -> Validar -> Confirmar.",
      });
    }

    const dataset = req.params.dataset;
    if (!["employees", "metrics", "cycles"].includes(dataset)) {
      return res.status(400).json({ mensaje: "Dataset no soportado para importacion" });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: "Debes subir un archivo CSV o Excel" });
    }

    const { companyId } = await resolveCompanyScope(req);
    const schoolId = req.body.schoolId || req.user.schoolId || null;
    if (!(await validateImportSchool(companyId, schoolId))) {
      return res.status(400).json({ mensaje: "El colegio seleccionado no pertenece a tu organizacion" });
    }
    const { rows } = await parseUploadedRows(req.file);

    if (!rows.length) {
      return res.status(400).json({ mensaje: "El archivo no tiene datos" });
    }

    const result = { total: rows.length, created: 0, updated: 0, errors: [] };

    if (dataset === "employees") {
      for (const row of rows) {
        const apellido = String(row.apellido || "").trim();
        const nombre = String(row.nombre || "").trim();
        const cargo = String(row.cargo || "").trim();
        if (!apellido || !nombre || !cargo || !schoolId) {
          result.errors.push({ row: row._rowNumber, message: "Faltan apellido, nombre, cargo o colegio" });
          continue;
        }

        const email = String(row.email || "").trim().toLowerCase();
        const base = {
          companyId,
          schoolId,
          apellido,
          nombre,
          cargo,
          area: String(row.area || "").trim(),
          tipoEmpleado: String(row.tipoempleado || "DOCENTE").trim().toUpperCase(),
          activo: String(row.activo || "true").toLowerCase() !== "false",
        };

        const existing = email ? await Employee.findOne({ companyId, schoolId, email }) : null;
        if (existing) {
          Object.assign(existing, base);
          await existing.save();
          result.updated += 1;
        } else {
          await Employee.create({ ...base, email: email || undefined });
          result.created += 1;
        }
      }
    }

    if (dataset === "metrics") {
      if (!schoolId) {
        return res.status(400).json({ mensaje: "Debes indicar colegio para importar metricas" });
      }
      const competencies = await Competency.find({ companyId, schoolId }).lean();
      const byName = new Map(competencies.map((item) => [normalizeText(item.nombre), item]));

      for (const row of rows) {
        const nombre = String(row.nombre || "").trim();
        const competencyName = normalizeText(row.competencia || row.competency || "");
        const competency = byName.get(competencyName);
        if (!nombre || !competency) {
          result.errors.push({ row: row._rowNumber, message: "Falta nombre o competencia valida" });
          continue;
        }

        const payload = {
          companyId,
          schoolId,
          competencyId: competency._id,
          nombre,
          descripcion: String(row.descripcion || "").trim(),
          ponderacion: Number(row.ponderacion || 1) || 1,
          cargoAplica: String(row.cargoaplica || "").split(",").map((v) => v.trim()).filter(Boolean),
          activa: String(row.activa || "true").toLowerCase() !== "false",
        };

        const existing = await Metric.findOne({ companyId, schoolId, competencyId: competency._id, nombre });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          result.updated += 1;
        } else {
          await Metric.create(payload);
          result.created += 1;
        }
      }
    }

    if (dataset === "cycles") {
      if (!schoolId) {
        return res.status(400).json({ mensaje: "Debes indicar colegio para importar ciclos" });
      }
      for (const row of rows) {
        const anio = Number(row.anio || row.ano);
        const periodo = String(row.periodo || "").trim();
        const etapa = String(row.etapa || "").trim().toUpperCase();
        const fechaInicio = row.fechainicio ? new Date(row.fechainicio) : null;
        const fechaFin = row.fechafin ? new Date(row.fechafin) : null;
        if (!anio || !periodo || !etapa || !fechaInicio || !fechaFin || Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
          result.errors.push({ row: row._rowNumber, message: "Fila invalida para ciclo" });
          continue;
        }

        const payload = {
          companyId,
          schoolId,
          anio,
          periodo,
          etapa,
          estado: String(row.estado || "BORRADOR").trim().toUpperCase(),
          fechaInicio,
          fechaFin,
        };

        const existing = await EvaluationCycle.findOne({ companyId, schoolId, anio, periodo, etapa });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          result.updated += 1;
        } else {
          await EvaluationCycle.create(payload);
          result.created += 1;
        }
      }
    }

    const school = schoolId ? await School.findById(schoolId).lean() : null;
    const uploaded = await uploadBufferToStorage({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      folderPath: `performia/${companyId}/${school?.slug || schoolId || "general"}/${dataset}`,
    });

    await DatabaseFile.create({
      companyId,
      schoolId,
      nombreVisible: `Importacion ${dataset} (${new Date().toLocaleDateString("es-AR")})`,
      nombreArchivo: req.file.originalname,
      archivo: "",
      extension: req.file.originalname.split(".").pop()?.toLowerCase() || "csv",
      mimeType: req.file.mimetype,
      tipoArchivo: `importacion-${dataset}`,
      storageProvider: uploaded.provider,
      storageKey: uploaded.key,
      storageBucket: uploaded.bucket,
      publicUrl: uploaded.publicUrl,
      hoja: dataset,
      registros: result.total,
      activa: true,
    });

    const settings = await CompanySetting.findOne({ companyId }).lean();
    if (result.errors.length && settings?.automations?.notifyOnImportErrors !== false) {
      await Announcement.create({
        companyId,
        authorUserId: req.user.userId,
        titulo: `Importacion con errores (${dataset})`,
        cuerpo: `Se detectaron ${result.errors.length} errores en la importacion ${dataset}. Revisa el detalle en Cargas y descargas.`,
        prioridad: "importante",
        categoria: "importacion",
      });
    }

    res.json({
      mensaje: "Importacion completada",
      ...result,
    });
  }
);

export default router;
