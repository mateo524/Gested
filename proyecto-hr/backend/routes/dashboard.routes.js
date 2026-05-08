import express from "express";
import mongoose from "mongoose";
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
import EvaluationScore from "../models/EvaluationScore.js";
import DownloadLog from "../models/DownloadLog.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { Parser } from "json2csv";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import { buildPredictiveInsights, buildLayer3Forecast, simulateTrainingImpact } from "../utils/predictiveInsights.js";

const router = express.Router();

const roleExpectedPermissions = {
  SUPER_ADMIN: ["manage_companies", "manage_users", "manage_roles", "view_global_reports"],
  ADMIN_COLEGIO: ["manage_employees", "manage_metrics", "manage_evaluation_cycles", "view_reports"],
  RRHH: ["manage_employees", "manage_evaluations", "view_reports"],
  JEFE: ["evaluate_team", "view_reports"],
  EMPLEADO: ["self_evaluate"],
  LECTOR: ["read_only_access"],
  LECTOR_AUDITOR: ["read_only_access"],
};

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

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

async function buildDashboardDataScope(req, company) {
  const companyObjectId = company._id;
  const roleCode = req.user?.roleCode || "";
  const schoolObjectId = !req.user?.isSuperAdmin ? toObjectId(req.user?.schoolId) : null;
  const employeeObjectId = toObjectId(req.user?.employeeId);

  const baseFilter = { companyId: companyObjectId };
  if (schoolObjectId) {
    baseFilter.schoolId = schoolObjectId;
  }

  const employeeFilter = { ...baseFilter };
  const evaluationFilter = { ...baseFilter };
  const planFilter = { ...baseFilter };

  if (roleCode === "JEFE") {
    if (!employeeObjectId) {
      employeeFilter._id = { $in: [] };
      evaluationFilter.employeeId = { $in: [] };
      planFilter.employeeId = { $in: [] };
    } else {
      const team = await Employee.find({
        ...baseFilter,
        managerId: employeeObjectId,
        activo: true,
      })
        .select("_id")
        .lean();
      const teamIds = team.map((item) => item._id);
      employeeFilter._id = { $in: teamIds };
      evaluationFilter.employeeId = { $in: teamIds };
      planFilter.employeeId = { $in: teamIds };
    }
  }

  if (roleCode === "EMPLEADO") {
    const selfIds = employeeObjectId ? [employeeObjectId] : [];
    employeeFilter._id = { $in: selfIds };
    evaluationFilter.employeeId = { $in: selfIds };
    planFilter.employeeId = { $in: selfIds };
  }

  return {
    baseFilter,
    employeeFilter,
    evaluationFilter,
    planFilter,
    schoolObjectId,
  };
}

