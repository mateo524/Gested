import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import Announcement from "../models/Announcement.js";
import Company from "../models/Company.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();
const uploadsDir = path.resolve("uploads", "announcements");

await fs.mkdir(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
});

function mapAnnouncement(item, currentUserId) {
  const hasRead = item.readBy?.some((entry) => String(entry.userId) === String(currentUserId));
  return {
    ...item,
    isRead: !!hasRead,
  };
}

router.get("/", auth, async (req, res) => {
  if (req.user.isSuperAdmin) {
    const companyId = req.query.companyId?.trim();
    const filters = {};
    if (companyId) filters.companyId = companyId;

    const [announcements, companies] = await Promise.all([
      Announcement.find(filters).sort({ createdAt: -1 }).limit(300).lean(),
      Company.find().select("nombre slug activa").sort({ nombre: 1 }).lean(),
    ]);

    return res.json({
      announcements: announcements.map((item) => mapAnnouncement(item, req.user.userId)),
      companies,
      unreadCount: 0,
    });
  }

  const { companyId } = await resolveCompanyScope(req);
  const announcements = await Announcement.find({ companyId, visible: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const mapped = announcements.map((item) => mapAnnouncement(item, req.user.userId));

  res.json({
    announcements: mapped,
    companies: [],
    unreadCount: mapped.filter((item) => !item.isRead).length,
  });
});

router.get("/summary", auth, async (req, res) => {
  if (req.user.isSuperAdmin) {
    const companies = await Company.find().select("nombre slug activa").sort({ nombre: 1 }).lean();
    return res.json({ unreadCount: 0, latest: [], companies });
  }

  const { companyId } = await resolveCompanyScope(req);
  const announcements = await Announcement.find({ companyId, visible: true })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const mapped = announcements.map((item) => mapAnnouncement(item, req.user.userId));

  res.json({
    unreadCount: mapped.filter((item) => !item.isRead).length,
    latest: mapped,
  });
});

router.post(
  "/",
  auth,
  requireSuperAdmin,
  permit("manage_companies"),
  upload.array("attachments", 5),
  async (req, res) => {
    const {
      companyId,
      titulo,
      cuerpo,
      prioridad = "informativa",
      categoria = "general",
    } = req.body;

    if (!companyId || !titulo?.trim() || !cuerpo?.trim()) {
      return res.status(400).json({ mensaje: "Debes completar empresa, titulo y contenido" });
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    const attachments = (req.files || []).map((file) => ({
      nombreOriginal: file.originalname,
      nombreArchivo: file.filename,
      mimeType: file.mimetype,
      extension: path.extname(file.originalname).replace(".", "").toLowerCase(),
      tipoArchivo: "documento",
    }));

    const announcement = await Announcement.create({
      companyId,
      authorUserId: req.user.userId,
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      prioridad,
      categoria,
      visible: true,
      attachments,
    });

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "create",
      modulo: "novedades",
      detalle: `Se envio una novedad a ${company.nombre}: ${announcement.titulo}`,
    });

    res.status(201).json({ mensaje: "Novedad enviada", announcement });
  }
);

router.post("/:id/read", auth, async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    return res.status(404).json({ mensaje: "Novedad no encontrada" });
  }

  if (!req.user.isSuperAdmin && String(announcement.companyId) !== String(req.user.companyId)) {
    return res.status(403).json({ mensaje: "No tienes acceso a esta novedad" });
  }

  const exists = announcement.readBy.some(
    (entry) => String(entry.userId) === String(req.user.userId)
  );

  if (!exists) {
    announcement.readBy.push({
      userId: req.user.userId,
      readAt: new Date(),
    });
    await announcement.save();
  }

  res.json({ mensaje: "Novedad marcada como leida" });
});

router.put("/:id/visibility", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
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
