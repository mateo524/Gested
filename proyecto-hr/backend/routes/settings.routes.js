import express from "express";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const settings = await CompanySetting.findOne({ companyId });
  res.json(settings);
});

router.put("/", auth, permit("manage_settings"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const settings = await CompanySetting.findOneAndUpdate(
    { companyId },
    { ...req.body, companyId },
    { upsert: true, new: true }
  );

  await logAudit({
    companyId,
    userId: req.user.id,
    accion: "actualizacion",
    modulo: "parametros",
    detalle: "Se actualizaron parametros de la empresa",
  });

  res.json({ mensaje: "Parametros actualizados", settings });
});

export default router;
