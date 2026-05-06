import express from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import AuditLog from "../models/AuditLog.js";
import CompanySetting from "../models/CompanySetting.js";
import DatabaseFile from "../models/DatabaseFile.js";
import Record from "../models/Record.js";
import Company from "../models/Company.js";
import School from "../models/School.js";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import Metric from "../models/Metric.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Evaluation from "../models/Evaluation.js";
import DownloadLog from "../models/DownloadLog.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

function groupCount(items, key, fallback = "Sin dato") {
  const map = new Map();

  items.forEach((item) => {
    const value = item?.[key] ? String(item[key]).trim() : fallback;
    map.set(value || fallback, (map.get(value || fallback) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function groupTimeline(items) {
  const map = new Map();

  items.forEach((item) => {
    const date = new Date(item.createdAt);
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    map.set(label, (map.get(label) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

router.get("/summary", auth, async (req, res) => {
  const { companyId, company } = await resolveCompanyScope(req);

  const [
    usersTotal,
    activeUsers,
    rolesTotal,
    auditEvents,
    activeFiles,
    totalFiles,
    recordsTotal,
    settings,
    latestAudit,
    recentRecords,
    files,
    schoolsCount,
    employeesTotal,
    docentesTotal,
    competenciesTotal,
    metricsTotal,
    activeCyclesCount,
    evaluationsTotal,
    pendingEvaluations,
    lowPerformanceCount,
    averageEvaluation,
    recentEvaluations,
    downloadEvents,
    latestQualityRun,
    employeesList,
    evaluationByEmployee,
  ] = await Promise.all([
    User.countDocuments({ companyId }),
    User.countDocuments({ companyId, activo: true }),
    Role.countDocuments({ companyId }),
    AuditLog.countDocuments({ companyId }),
    DatabaseFile.countDocuments({ companyId, activa: true }),
    DatabaseFile.countDocuments({ companyId }),
    Record.countDocuments({ companyId }),
    CompanySetting.findOne({ companyId }).lean(),
    AuditLog.find({ companyId }).sort({ createdAt: -1 }).limit(6).lean(),
    Record.find({ companyId }).sort({ createdAt: -1 }).limit(2000).lean(),
    DatabaseFile.find({ companyId }).sort({ fechaSubida: -1 }).limit(20).lean(),
    School.countDocuments({ companyId }),
    Employee.countDocuments({ companyId }),
    Employee.countDocuments({ companyId, tipoEmpleado: "DOCENTE" }),
    Competency.countDocuments({ companyId }),
    Metric.countDocuments({ companyId }),
    EvaluationCycle.countDocuments({ companyId, estado: "ABIERTO" }),
    Evaluation.countDocuments({ companyId }),
    Evaluation.countDocuments({ companyId, estado: { $in: ["BORRADOR", "ENVIADA"] } }),
    Evaluation.countDocuments({ companyId, resultadoFinal: { $lt: 3 } }),
    Evaluation.aggregate([
      { $match: { companyId: company._id } },
      { $group: { _id: null, avg: { $avg: "$resultadoFinal" } } },
    ]),
    Evaluation.find({ companyId }).sort({ createdAt: -1 }).limit(200).lean(),
    DownloadLog.countDocuments({ companyId }),
    AuditLog.findOne({
      companyId,
      modulo: "automation",
      accion: "automation_quality_check",
    })
      .sort({ createdAt: -1 })
      .lean(),
    Employee.find({ companyId }).select("_id area cargo nombre apellido").lean(),
    Evaluation.aggregate([
      { $match: { companyId: company._id, resultadoFinal: { $gt: 0 } } },
      { $group: { _id: "$employeeId", avgScore: { $avg: "$resultadoFinal" }, count: { $sum: 1 } } },
    ]),
  ]);

  let superAdmin = null;
  if (req.user.isSuperAdmin) {
    const companies = await Company.find().select("tipoCliente activa").lean();
    const typeMap = new Map();
    companies.forEach((item) => {
      const label = item.tipoCliente || "general";
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });

    superAdmin = {
      totalCompanies: companies.length,
      activeCompanies: companies.filter((item) => item.activa).length,
      clientTypes: [...typeMap.entries()].map(([label, value]) => ({ label, value })),
    };
  }

  const roleDistribution = groupCount(recentRecords, "rol").slice(0, 8);
  const importTimeline = groupTimeline(files.map((file) => ({ createdAt: file.fechaSubida })));
  const fileRanking = files
    .map((file) => ({ label: file.nombreVisible, value: file.registros || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const evaluationTimeline = groupTimeline(recentEvaluations);
  const evaluationStates = groupCount(recentEvaluations, "estado").slice(0, 6);

  const employeeById = new Map(employeesList.map((item) => [String(item._id), item]));
  const byArea = new Map();
  evaluationByEmployee.forEach((row) => {
    const employee = employeeById.get(String(row._id));
    if (!employee) return;
    const area = (employee.area || "Sin area").trim();
    const current = byArea.get(area) || { totalScore: 0, totalWeight: 0, employees: 0 };
    current.totalScore += row.avgScore * row.count;
    current.totalWeight += row.count;
    current.employees += 1;
    byArea.set(area, current);
  });

  const areaInsights = [...byArea.entries()]
    .map(([label, value]) => ({
      label,
      avg: value.totalWeight ? value.totalScore / value.totalWeight : 0,
      employees: value.employees,
    }))
    .sort((a, b) => a.avg - b.avg);

  const weakestAreas = areaInsights.slice(0, 3).map((item) => ({
    label: item.label,
    value: Number(item.avg.toFixed(2)),
    employees: item.employees,
  }));
  const strongestAreas = [...areaInsights]
    .reverse()
    .slice(0, 3)
    .map((item) => ({
      label: item.label,
      value: Number(item.avg.toFixed(2)),
      employees: item.employees,
    }));

  res.json({
    cards: [
      { label: "Empleados", value: employeesTotal, hint: `${docentesTotal} docentes registrados` },
      { label: "Evaluaciones", value: evaluationsTotal, hint: `${pendingEvaluations} pendientes o abiertas` },
      { label: "Ciclos activos", value: activeCyclesCount, hint: `${schoolsCount} colegios vinculados` },
      {
        label: "Promedio general",
        value: averageEvaluation[0]?.avg ? Number(averageEvaluation[0].avg).toFixed(2) : "0.00",
        hint: `${lowPerformanceCount} con desempeño crítico`,
      },
    ],
    latestAudit,
    company: {
      nombreVisible: settings?.nombreVisible || "Empresa Demo",
      legalName: company?.nombre || "Empresa Demo",
      primaryColor: settings?.primaryColor || "#10b981",
    },
    security: {
      totalAuditEvents: auditEvents,
      tokenWindow: "8 horas",
      permissionsInSession: req.user.permisos?.length || 0,
    },
    charts: {
      roleDistribution,
      importTimeline,
      fileRanking,
      evaluationTimeline,
      evaluationStates,
    },
    decisionInsights: {
      weakestAreas,
      strongestAreas,
    },
    educational: {
      schoolsCount,
      usersTotal,
      activeUsers,
      rolesTotal,
      competenciesTotal,
      metricsTotal,
      activeFiles,
      totalFiles,
      recordsTotal,
      evaluationsTotal,
      pendingEvaluations,
      lowPerformanceCount,
      averageScore: averageEvaluation[0]?.avg || 0,
      downloadEvents,
    },
    alerts: latestQualityRun
      ? {
          latestQualityRunAt: latestQualityRun.createdAt,
          score: latestQualityRun.metadata?.score ?? null,
          isLow: typeof latestQualityRun.metadata?.score === "number" ? latestQualityRun.metadata.score < 70 : false,
          summary: latestQualityRun.detalle || "",
          missingEmail: latestQualityRun.metadata?.missingEmail ?? 0,
          duplicates: latestQualityRun.metadata?.duplicates ?? 0,
        }
      : null,
    superAdmin,
  });
});

export default router;
