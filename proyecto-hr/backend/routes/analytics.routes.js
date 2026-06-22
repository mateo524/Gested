import express from "express";
import Company from "../models/Company.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import EvaluationScore from "../models/EvaluationScore.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import NpsResponse from "../models/NpsResponse.js";

const router = express.Router();

function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ ok: false, message: "Solo el superadmin puede acceder a esta sección." });
  }
  return next();
}

router.get("/usage", auth, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last 6 months — build list of { year, month } pairs oldest-first
    const monthSlots = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthSlots.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }

    const [
      totalOrgs,
      totalUsers,
      totalEmployees,
      totalEvaluations,
      evaluationsThisMonth,
      totalDevelopmentPlans,
      totalCycles,
      // orgs that had at least 1 evaluation in last 30 days
      activeOrgIds,
      // evaluations by month (last 6 months)
      evalsByMonthRaw,
      // top companies for org activity
      allCompanies,
      // role distribution across all users
      roleDistributionRaw,
    ] = await Promise.all([
      Company.countDocuments({}),
      User.countDocuments({}),
      Employee.countDocuments({}),
      Evaluation.countDocuments({}),
      Evaluation.countDocuments({ createdAt: { $gte: startOfMonth } }),
      DevelopmentPlan.countDocuments({}),
      EvaluationCycle.countDocuments({}),
      // distinct companyIds from evaluations in last 30 days
      Evaluation.distinct("companyId", { createdAt: { $gte: thirtyDaysAgo } }),
      // evaluations grouped by year+month for last 6 months
      Evaluation.aggregate([
        {
          $match: {
            createdAt: { $gte: monthSlots[0] ? new Date(`${monthSlots[0].year}-${String(monthSlots[0].month).padStart(2, "0")}-01`) : thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      // all companies for org activity table
      Company.find({}).select("_id nombre").lean(),
      // role distribution — group users by roleCode or roleKey
      User.aggregate([
        {
          $lookup: {
            from: "roles",
            localField: "roleId",
            foreignField: "_id",
            as: "role",
          },
        },
        { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$role.codigo", "$role.key", "SIN_ROL"] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build activeOrgs count
    const activeOrgs = activeOrgIds.length;

    // Build evaluationsByMonth — fill slots with 0 where no data
    const evalMonthMap = new Map(evalsByMonthRaw.map((row) => [row._id, row.count]));
    const evaluationsByMonth = monthSlots.map((slot) => ({
      month: slot.label,
      count: evalMonthMap.get(slot.label) || 0,
    }));

    // Build roleDistribution
    const roleDistribution = {};
    for (const row of roleDistributionRaw) {
      if (row._id) roleDistribution[row._id] = row.count;
    }
    // Also add superadmin count
    const superAdminCount = await User.countDocuments({ isSuperAdmin: true });
    if (superAdminCount > 0) roleDistribution["SUPER_ADMIN"] = superAdminCount;

    // Build orgActivity — per-company stats (top 10 by evaluations)
    const companyIds = allCompanies.map((c) => c._id);

    const [employeesByOrg, evaluationsByOrg, closedEvalsByOrg, latestEvalByOrg] = await Promise.all([
      // employees per org
      Employee.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
      // total evaluations per org
      Evaluation.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
      // closed evaluations per org
      Evaluation.aggregate([
        { $match: { companyId: { $in: companyIds }, estado: { $in: ["REVISADA", "CERRADA"] } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
      // latest evaluation per org
      Evaluation.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$companyId", lastActivity: { $first: "$createdAt" } } },
      ]),
    ]);

    const employeeMap = new Map(employeesByOrg.map((r) => [String(r._id), r.count]));
    const evalMap = new Map(evaluationsByOrg.map((r) => [String(r._id), r.count]));
    const closedMap = new Map(closedEvalsByOrg.map((r) => [String(r._id), r.count]));
    const latestMap = new Map(latestEvalByOrg.map((r) => [String(r._id), r.lastActivity]));

    const orgActivity = allCompanies
      .map((company) => {
        const key = String(company._id);
        const evaluations = evalMap.get(key) || 0;
        const closed = closedMap.get(key) || 0;
        const lastActivityDate = latestMap.get(key) || null;
        return {
          nombre: company.nombre,
          employees: employeeMap.get(key) || 0,
          evaluations,
          lastActivity: lastActivityDate ? lastActivityDate.toISOString().slice(0, 10) : null,
          completionRate: evaluations > 0 ? Number((closed / evaluations).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.evaluations - a.evaluations)
      .slice(0, 10);

    return res.json({
      ok: true,
      overview: {
        totalOrgs,
        activeOrgs,
        totalUsers,
        totalEmployees,
        totalEvaluations,
        evaluationsThisMonth,
      },
      orgActivity,
      evaluationsByMonth,
      featureUsage: {
        evaluations: totalEvaluations,
        developmentPlans: totalDevelopmentPlans,
        cycles: totalCycles,
        reports: totalCycles, // approximation — no ExecutiveReport model
      },
      roleDistribution,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No pudimos generar el reporte de analytics.",
    });
  }
});

// ── Anomaly Detection (rule-based) ────────────────────────────────────────────
// GET /analytics/anomalies?companyId=
// Returns evaluations with suspicious patterns: all-same scores, outlier scores,
// no evaluations for active employees, stale open evaluations.
router.get("/anomalies", auth, attachTenantScope, async (req, res) => {
  try {
    const companyId = req.query.companyId || req.scope?.companyId;
    if (!companyId) return res.status(400).json({ ok: false, message: "companyId requerido." });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [evaluations, scores, employees] = await Promise.all([
      Evaluation.find({ companyId }).select("_id employeeId estado createdAt cycleId").lean(),
      EvaluationScore.find({ companyId }).select("evaluationId nivel").lean(),
      Employee.find({ companyId, activo: true }).select("_id nombre apellido").lean(),
    ]);

    const anomalies = [];

    // Rule 1: Stale open evaluations (open > 30 days)
    for (const ev of evaluations) {
      if (["BORRADOR", "ENVIADA"].includes(ev.estado) && ev.createdAt < thirtyDaysAgo) {
        anomalies.push({
          type: "stale_evaluation",
          severity: "medium",
          evaluationId: String(ev._id),
          employeeId: String(ev.employeeId),
          detail: "Evaluación abierta hace más de 30 días sin cerrar.",
        });
      }
    }

    // Rule 2: All-same scores (monotone responses)
    const scoresByEval = new Map();
    for (const s of scores) {
      const key = String(s.evaluationId);
      if (!scoresByEval.has(key)) scoresByEval.set(key, []);
      scoresByEval.get(key).push(Number(s.nivel));
    }
    for (const [evalId, niveles] of scoresByEval.entries()) {
      if (niveles.length >= 3) {
        const allSame = niveles.every((n) => n === niveles[0]);
        if (allSame) {
          anomalies.push({
            type: "all_same_scores",
            severity: "low",
            evaluationId: evalId,
            detail: `Todos los scores son ${niveles[0]} (posible respuesta sin reflexión).`,
          });
        }
        // Rule 3: Outlier — all 1s or all 5s in a large eval
        const avg = niveles.reduce((a, b) => a + b, 0) / niveles.length;
        if (avg <= 1.3 || avg >= 4.8) {
          anomalies.push({
            type: "outlier_scores",
            severity: "medium",
            evaluationId: evalId,
            detail: `Puntaje promedio extremo: ${avg.toFixed(1)}. Revisar si es consistente.`,
          });
        }
      }
    }

    // Rule 4: Employees with no evaluations at all
    const evaluatedEmployeeIds = new Set(evaluations.map((e) => String(e.employeeId)));
    for (const emp of employees) {
      if (!evaluatedEmployeeIds.has(String(emp._id))) {
        anomalies.push({
          type: "no_evaluations",
          severity: "low",
          employeeId: String(emp._id),
          employeeName: [emp.apellido, emp.nombre].filter(Boolean).join(", "),
          detail: "Empleado activo sin ninguna evaluación registrada.",
        });
      }
    }

    res.json({ ok: true, total: anomalies.length, anomalies });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── NPS ──────────────────────────────────────────────────────────────────────
router.post("/nps", auth, async (req, res) => {
  try {
    const { score, comment = "" } = req.body;
    if (typeof score !== "number" || score < 0 || score > 10) {
      return res.status(400).json({ ok: false, message: "Score inválido." });
    }
    await NpsResponse.create({ userId: req.user.userId, score, comment: String(comment).slice(0, 500) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get("/nps", auth, async (req, res) => {
  try {
    if (!req.user?.isSuperAdmin) return res.status(403).json({ ok: false });
    const responses = await NpsResponse.find().sort({ createdAt: -1 }).limit(200).lean();
    const avg = responses.length ? responses.reduce((s, r) => s + r.score, 0) / responses.length : null;
    const promoters = responses.filter(r => r.score >= 9).length;
    const detractors = responses.filter(r => r.score <= 6).length;
    const npsScore = responses.length ? Math.round(((promoters - detractors) / responses.length) * 100) : null;
    res.json({ ok: true, npsScore, avg, total: responses.length, responses });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
