import express from "express";
import Announcement from "../models/Announcement.js";
import Company from "../models/Company.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  if (req.user.isSuperAdmin) {
    const companyId = req.query.companyId?.trim();
    const filters = {};
    if (companyId) filters.companyId = companyId;

    const [announcements, companies] = await Promise.all([
      Announcement.find(filters).sort({ createdAt: -1 }).limit(300).lean(),
      Company.find().select("nombre slug activa").sort({ nombre: 1 }).lean(),
    ]);

    return res.json({ announcements, companies });
  }

  const { companyId } = await resolveCompanyScope(req);
  const announcements = await Announcement.find({ companyId, visible: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ announcements, companies: [] });
});

router.post("/", auth, permit("manage_companies"), async (req, res) => {
  const { companyId, titulo, cuerpo, prioridad = "informativa", categoria = "general" } = req.body;

  if (!companyId || !titulo?.trim() || !cuerpo?.trim()) {
    return res.status(400).json({ mensaje: "Debes completar empresa, titulo y contenido" });
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    return res.status(404).json({ mensaje: "Empresa no encontrada" });
  }

  const announcement = await Announcement.create({
    companyId,
    authorUserId: req.user.userId,
    titulo: titulo.trim(),
    cuerpo: cuerpo.trim(),
    prioridad,
    categoria,
    visible: true,
  });

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "create",
    modulo: "novedades",
    detalle: `Se envio una novedad a ${company.nombre}: ${announcement.titulo}`,
  });

  res.status(201).json({ mensaje: "Novedad enviada", announcement });
});

router.put("/:id/visibility", auth, permit("manage_companies"), async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    return res.status(404).json({ mensaje: "Novedad no encontrada" });
  }

  announcement.visible =
    typeof req.body.visible === "boolean" ? req.body.visible : !announcement.visible;
  await announcement.save();

  await logAudit({
    companyId: announcement.companyId,
    userId: req.user.userId,
    accion: "update",
    modulo: "novedades",
    detalle: `La novedad ${announcement.titulo} quedo ${announcement.visible ? "visible" : "oculta"}`,
  });

  res.json({ mensaje: "Visibilidad actualizada", announcement });
});

export default router;
