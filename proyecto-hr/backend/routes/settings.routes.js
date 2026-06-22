import express from "express";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { logAudit } from "../utils/audit.js";
import { notifyClientSlack } from "../utils/clientSlack.js";

const router = express.Router();

router.get("/public/:slug", async (req, res) => {
  const company = await Company.findOne({ slug: req.params.slug.trim() }).lean();

  if (!company) {
    return res.status(404).json({ mensaje: "Empresa no encontrada" });
  }

  const settings = await CompanySetting.findOne({ companyId: company._id }).lean();
  res.json({
    company: {
      _id: company._id,
      nombre: company.nombre,
      slug: company.slug,
      tipoCliente: company.tipoCliente || "general",
    },
    settings: settings || null,
  });
});

router.get("/", auth, async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const settings = await CompanySetting.findOne({ companyId });
  res.json(settings);
});

router.put("/", auth, permit("manage_settings"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);

  const ALLOWED_FIELDS = [
    "nombreVisible",
    "logoUrl",
    "primaryColor",
    "maxUploadSizeMb",
    "defaultEmailDomain",
    "defaultEmployeeRoleCode",
    "automations",
    "slackWebhookUrl",
    "importProfiles",
    "onboarding",
  ];

  const updateData = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updateData[field] = req.body[field];
    }
  }

  const settings = await CompanySetting.findOneAndUpdate(
    { companyId },
    { ...updateData, companyId },
    { upsert: true, new: true }
  );

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "actualizacion",
    modulo: "parametros",
    detalle: "Se actualizaron parametros de la empresa",
  });

  res.json({ mensaje: "Parametros actualizados", settings });
});

router.post("/test-slack", auth, permit("manage_settings"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const settings = await CompanySetting.findOne({ companyId }).select("slackWebhookUrl").lean();

  if (!settings?.slackWebhookUrl) {
    return res.status(400).json({ mensaje: "No hay una Slack Webhook URL configurada para esta organización." });
  }

  await notifyClientSlack(companyId, "✅ *ZENTOR* — Conexión de Slack verificada correctamente. Las alertas de evaluaciones y ciclos llegarán aquí.");
  res.json({ mensaje: "Mensaje de prueba enviado." });
});

export default router;
