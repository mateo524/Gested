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
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { uploadBufferToStorage } from "../utils/storageProvider.js";
import {
  IMPORT_CONFIDENCE_THRESHOLD,
  buildColumnDetections,
  classifyDatasetByDetections,
  detectBestSheet,
  extractRowsFromSheet,
  mapRowsByDetections,
  parseWorkbookRows,
  sanitizeHeader,
  normalizeText,
  validateRowsForDataset,
} from "../utils/importIntelligence.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const importPreviewStore = new Map();
const MAX_PREVIEW_ROWS = 3000;
const IMPORT_AI_ENABLED = String(process.env.IMPORT_AI_ENABLED || "").toLowerCase() === "true";
const IMPORT_AI_WEBHOOK_URL = process.env.IMPORT_AI_WEBHOOK_URL || "";
const IMPORT_AI_TOKEN = process.env.IMPORT_AI_TOKEN || "";
const IMPORT_AI_TIMEOUT_MS = Number(process.env.IMPORT_AI_TIMEOUT_MS || 45000);

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

async function buildScopedFilter(req, dataset) {
  const filter = buildBaseFilter(req);

  if (req.query.schoolId && !req.user.isSuperAdmin) {
    filter.schoolId = req.user.schoolId;
  }

  if (dataset === "employees") {
    if (req.query.area) filter.area = req.query.area;
    if (req.query.cargo) filter.cargo = req.query.cargo;

    if (req.user.roleCode === "JEFE" && req.user.employeeId) {
      filter.managerId = req.user.employeeId;
    }
  }

  if (dataset === "evaluations") {
    if (req.query.estado) filter.estado = req.query.estado;
    if (req.query.tipo) filter.tipo = req.query.tipo;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;

    if (req.user.roleCode === "JEFE" && req.user.employeeId) {
      const team = await Employee.find({
        companyId: req.user.companyId,
        schoolId: req.user.schoolId,
        managerId: req.user.employeeId,
      })
        .select("_id")
        .lean();
      filter.employeeId = { $in: team.map((item) => item._id) };
    }

    if (req.user.roleCode === "EMPLEADO" && req.user.employeeId) {
      filter.employeeId = req.user.employeeId;
    }
  }

  if (dataset === "metrics" && req.query.competencyId) {
    filter.competencyId = req.query.competencyId;
  }

  if (dataset === "developmentPlans") {
    if (req.query.estado) filter.estado = req.query.estado;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;

    if (req.user.roleCode === "JEFE" && req.user.employeeId) {
      const team = await Employee.find({
        companyId: req.user.companyId,
        schoolId: req.user.schoolId,
        managerId: req.user.employeeId,
      })
        .select("_id")
        .lean();
      filter.employeeId = { $in: team.map((item) => item._id) };
    }

    if (req.user.roleCode === "EMPLEADO" && req.user.employeeId) {
      filter.employeeId = req.user.employeeId;
    }
  }

  return filter;
}

function canDownloadDataset(req, dataset) {
  const permissions = req.user?.permisos || [];

  if (req.user.isSuperAdmin) return true;
  if (permissions.includes(PERMISSIONS.DOWNLOAD_REPORTS)) return true;
  if (req.user.roleCode === "JEFE" && permissions.includes(PERMISSIONS.DOWNLOAD_TEAM_REPORTS)) {
    return dataset === "employees" || dataset === "evaluations" || dataset === "developmentPlans";
  }
  if (req.user.roleCode === "EMPLEADO" && permissions.includes(PERMISSIONS.DOWNLOAD_SELF_REPORT)) {
    return dataset === "evaluations" || dataset === "developmentPlans";
  }

  return false;
}

