import express from "express";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import DownloadLog from "../models/DownloadLog.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import Metric from "../models/Metric.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

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

export default router;
