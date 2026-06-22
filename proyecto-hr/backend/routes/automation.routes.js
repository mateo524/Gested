import express from "express";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import User from "../models/User.js";
import Metric from "../models/Metric.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import AuditLog from "../models/AuditLog.js";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { sendEvaluationReminderEmail } from "../utils/mailer.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

async function runCompanyQualityCheck(companyId) {
  const [employees, evaluations, metrics, plans, duplicateEmails] = await Promise.all([
    Employee.find({ companyId }).lean(),
    Evaluation.countDocuments({ companyId }),
    Metric.countDocuments({ companyId }),
    DevelopmentPlan.countDocuments({ companyId }),
    Employee.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(String(companyId)), email: { $nin: [null, ""] } } },
      { $group: { _id: { $toLower: "$email" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "duplicates" },
    ]),
  ]);

  const missingEmail = employees.filter((item) => !item.email).length;
  const inactive = employees.filter((item) => item.activo === false).length;
  const totalEmployees = employees.length;
  const duplicates = duplicateEmails?.[0]?.duplicates || 0;
  const score = Math.max(
    0,
    Math.round(
      100 -
        (missingEmail * 2 + inactive + duplicates * 5 + (evaluations === 0 ? 10 : 0) + (metrics === 0 ? 10 : 0))
    )
  );

  return {
    totalEmployees,
    missingEmail,
    inactive,
    duplicates,
    evaluations,
    metrics,
    plans,
    score,
  };
}

async function executeQualityChecks(companies) {
  const results = [];
  for (const company of companies) {
    const settings = await CompanySetting.findOne({ companyId: company._id }).lean();
    if (settings?.automations?.nightlyDataCheck === false) continue;

    const summary = await runCompanyQualityCheck(company._id);
    results.push({ companyId: company._id, companyName: company.nombre, summary });

    await AuditLog.create({
      companyId: company._id,
      userId: null,
      accion: "automation_quality_check",
      modulo: "automation",
      detalle: `Control nocturno ejecutado. Score ${summary.score}/100`,
      metadata: summary,
    });
  }
  return results;
}

router.post("/nightly-check", async (req, res) => {
  const token = req.headers["x-automation-token"];
  if (!process.env.AUTOMATION_TOKEN || token !== process.env.AUTOMATION_TOKEN) {
    return res.status(401).json({ mensaje: "Token de automatizacion invalido" });
  }

  const companies = await Company.find({ activa: true }).select("_id nombre").lean();
  const results = await executeQualityChecks(companies);

  res.json({
    mensaje: "Control nocturno ejecutado",
    processed: results.length,
    results,
    executedAt: new Date(),
  });
});

router.get(
  "/quality-latest",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.VIEW_AUDIT),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    const latest = await AuditLog.findOne({
      companyId,
      modulo: "automation",
      accion: "automation_quality_check",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      latest: latest
        ? {
            createdAt: latest.createdAt,
            detalle: latest.detalle,
            metrics: latest.metadata || {},
          }
        : null,
    });
  }
);

router.post(
  "/run-now",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_COMPANIES, PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ mensaje: "Solo superadmin puede ejecutar control global" });
    }

    const companies = await Company.find({ activa: true }).select("_id nombre").lean();
    const results = await executeQualityChecks(companies);
    res.json({
      mensaje: "Control ejecutado manualmente",
      processed: results.length,
      results,
      executedAt: new Date(),
    });
  }
);

router.get(
  "/quality-by-company",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_COMPANIES, PERMISSIONS.VIEW_GLOBAL_REPORTS),
  async (req, res) => {
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ mensaje: "Solo superadmin puede ver calidad global" });
    }

    const companies = await Company.find({}).select("_id nombre slug activa").lean();
    const items = await Promise.all(
      companies.map(async (company) => {
        const latest = await AuditLog.findOne({
          companyId: company._id,
          modulo: "automation",
          accion: "automation_quality_check",
        })
          .sort({ createdAt: -1 })
          .lean();

        return {
          companyId: company._id,
          nombre: company.nombre,
          slug: company.slug,
          activa: company.activa,
          score: latest?.metadata?.score ?? null,
          missingEmail: latest?.metadata?.missingEmail ?? 0,
          duplicates: latest?.metadata?.duplicates ?? 0,
          checkedAt: latest?.createdAt || null,
        };
      })
    );

    res.json({ items });
  }
);

router.get(
  "/quality-trend",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.VIEW_AUDIT),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    const days = Math.min(Math.max(Number(req.query.days || 30), 7), 90);
    const from = new Date();
    from.setDate(from.getDate() - days);

    const logs = await AuditLog.find({
      companyId,
      modulo: "automation",
      accion: "automation_quality_check",
      createdAt: { $gte: from },
    })
      .sort({ createdAt: 1 })
      .lean();

    const trend = logs.map((log) => ({
      date: new Date(log.createdAt).toLocaleDateString("es-AR"),
      score: log.metadata?.score ?? 0,
      missingEmail: log.metadata?.missingEmail ?? 0,
      duplicates: log.metadata?.duplicates ?? 0,
    }));

    res.json({ days, trend });
  }
);

// ── Cycle closing reminders — triggered by Cloud Scheduler daily ───────────
// Finds all ABIERTO cycles closing in ≤3 days, sends reminder to users
// with pending evaluations in those cycles.
router.post("/cycle-reminders", async (req, res) => {
  const token = req.headers["x-automation-token"];
  if (!process.env.AUTOMATION_TOKEN || token !== process.env.AUTOMATION_TOKEN) {
    return res.status(401).json({ mensaje: "Token de automatizacion invalido" });
  }

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Cycles that are ABIERTO and close within the next 3 days
  const closingSoon = await EvaluationCycle.find({
    estado: "ABIERTO",
    fechaFin: { $gte: now, $lte: in3Days },
  }).lean();

  if (!closingSoon.length) {
    return res.json({ mensaje: "Sin ciclos por cerrar", sent: 0, executedAt: now });
  }

  let totalSent = 0;
  const details = [];

  for (const cycle of closingSoon) {
    // Find users in this company with PENDIENTE evaluations in this cycle
    const pendingEvals = await Evaluation.find({
      companyId: cycle.companyId,
      cycleId: cycle._id,
      estado: { $in: ["BORRADOR", "ENVIADA"] },
    }).select("evaluatorUserId").lean();

    if (!pendingEvals.length) continue;

    const evaluadorIds = [...new Set(pendingEvals.map(e => String(e.evaluatorUserId)).filter(Boolean))];
    const users = await User.find({
      _id: { $in: evaluadorIds },
      activo: true,
    }).select("email nombre").lean();

    for (const user of users) {
      const count = pendingEvals.filter(e => String(e.evaluatorUserId) === String(user._id)).length;
      try {
        await sendEvaluationReminderEmail({
          to: user.email,
          nombre: user.nombre,
          pendingCount: count,
          cycleEndDate: cycle.fechaFin,
        });
        totalSent++;
      } catch (err) {
        logger.error("[automation] reminder email failed", { userId: user._id, err: err.message });
      }
    }

    details.push({ cycleId: cycle._id, periodo: cycle.periodo, notified: users.length });
  }

  res.json({ mensaje: "Recordatorios enviados", sent: totalSent, cycles: details, executedAt: now });
});

export default router;
