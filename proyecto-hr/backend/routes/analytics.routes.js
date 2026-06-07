import express from "express";
import Company from "../models/Company.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import { auth } from "../middleware/auth.js";

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

export default router;