function getDownloadPolicy(req) {
  const datasets = Object.keys(allowedDatasets);
  return datasets.map((dataset) => {
    let scope = "global";
    if (!req.user.isSuperAdmin) {
      if (req.user.roleCode === "JEFE") scope = "equipo";
      else if (req.user.roleCode === "EMPLEADO") scope = "propio";
      else scope = "colegio";
    }

    const canDownload = canDownloadDataset(req, dataset);
    let reason = "Permitido";
    if (!canDownload) {
      reason = "Tu rol no tiene permiso para descargar este dataset";
    } else if (scope === "equipo") {
      reason = "Descarga limitada a tu equipo a cargo";
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
  jefe: ["jefe", "manager", "responsable", "supervisor"],
  sede: ["sede", "colegio", "campus", "institucion"],
  legajo: ["legajo", "employeeid", "employee_id", "dni"],
};

function firstByAliases(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
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
  const workbook = await parseWorkbookRows(file);
  const { selected, candidates } = detectBestSheet(workbook);
  const worksheet = workbook.getWorksheet(selected.sheetName);
  if (!worksheet) {
    return { rows: [], truncated: false, sheetName: "", headerRowNumber: 1, headers: [], worksheetsMeta: [] };
  }
  const extracted = extractRowsFromSheet(worksheet, selected.headerRowNumber || 1);
  return {
    rows: extracted.rows,
    truncated: extracted.truncated,
    sheetName: selected.sheetName,
    headerRowNumber: selected.headerRowNumber || 1,
    headers: extracted.headers,
    worksheetsMeta: candidates.map((item) => ({
      sheetName: item.sheetName,
      score: item.score,
      headerRowNumber: item.headerRowNumber,
    })),
  };
}

function classifyDataset(rows, requestedDataset) {
  if (requestedDataset && requestedDataset !== "auto") {
    return requestedDataset;
  }

  const firstRows = rows.slice(0, 20);
  const rowText = JSON.stringify(firstRows).toLowerCase();

  if (rowText.includes("evaluaciondedesempeno") || rowText.includes("comentarios jefatura")) {
    return "narrative";
  }

  const hasEmployeeFields = firstRows.some(
    (row) =>
      firstByAliases(row, fieldAliases.apellido) &&
      firstByAliases(row, fieldAliases.nombre) &&
      firstByAliases(row, fieldAliases.cargo)
  );
  if (hasEmployeeFields) return "employees";

  const hasMetricFields = firstRows.some(
    (row) =>
      firstByAliases(row, fieldAliases.competencia) &&
      firstByAliases(row, fieldAliases.metrica)
  );
  if (hasMetricFields) return "metrics";

  const hasCycleFields = firstRows.some(
    (row) =>
      firstByAliases(row, fieldAliases.periodo) &&
      firstByAliases(row, fieldAliases.fechainicio) &&
      firstByAliases(row, fieldAliases.fechafin)
  );
  if (hasCycleFields) return "cycles";

  const hasRoleFields = firstRows.some((row) => firstByAliases(row, fieldAliases.rol));
  if (hasRoleFields) return "roles";

  return "unknown";
}

function normalizeRowsForDataset(rows, dataset) {
  const validRows = [];
  const invalidRows = [];

  for (const row of rows) {
    if (Object.keys(row).filter((key) => key !== "_rowNumber").every((key) => !String(row[key] || "").trim())) {
      continue;
    }

    if (dataset === "employees") {
      const normalized = {
        apellido: String(firstByAliases(row, fieldAliases.apellido)).trim(),
        nombre: String(firstByAliases(row, fieldAliases.nombre)).trim(),
        email: String(firstByAliases(row, fieldAliases.email)).trim().toLowerCase(),
        cargo: String(firstByAliases(row, fieldAliases.cargo)).trim(),
        area: String(firstByAliases(row, fieldAliases.area)).trim(),
        tipoempleado: String(firstByAliases(row, fieldAliases.tipoempleado) || "DOCENTE").trim().toUpperCase(),
        activo: String(firstByAliases(row, fieldAliases.activo) || "true").trim().toLowerCase(),
      };
      const errors = [];
      if (!normalized.apellido) errors.push("Falta apellido");
      if (!normalized.nombre) errors.push("Falta nombre");
      if (!normalized.cargo) errors.push("Falta cargo");
      if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized });
      else validRows.push(normalized);
      continue;
    }

    if (dataset === "metrics") {
      const normalized = {
        competencia: String(firstByAliases(row, fieldAliases.competencia)).trim(),
        nombre: String(firstByAliases(row, fieldAliases.metrica)).trim(),
        descripcion: String(firstByAliases(row, fieldAliases.descripcion)).trim(),
        ponderacion: Number(firstByAliases(row, fieldAliases.ponderacion) || 1),
      };
      const errors = [];
      if (!normalized.competencia) errors.push("Falta competencia");
      if (!normalized.nombre) errors.push("Falta metrica");
      if (!Number.isFinite(normalized.ponderacion) || normalized.ponderacion <= 0) errors.push("Ponderacion invalida");
      if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized });
      else validRows.push(normalized);
      continue;
    }

    if (dataset === "cycles") {
      const normalized = {
        periodo: String(firstByAliases(row, fieldAliases.periodo)).trim(),
        etapa: String(firstByAliases(row, fieldAliases.etapa) || "INICIO").trim().toUpperCase(),
        estado: String(firstByAliases(row, fieldAliases.estado) || "BORRADOR").trim().toUpperCase(),
        fechaInicio: new Date(firstByAliases(row, fieldAliases.fechainicio)),
        fechaFin: new Date(firstByAliases(row, fieldAliases.fechafin)),
        anio: Number(String(firstByAliases(row, ["anio", "ano", "año"]) || new Date().getFullYear())),
      };
      const errors = [];
      if (!normalized.periodo) errors.push("Falta periodo");
      if (Number.isNaN(normalized.fechaInicio.getTime())) errors.push("Fecha inicio invalida");
      if (Number.isNaN(normalized.fechaFin.getTime())) errors.push("Fecha fin invalida");
      if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized });
      else validRows.push(normalized);
      continue;
    }

    if (dataset === "roles") {
      const normalized = {
        nombre: String(firstByAliases(row, fieldAliases.rol)).trim(),
      };
      if (!normalized.nombre) invalidRows.push({ row: row._rowNumber, message: "Falta nombre de rol", normalized });
      else validRows.push(normalized);
    }
  }

  return { validRows, invalidRows };
}