router.get("/summary", auth, async (req, res) => {
  const { company } = await resolveCompanyScope(req);
  const dataScope = await buildDashboardDataScope(req, company);
  const { baseFilter, employeeFilter, evaluationFilter, planFilter } = dataScope;
  const userFilter = { ...baseFilter };
  const auditFilter = { ...baseFilter };
  const fileFilter = { ...baseFilter };
  const recordFilter = { ...baseFilter };
  const roleFilter = { companyId: company._id };

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
    competencyScoreSummary,
    planSignalsRaw,
  ] = await Promise.all([
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, activo: true }),
    Role.countDocuments(roleFilter),
    AuditLog.countDocuments(auditFilter),
    DatabaseFile.countDocuments({ ...fileFilter, activa: true }),
    DatabaseFile.countDocuments(fileFilter),
    Record.countDocuments(recordFilter),
    CompanySetting.findOne({ companyId: company._id }).lean(),
    AuditLog.find(auditFilter).sort({ createdAt: -1 }).limit(6).lean(),
    Record.find(recordFilter).sort({ createdAt: -1 }).limit(600).lean(),
    DatabaseFile.find(fileFilter).sort({ fechaSubida: -1 }).limit(20).lean(),
    School.countDocuments(baseFilter),
    Employee.countDocuments(employeeFilter),
    Employee.countDocuments({ ...employeeFilter, tipoEmpleado: "DOCENTE" }),
    Competency.countDocuments(baseFilter),
    Metric.countDocuments(baseFilter),
    EvaluationCycle.countDocuments({ ...baseFilter, estado: "ABIERTO" }),
    Evaluation.countDocuments(evaluationFilter),
    Evaluation.countDocuments({ ...evaluationFilter, estado: { $in: ["BORRADOR", "ENVIADA"] } }),
    Evaluation.countDocuments({ ...evaluationFilter, resultadoFinal: { $lt: 3 } }),
    Evaluation.aggregate([
      { $match: evaluationFilter },
      { $group: { _id: null, avg: { $avg: "$resultadoFinal" } } },
    ]),
    Evaluation.find(evaluationFilter).sort({ createdAt: -1 }).limit(200).lean(),
    DownloadLog.countDocuments(fileFilter),
    AuditLog.findOne({
      ...auditFilter,
      modulo: "automation",
      accion: "automation_quality_check",
    })
      .sort({ createdAt: -1 })
      .lean(),
    Employee.find(employeeFilter).select("_id area cargo nombre apellido").lean(),
    Evaluation.aggregate([
      { $match: { ...evaluationFilter, resultadoFinal: { $gt: 0 } } },
      { $group: { _id: "$employeeId", avgScore: { $avg: "$resultadoFinal" }, count: { $sum: 1 } } },
    ]),
    EvaluationScore.aggregate([
      {
        $lookup: {
          from: "evaluations",
          localField: "evaluationId",
          foreignField: "_id",
          as: "evaluation",
        },
      },
      { $unwind: "$evaluation" },
      {
        $match: {
          "evaluation.companyId": company._id,
          ...(baseFilter.schoolId ? { "evaluation.schoolId": baseFilter.schoolId } : {}),
          ...(Array.isArray(evaluationFilter.employeeId?.$in)
            ? { "evaluation.employeeId": { $in: evaluationFilter.employeeId.$in } }
            : {}),
        },
      },
      {
        $lookup: {
          from: "metrics",
          localField: "metricId",
          foreignField: "_id",
          as: "metric",
        },
      },
      { $unwind: "$metric" },
      {
        $lookup: {
          from: "competencies",
          localField: "metric.competencyId",
          foreignField: "_id",
          as: "competency",
        },
      },
      {
        $unwind: {
          path: "$competency",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$competency._id",
          competencia: { $first: { $ifNull: ["$competency.nombre", "Competencia"] } },
          total: { $sum: "$nivel" },
          count: { $sum: 1 },
        },
      },
    ]),
    DevelopmentPlan.aggregate([
      { $match: planFilter },
      {
        $group: {
          _id: "$employeeId",
          open: {
            $sum: {
              $cond: [{ $ne: ["$estado", "CERRADO"] }, 1, 0],
            },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$estado", "CERRADO"] },
                    { $lt: ["$fechaSeguimiento", new Date()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
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

  const riskRanking = evaluationByEmployee
    .map((item) => {
      const employee = employeeById.get(String(item._id));
      return employee
        ? {
            employeeId: String(item._id),
            nombre: `${employee.apellido}, ${employee.nombre}`,
            area: employee.area || "Sin area",
            cargo: employee.cargo || "Sin cargo",
            avgScore: Number(item.avgScore.toFixed(2)),
            evaluations: item.count,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 10);

  const trainingRecommendations = competencyScoreSummary
    .map((item) => {
      const avg = item.count ? item.total / item.count : 0;
      return {
        competencia: item.competencia || "Competencia",
        avgScore: Number(avg.toFixed(2)),
        priority: item.count && avg < 3 ? "ALTA" : avg < 3.8 ? "MEDIA" : "BAJA",
        action:
          item.count && avg < 3
            ? "Capacitacion intensiva + mentoring"
            : avg < 3.8
              ? "Refuerzo con talleres practicos"
              : "Mantener y documentar buenas practicas",
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 8);

  const predictiveBase = buildPredictiveInsights({
    weakestAreas,
    strongestAreas,
    riskRanking,
    trainingRecommendations,
    pendingEvaluations,
    evaluationsTotal,
    employeePlanSignals: planSignalsRaw.map((item) => ({
      employeeId: String(item._id),
      open: item.open || 0,
      overdue: item.overdue || 0,
    })),
  });

  const layer3Forecast = await buildLayer3Forecast({
    companyId: company._id,
    patterns: predictiveBase.layer1Patterns,
    predictions: predictiveBase.layer2Predictions,
    trainingRecommendations,
  });

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
      riskRanking,
      trainingRecommendations,
    },
    predictiveInsights: {
      layer1Patterns: predictiveBase.layer1Patterns,
      layer2Predictions: predictiveBase.layer2Predictions,
      layer3Forecast,
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

router.get("/ops-status", auth, async (req, res) => {
  const { company } = await resolveCompanyScope(req);
  const { baseFilter } = await buildDashboardDataScope(req, company);
  const now = new Date();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [latestImport, importsLastHour, downloadsLastHour, usersActive] = await Promise.all([
    DatabaseFile.findOne({ ...baseFilter, tipoArchivo: { $regex: "^importacion-" } })
      .sort({ createdAt: -1, fechaSubida: -1 })
      .lean(),
    DatabaseFile.countDocuments({
      ...baseFilter,
      tipoArchivo: { $regex: "^importacion-" },
      createdAt: { $gte: oneHourAgo },
    }),
    DownloadLog.countDocuments({
      ...baseFilter,
      downloadedAt: { $gte: oneHourAgo },
    }),
    User.countDocuments({ ...baseFilter, activo: true }),
  ]);

  const mongoConnected = mongoose.connection?.readyState === 1;
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );

  res.json({
    generatedAt: now.toISOString(),
    runtime: {
      uptimeSeconds: Math.round(process.uptime()),
      nodeEnv: process.env.NODE_ENV || "development",
      mongoConnected,
      apiHealthy: true,
    },
    integrations: {
      cloudinaryConfigured,
      smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      importAiConfigured: Boolean(process.env.IMPORT_AI_WEBHOOK_URL),
    },
    activity: {
      activeUsers: usersActive,
      importsLastHour,
      downloadsLastHour,
      latestImportAt: latestImport?.createdAt || latestImport?.fechaSubida || null,
      latestImportName: latestImport?.nombreArchivo || latestImport?.nombreVisible || null,
    },
  });
});

router.get("/role-check", auth, async (req, res) => {
  const roleCode = req.user?.roleCode || "UNKNOWN";
  const expected = roleExpectedPermissions[roleCode] || [];
  const current = Array.isArray(req.user?.permisos) ? req.user.permisos : [];
  const grantedExpected = expected.filter((perm) => current.includes(perm));
  const missingExpected = expected.filter((perm) => !current.includes(perm));

  const menuAccess = {
    gestion: current.some((perm) =>
      ["manage_employees", "manage_users", "manage_roles", "manage_metrics", "manage_competencies", "manage_settings"].includes(perm)
    ),
    evaluacion: current.some((perm) => ["manage_evaluations", "evaluate_team", "self_evaluate", "manage_development_plans"].includes(perm)),
    datos: current.some((perm) => ["view_reports", "download_reports", "download_team_reports", "download_self_report", "read_only_access"].includes(perm)),
  };

  res.json({
    roleCode,
    isSuperAdmin: Boolean(req.user?.isSuperAdmin),
    expectedPermissions: expected,
    grantedExpected,
    missingExpected,
    checks: {
      expectedCoveragePct: expected.length ? Math.round((grantedExpected.length / expected.length) * 100) : 100,
      canAccessGestion: menuAccess.gestion,
      canAccessEvaluacion: menuAccess.evaluacion,
      canAccessDatos: menuAccess.datos,
      tenantScoped: !req.user?.isSuperAdmin,
    },
    recommendations:
      missingExpected.length > 0
        ? [`Revisar permisos faltantes para ${roleCode}: ${missingExpected.join(", ")}`]
        : ["Permisos esperados completos para este rol."],
  });
});

router.get("/predictions", auth, async (req, res) => {
  const { company } = await resolveCompanyScope(req);
  const { baseFilter, employeeFilter, evaluationFilter, planFilter } = await buildDashboardDataScope(req, company);

  const [employeesList, evaluationByEmployee, planSignalsRaw, competenciesList, metricsList, evaluationScores, evaluationsTotal, pendingEvaluations] = await Promise.all([
    Employee.find(employeeFilter).select("_id nombre apellido area cargo").lean(),
    Evaluation.aggregate([
      { $match: { ...evaluationFilter, resultadoFinal: { $gt: 0 } } },
      { $group: { _id: "$employeeId", avgScore: { $avg: "$resultadoFinal" }, count: { $sum: 1 } } },
    ]),
    DevelopmentPlan.aggregate([
      { $match: planFilter },
      {
        $group: {
          _id: "$employeeId",
          open: { $sum: { $cond: [{ $ne: ["$estado", "CERRADO"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$estado", "CERRADO"] }, { $lt: ["$fechaSeguimiento", new Date()] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Competency.find(baseFilter).select("_id nombre").lean(),
    Metric.find(baseFilter).select("_id competencyId").lean(),
    EvaluationScore.find({}).populate({ path: "evaluationId", select: "companyId schoolId employeeId" }).lean(),
    Evaluation.countDocuments(evaluationFilter),
    Evaluation.countDocuments({ ...evaluationFilter, estado: { $in: ["BORRADOR", "ENVIADA"] } }),
  ]);

  const employeeById = new Map(employeesList.map((item) => [String(item._id), item]));
  const riskRanking = evaluationByEmployee
    .map((item) => {
      const employee = employeeById.get(String(item._id));
      return employee
        ? {
            employeeId: String(item._id),
            nombre: `${employee.apellido}, ${employee.nombre}`,
            area: employee.area || "Sin area",
            cargo: employee.cargo || "Sin cargo",
            avgScore: Number(item.avgScore.toFixed(2)),
            evaluations: item.count,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 20);

  const metricById = new Map(metricsList.map((item) => [String(item._id), item]));
  const competencyById = new Map(competenciesList.map((item) => [String(item._id), item.nombre]));
  const competencyScores = new Map();
  for (const score of evaluationScores) {
    const evaluation = score.evaluationId;
    if (!evaluation || String(evaluation.companyId) !== String(company._id)) continue;
    if (baseFilter.schoolId && String(evaluation.schoolId) !== String(baseFilter.schoolId)) continue;
    if (
      Array.isArray(evaluationFilter.employeeId?.$in) &&
      !evaluationFilter.employeeId.$in.some((id) => String(id) === String(evaluation.employeeId))
    ) {
      continue;
    }
    const metric = metricById.get(String(score.metricId));
    if (!metric) continue;
    const compName = competencyById.get(String(metric.competencyId)) || "Competencia";
    const current = competencyScores.get(compName) || { total: 0, count: 0 };
    current.total += score.nivel || 0;
    current.count += 1;
    competencyScores.set(compName, current);
  }
  const trainingRecommendations = [...competencyScores.entries()]
    .map(([competencia, value]) => ({
      competencia,
      avgScore: value.count ? Number((value.total / value.count).toFixed(2)) : 0,
      priority: value.count && value.total / value.count < 3 ? "ALTA" : value.total / value.count < 3.8 ? "MEDIA" : "BAJA",
      action:
        value.count && value.total / value.count < 3
          ? "Capacitacion intensiva + mentoring"
          : value.total / value.count < 3.8
            ? "Refuerzo con talleres practicos"
            : "Mantener y documentar buenas practicas",
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 8);

  const syntheticWeakest = trainingRecommendations.slice(0, 3).map((item) => ({
    label: item.competencia,
    value: item.avgScore,
    employees: 0,
  }));
  const syntheticStrongest = [...trainingRecommendations]
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)
    .map((item) => ({ label: item.competencia, value: item.avgScore, employees: 0 }));

  const predictiveBase = buildPredictiveInsights({
    weakestAreas: syntheticWeakest,
    strongestAreas: syntheticStrongest,
    riskRanking,
    trainingRecommendations,
    pendingEvaluations,
    evaluationsTotal,
    employeePlanSignals: planSignalsRaw.map((item) => ({
      employeeId: String(item._id),
      open: item.open || 0,
      overdue: item.overdue || 0,
    })),
  });

  const layer3Forecast = await buildLayer3Forecast({
    companyId: company._id,
    patterns: predictiveBase.layer1Patterns,
    predictions: predictiveBase.layer2Predictions,
    trainingRecommendations,
  });

  res.json({
    companyId: String(company._id),
    generatedAt: new Date().toISOString(),
    layer1Patterns: predictiveBase.layer1Patterns,
    layer2Predictions: predictiveBase.layer2Predictions,
    layer3Forecast,
  });
});

router.get("/simulate-impact", auth, async (req, res) => {
  const { company } = await resolveCompanyScope(req);
  const { baseFilter, evaluationFilter, planFilter } = await buildDashboardDataScope(req, company);
  const competency = String(req.query.competency || "");
  const investment = String(req.query.investment || "media");

  const [evaluationByEmployee, planSignalsRaw, competenciesList, metricsList, evaluationScores] = await Promise.all([
    Evaluation.aggregate([
      { $match: { ...evaluationFilter, resultadoFinal: { $gt: 0 } } },
      { $group: { _id: "$employeeId", avgScore: { $avg: "$resultadoFinal" }, count: { $sum: 1 } } },
    ]),
    DevelopmentPlan.aggregate([
      { $match: planFilter },
      {
        $group: {
          _id: "$employeeId",
          open: { $sum: { $cond: [{ $ne: ["$estado", "CERRADO"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$estado", "CERRADO"] }, { $lt: ["$fechaSeguimiento", new Date()] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Competency.find(baseFilter).select("_id nombre").lean(),
    Metric.find(baseFilter).select("_id competencyId").lean(),
    EvaluationScore.find({}).populate({ path: "evaluationId", select: "companyId schoolId employeeId" }).lean(),
  ]);

  const employeeIds = evaluationByEmployee.map((item) => item._id);
  const employeesList = await Employee.find({ ...baseFilter, _id: { $in: employeeIds } })
    .select("_id nombre apellido area cargo")
    .lean();
  const employeeById = new Map(employeesList.map((item) => [String(item._id), item]));
  const riskRanking = evaluationByEmployee
    .map((item) => {
      const employee = employeeById.get(String(item._id));
      return employee
        ? {
            employeeId: String(item._id),
            nombre: `${employee.apellido}, ${employee.nombre}`,
            area: employee.area || "Sin area",
            cargo: employee.cargo || "Sin cargo",
            avgScore: Number(item.avgScore.toFixed(2)),
            evaluations: item.count,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 30);

  const metricById = new Map(metricsList.map((item) => [String(item._id), item]));
  const competencyById = new Map(competenciesList.map((item) => [String(item._id), item.nombre]));
  const competencyScores = new Map();
  for (const score of evaluationScores) {
    const evaluation = score.evaluationId;
    if (!evaluation || String(evaluation.companyId) !== String(company._id)) continue;
    if (baseFilter.schoolId && String(evaluation.schoolId) !== String(baseFilter.schoolId)) continue;
    if (
      Array.isArray(evaluationFilter.employeeId?.$in) &&
      !evaluationFilter.employeeId.$in.some((id) => String(id) === String(evaluation.employeeId))
    ) {
      continue;
    }
    const metric = metricById.get(String(score.metricId));
    if (!metric) continue;
    const compName = competencyById.get(String(metric.competencyId)) || "Competencia";
    const current = competencyScores.get(compName) || { total: 0, count: 0 };
    current.total += score.nivel || 0;
    current.count += 1;
    competencyScores.set(compName, current);
  }
  const trainingRecommendations = [...competencyScores.entries()]
    .map(([competencia, value]) => ({
      competencia,
      avgScore: value.count ? Number((value.total / value.count).toFixed(2)) : 0,
      priority: value.count && value.total / value.count < 3 ? "ALTA" : value.total / value.count < 3.8 ? "MEDIA" : "BAJA",
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 8);

  const predictiveBase = buildPredictiveInsights({
    weakestAreas: [],
    strongestAreas: [],
    riskRanking,
    trainingRecommendations,
    pendingEvaluations: 0,
    evaluationsTotal: evaluationByEmployee.reduce((sum, item) => sum + Number(item.count || 0), 0),
    employeePlanSignals: planSignalsRaw.map((item) => ({
      employeeId: String(item._id),
      open: item.open || 0,
      overdue: item.overdue || 0,
    })),
  });

  const simulation = simulateTrainingImpact({
    predictions: predictiveBase.layer2Predictions,
    trainingRecommendations,
    competency,
    investment,
  });

  res.json({
    companyId: String(company._id),
    generatedAt: new Date().toISOString(),
    simulation,
  });
});

router.get("/decision-report", auth, async (req, res) => {
  const canDownload =
    req.user?.isSuperAdmin ||
    req.user?.permisos?.some((permission) =>
      ["view_reports", "download_reports", "download_team_reports", "download_self_report"].includes(permission)
    );
  if (!canDownload) {
    return res.status(403).json({ mensaje: "No tienes permiso para descargar este reporte" });
  }

  const summaryReq = {
    ...req,
    query: req.query,
  };
  const { company } = await resolveCompanyScope(summaryReq);
  const { baseFilter, employeeFilter, evaluationFilter } = await buildDashboardDataScope(req, company);

  const [employeesList, evaluationByEmployee, competenciesList, metricsList, evaluationScores] = await Promise.all([
    Employee.find(employeeFilter).select("_id nombre apellido area cargo").lean(),
    Evaluation.aggregate([
      { $match: { ...evaluationFilter, resultadoFinal: { $gt: 0 } } },
      { $group: { _id: "$employeeId", avgScore: { $avg: "$resultadoFinal" }, count: { $sum: 1 } } },
    ]),
    Competency.find(baseFilter).select("_id nombre").lean(),
    Metric.find(baseFilter).select("_id competencyId").lean(),
    EvaluationScore.find({})
      .populate({ path: "evaluationId", select: "companyId schoolId employeeId" })
      .lean(),
  ]);

  const employeeById = new Map(employeesList.map((item) => [String(item._id), item]));
  const riskRows = evaluationByEmployee
    .map((item) => {
      const employee = employeeById.get(String(item._id));
      return employee
        ? {
            tipo: "RIESGO_EMPLEADO",
            nombre: `${employee.apellido}, ${employee.nombre}`,
            area: employee.area || "Sin area",
            cargo: employee.cargo || "Sin cargo",
            score: Number(item.avgScore.toFixed(2)),
            detalle: `Evaluaciones: ${item.count}`,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 25);

  const metricById = new Map(metricsList.map((item) => [String(item._id), item]));
  const competencyById = new Map(competenciesList.map((item) => [String(item._id), item.nombre]));
  const competencyScores = new Map();

  for (const score of evaluationScores) {
    const evaluation = score.evaluationId;
    if (!evaluation || String(evaluation.companyId) !== String(company._id)) continue;
    if (baseFilter.schoolId && String(evaluation.schoolId) !== String(baseFilter.schoolId)) continue;
    if (
      Array.isArray(evaluationFilter.employeeId?.$in) &&
      !evaluationFilter.employeeId.$in.some((id) => String(id) === String(evaluation.employeeId))
    ) {
      continue;
    }
    const metric = metricById.get(String(score.metricId));
    if (!metric) continue;
    const compName = competencyById.get(String(metric.competencyId)) || "Competencia";
    const current = competencyScores.get(compName) || { total: 0, count: 0 };
    current.total += score.nivel || 0;
    current.count += 1;
    competencyScores.set(compName, current);
  }

  const trainingRows = [...competencyScores.entries()]
    .map(([name, value]) => {
      const avg = value.count ? value.total / value.count : 0;
      return {
        tipo: "CAPACITACION_COMPETENCIA",
        nombre: name,
        area: "-",
        cargo: "-",
        score: Number(avg.toFixed(2)),
        detalle: avg < 3 ? "Prioridad ALTA" : avg < 3.8 ? "Prioridad MEDIA" : "Prioridad BAJA",
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 25);

  const role = req.user.roleCode || "ROL";
  const rows = [...riskRows, ...trainingRows];
  const parser = new Parser({ fields: ["tipo", "nombre", "area", "cargo", "score", "detalle"] });
  const csv = parser.parse(rows);

  res.header("Content-Type", "text/csv");
  res.attachment(`reporte-decisiones-${role.toLowerCase()}.csv`);
  return res.send(csv);
});

export default router;
