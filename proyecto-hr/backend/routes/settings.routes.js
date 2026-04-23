import express from "express";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const settings = await CompanySetting.findOne({ companyId: req.user.companyId });
  res.json(settings);
});

router.put("/", auth, permit("manage_settings"), async (req, res) => {
  const settings = await CompanySetting.findOneAndUpdate(
    { companyId: req.user.companyId },
    { ...req.body, companyId: req.user.companyId },
    { upsert: true, new: true }
  );

  res.json({ mensaje: "Parámetros actualizados", settings });
});

export default router;