function validateCorrectedRow(dataset, row) {
  if (dataset === "employees") {
    const apellido = String(row.apellido || "").trim();
    const nombre = String(row.nombre || "").trim();
    const cargo = String(row.cargo || "").trim();
    const email = String(row.email || "").trim().toLowerCase();
    const legajo = String(row.legajo || row.employeeId || "").trim();
    const roleCode = String(row.roleCode || "").trim().toUpperCase();
    if (!apellido || !nombre || !cargo || (!email && !legajo)) {
      return { ok: false, message: "Faltan apellido, nombre, cargo o identificador (email/legajo)" };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Email invalido" };
    }
    if (roleCode === "SUPER_ADMIN") {
      return { ok: false, message: "No se permite SUPER_ADMIN por importacion" };
    }
    return {
      ok: true,
      row: {
        apellido,
        nombre,
        email,
        legajo,
        roleCode,
        managerRef: String(row.managerRef || row.jefe || "").trim(),
        sede: String(row.sede || "").trim(),
        cargo,
        area: String(row.area || "").trim(),
        tipoempleado: String(row.tipoempleado || "DOCENTE").trim().toUpperCase(),
        activo: String(row.activo || "true").trim().toLowerCase(),
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

async function parseWithAiWebhook(file, dataset) {
  if (!IMPORT_AI_ENABLED || !IMPORT_AI_WEBHOOK_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_AI_TIMEOUT_MS);
  try {
    const form = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
    form.append("file", blob, file.originalname);
    form.append("dataset", dataset || "auto");

    const response = await fetch(IMPORT_AI_WEBHOOK_URL, {
      method: "POST",
      headers: IMPORT_AI_TOKEN ? { Authorization: `Bearer ${IMPORT_AI_TOKEN}` } : {},
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
    const downloadFilter = { ...filter };
    if (req.user.roleCode === "EMPLEADO") {
      downloadFilter.userId = req.user.userId;
    }
    const [schools, employees, evaluations, metrics, plans, downloads] = await Promise.all([
      School.find(filter).sort({ nombre: 1 }).lean(),
      Employee.countDocuments(filter),
      Evaluation.countDocuments(filter),
      Metric.countDocuments(filter),
      DevelopmentPlan.countDocuments(filter),
      DownloadLog.find(downloadFilter).sort({ downloadedAt: -1 }).limit(12).lean(),
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
    if (process.env.NODE_ENV === "production" && !req.user.isSuperAdmin) {
      return res.status(403).json({
        mensaje: "Este endpoint legacy esta deshabilitado para tu rol. Usa flujo subir-validar-confirmar.",
      });
    }
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
      `attachment; filename=\"${config.filename}.xlsx\"`
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

    const { rows, truncated, sheetName, headerRowNumber, headers, worksheetsMeta } = await parseUploadedRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ mensaje: "El archivo no tiene datos" });
    }

    const requestedDataset = String(req.body.dataset || "auto").toLowerCase();
    const manualMappingRaw = req.body.manualMapping;
    let manualMapping = {};
    if (manualMappingRaw) {
      try {
        manualMapping = JSON.parse(manualMappingRaw);
      } catch {
        manualMapping = {};
      }
    }

    let learnedMapping = {};
    if (requestedDataset !== "auto") {
      const settings = await CompanySetting.findOne({ companyId: req.user.companyId }).lean();
      learnedMapping = settings?.importProfiles?.[requestedDataset]?.columnMapping || {};
    }

    const detections = buildColumnDetections(rows, headers, { ...learnedMapping, ...manualMapping });
    const detectedDataset = classifyDatasetByDetections(detections, requestedDataset);
    const analyzeOnly = String(req.body.mode || "").toLowerCase() === "analyze" || String(req.body.analyzeOnly || "").toLowerCase() === "true";

    const criticalByDataset = {
      employees: ["apellido", "nombre", "cargo", "email"],
      metrics: ["competencia", "metrica", "ponderacion"],
      cycles: ["anio", "periodo", "etapa"],
      roles: ["role"],
    };
    const criticalFields = criticalByDataset[detectedDataset] || [];
    const lowConfidenceFields = criticalFields.filter(
      (field) => !detections[field] || (detections[field].confidence || 0) < IMPORT_CONFIDENCE_THRESHOLD
    );

    if (detectedDataset === "unknown") {
      return res.status(422).json({
        ok: false,
        status: "rejected_unrecognized_file",
        detectedDataset,
        mensaje: "No se pudo reconocer la estructura del archivo para importacion.",
        analysis: {
          sheetName,
          headerRowNumber,
          worksheetsMeta,
          detections,
        },
      });
    }

    if (detectedDataset === "narrative") {
      const narrativeData = extractNarrativeData(rows);
      const nameParts = parseNameParts(narrativeData.fullName);
      const previewToken = saveImportPreview({
        dataset: detectedDataset,
        schoolId: req.body.schoolId || req.user.schoolId || null,
        validRows: [],
        invalidRows: [],
        narrativeData,
        fileMeta: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        },
      });

      const extractedSummary = {
        nombre: narrativeData.fullName || "",
        apellido: nameParts.apellido || "",
        cargo: narrativeData.cargo || "",
        area: narrativeData.area || "",
        competenciasDetectadas: narrativeData.competencias.length,
        promedioFinal: narrativeData.promedioFinal || 0,
      };

      return res.json({
        ok: true,
        previewToken,
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
          sheetName,
          headerRowNumber,
          worksheetsMeta,
          detections,
          lowConfidenceFields,
          requiresManualMapping: lowConfidenceFields.length > 0,
        },
      });
    }

    const mappedRows = mapRowsByDetections(rows, detections, detectedDataset);
    const { validRows, invalidRows, warnings, duplicates } = validateRowsForDataset(mappedRows, detectedDataset);
    const requiresManualMapping = lowConfidenceFields.length > 0;
    if (requiresManualMapping && !manualMappingRaw) {
      return res.status(422).json({
        ok: false,
        status: "requires_manual_mapping",
        mensaje: "No se detectaron columnas criticas con suficiente confianza. Confirma mapeo manual.",
        analysis: {
          sheetName,
          headerRowNumber,
          worksheetsMeta,
          detections,
          lowConfidenceFields,
          requiresManualMapping: true,
        },
      });
    }

    if (analyzeOnly) {
      return res.json({
        ok: true,
        analyzeOnly: true,
        datasetDetected: detectedDataset,
        totalRows: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        warningCount: warnings.length + duplicates.length,
        sampleErrors: invalidRows.slice(0, 30),
        sampleWarnings: [...warnings, ...duplicates.map((message) => ({ row: "-", message }))].slice(0, 30),
        analysis: {
          sheetName,
          headerRowNumber,
          worksheetsMeta,
          detections,
          lowConfidenceFields,
          requiresManualMapping,
        },
      });
    }

    const previewToken = saveImportPreview({
      dataset: detectedDataset,
      schoolId: req.body.schoolId || req.user.schoolId || null,
      validRows,
      invalidRows,
      warnings: [...warnings, ...duplicates.map((message) => ({ row: "-", message }))],
      analysis: {
        sheetName,
        headerRowNumber,
        worksheetsMeta,
        detections,
        lowConfidenceFields,
        requiresManualMapping,
      },
      fileMeta: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      },
    });

    res.json({
      ok: true,
      previewToken,
      datasetDetected: detectedDataset,
      totalRows: validRows.length + invalidRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      truncated,
      previewLimit: MAX_PREVIEW_ROWS,
      sampleValidRows: validRows.slice(0, 20),
      sampleErrors: invalidRows.slice(0, 20),
      warningCount: warnings.length + duplicates.length,
      sampleWarnings: [...warnings, ...duplicates.map((message) => ({ row: "-", message }))].slice(0, 20),
      analysis: {
        sheetName,
        headerRowNumber,
        worksheetsMeta,
        detections,
        lowConfidenceFields,
        requiresManualMapping,
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
      return res.status(404).json({
        mensaje: "Preview expirada o inexistente. Vuelve a analizar el archivo.",
        code: "PREVIEW_EXPIRED",
      });
    }

    const confirmMapping = req.body.confirmMapping === true;
    const confirmWarnings = req.body.confirmWarnings === true;
    if (preview.analysis?.requiresManualMapping && !confirmMapping) {
      return res.status(400).json({ mensaje: "Debes confirmar el mapeo manual antes de importar." });
    }
    if ((preview.warnings || []).length > 0 && !confirmWarnings) {
      return res.status(400).json({ mensaje: "Debes confirmar las advertencias antes de importar." });
    }

    const dataset = preview.dataset;
    const { companyId } = await resolveCompanyScope(req);
    const schoolId = preview.schoolId || req.user.schoolId || null;
    const rows = [...preview.validRows];
    const correctedRows = Array.isArray(req.body.correctedRows) ? req.body.correctedRows : [];
    const correctedErrors = [];
    correctedRows.forEach((item, index) => {
      const checked = validateCorrectedRow(dataset, item);
      if (checked.ok) rows.push(checked.row);
      else correctedErrors.push({ row: item.row || `manual-${index + 1}`, message: checked.message });
    });

    const result = {
      total: rows.length + preview.invalidRows.length,
      created: 0,
      updated: 0,
      errors: [...preview.invalidRows, ...correctedErrors],
      warnings: preview.warnings || [],
    };

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
        if (normalizeText(nombre).includes("super_admin")) continue;
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
          legajo: row.legajo || undefined,
          tipoEmpleado: row.tipoempleado || "DOCENTE",
          activo: row.activo !== "false",
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
        if (normalizeText(row.nombre).includes("super_admin")) {
          result.errors.push({ row: "-", message: "No se permite crear SUPER_ADMIN por importacion" });
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
    let uploaded = null;
    if (preview.fileMeta?.bufferBase64) {
      uploaded = await uploadBufferToStorage({
        buffer: Buffer.from(preview.fileMeta.bufferBase64, "base64"),
        contentType: preview.fileMeta.mimetype,
        originalName: preview.fileMeta.originalname,
        folderPath: `performia/${companyId}/${school?.slug || schoolId || "general"}/${dataset}`,
      });
    }

    await DatabaseFile.create({
      companyId,
      schoolId,
      nombreVisible: `Importacion ${dataset} (${new Date().toLocaleDateString("es-AR")})`,
      nombreArchivo: preview.fileMeta.originalname,
      archivo: "",
      extension: preview.fileMeta.originalname.split(".").pop()?.toLowerCase() || "csv",
      mimeType: preview.fileMeta.mimetype,
      tipoArchivo: `importacion-${dataset}`,
      storageProvider: uploaded?.provider || "none",
      storageKey: uploaded?.key || "",
      storageBucket: uploaded?.bucket || "",
      publicUrl: uploaded?.publicUrl || "",
      hoja: dataset,
      registros: result.total,
      activa: true,
    });

    if (preview.analysis?.detections && dataset !== "narrative") {
      const mapping = Object.fromEntries(
        Object.entries(preview.analysis.detections).map(([field, info]) => [field, info.header]).filter(([, header]) => Boolean(header))
      );
      await CompanySetting.findOneAndUpdate(
        { companyId },
        {
          $set: {
            [`importProfiles.${dataset}.columnMapping`]: mapping,
            [`importProfiles.${dataset}.sheetName`]: preview.analysis.sheetName || "",
            [`importProfiles.${dataset}.headerRowNumber`]: preview.analysis.headerRowNumber || 1,
            [`importProfiles.${dataset}.updatedAt`]: new Date(),
          },
        },
        { new: true, upsert: true }
      );
    }

    importPreviewStore.delete(previewToken);
    res.json({ mensaje: "Importacion confirmada", ...result });
  }
);

router.post(
  "/import/:dataset",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_EMPLOYEES, PERMISSIONS.MANAGE_METRICS, PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  upload.single("file"),
  async (req, res) => {
    const dataset = req.params.dataset;
    if (!["employees", "metrics", "cycles"].includes(dataset)) {
      return res.status(400).json({ mensaje: "Dataset no soportado para importacion" });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: "Debes subir un archivo CSV o Excel" });
    }

    const { companyId } = await resolveCompanyScope(req);
    const schoolId = req.body.schoolId || req.user.schoolId || null;
    const parsed = await parseUploadedRows(req.file);
    const rows = parsed.rows || [];

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
        const anio = Number(row.anio || row.año);
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
