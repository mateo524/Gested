import express from "express";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import Metric from "../models/Metric.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import AuditLog from "../models/AuditLog.js";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

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

router.post("/nightly-check", async (req, res) => {
  const token = req.headers["x-automation-token"];
  if (!process.env.AUTOMATION_TOKEN || token !== process.env.AUTOMATION_TOKEN) {
    return res.status(401).json({ mensaje: "Token de automatizacion invalido" });
  }

  const companies = await Company.find({ activa: true }).select("_id nombre").lean();
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

export default router;
