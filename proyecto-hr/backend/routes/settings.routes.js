import express from "express";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

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

  res.json({ mensaje: "Parámetros actualizados", settings });
});

export default router;
