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
import DatabaseFile from "../models/DatabaseFile.js";
import Announcement from "../models/Announcement.js";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { uploadBufferToStorage } from "../utils/storageProvider.js";

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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function sanitizeHeader(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
};

function firstByAliases(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

async function parseUploadedRows(file) {
  const workbook = new ExcelJS.Workbook();
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".csv")) {
    await workbook.csv.readBuffer(file.buffer);
  } else {
    await workbook.xlsx.load(file.buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = worksheet
    .getRow(1)
    .values.slice(1)
    .map((value) => sanitizeHeader(value));

  const rows = [];
  let truncated = false;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_PREVIEW_ROWS) {
      truncated = true;
      return;
    }
    const values = row.values.slice(1);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index];
    });
    rows.push({ ...item, _rowNumber: rowNumber });
  });

  return { rows, truncated };
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
    if (!apellido || !nombre || !cargo) {
      return { ok: false, message: "Faltan apellido, nombre o cargo" };
    }
    return {
      ok: true,
      row: {
        apellido,
        nombre,
        email: String(row.email || "").trim().toLowerCase(),
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

    const { rows, truncated } = await parseUploadedRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ mensaje: "El archivo no tiene datos" });
    }

    const requestedDataset = String(req.body.dataset || "auto").toLowerCase();
    const detectedDataset = classifyDataset(rows, requestedDataset);

    if (detectedDataset === "narrative" || detectedDataset === "unknown") {
      return res.status(422).json({
        ok: false,
        status: "rejected_non_structured_file",
        detectedDataset,
        mensaje: "El archivo parece narrativo o no estructurado. Usa una plantilla tabular de importacion.",
      });
    }

    const { validRows, invalidRows } = normalizeRowsForDataset(rows, detectedDataset);
    const previewToken = saveImportPreview({
      dataset: detectedDataset,
      schoolId: req.body.schoolId || req.user.schoolId || null,
      validRows,
      invalidRows,
      fileMeta: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        bufferBase64: req.file.buffer.toString("base64"),
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
      return res.status(400).json({ mensaje: "Preview expirada o inexistente. Vuelve a subir el archivo." });
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
    };

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
      buffer: Buffer.from(preview.fileMeta.bufferBase64, "base64"),
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
    const rows = await parseUploadedRows(req.file);

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
