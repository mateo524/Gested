import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import DatabaseFile from "../models/DatabaseFile.js";
import Company from "../models/Company.js";
import Record from "../models/Record.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();
const uploadsDir = path.resolve("uploads", "storage");

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
  limits: { fileSize: 20 * 1024 * 1024 },
});

function inferType(file) {
  if (file.tipoArchivo) return file.tipoArchivo;
  const extension = file.nombreArchivo?.split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xls", "csv"].includes(extension)) return "datos";
  if (["pdf", "doc", "docx"].includes(extension)) return "documento";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "imagen";
  return "otro";
}

router.get("/overview", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const companyId = req.query.companyId?.trim();
  const tipoArchivo = req.query.tipoArchivo?.trim();
  const q = req.query.q?.trim();

  const filters = {};
  if (companyId) filters.companyId = companyId;

  const [files, companies] = await Promise.all([
    DatabaseFile.find(filters).sort({ fechaSubida: -1 }).lean(),
    Company.find().select("nombre slug activa tipoCliente").lean(),
  ]);

  const companyMap = new Map(companies.map((company) => [String(company._id), company]));
  const enriched = files
    .map((file) => ({
      ...file,
      tipoArchivo: inferType(file),
      company: companyMap.get(String(file.companyId)) || null,
      extension:
        file.extension ||
        path.extname(file.nombreArchivo || "").replace(".", "").toLowerCase() ||
        "sin-extension",
    }))
    .filter((file) => (tipoArchivo ? file.tipoArchivo === tipoArchivo : true))
    .filter((file) =>
      q
        ? [file.nombreVisible, file.nombreArchivo, file.company?.nombre, file.tipoArchivo]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(q.toLowerCase()))
        : true
    );

  const types = [...new Set(enriched.map((file) => file.tipoArchivo))].sort();
  const summary = {
    totalFiles: enriched.length,
    activeFiles: enriched.filter((file) => file.activa).length,
    companiesWithFiles: new Set(enriched.map((file) => String(file.companyId))).size,
  };

  res.json({
    summary,
    filters: {
      companies,
      types,
    },
    files: enriched.slice(0, 300),
  });
});

router.post(
  "/upload",
  auth,
  requireSuperAdmin,
  permit("manage_companies"),
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    const companyId = req.body.companyId?.trim();
    const nombreVisible = req.body.nombreVisible?.trim();
    const tipoArchivo = req.body.tipoArchivo?.trim() || "documento";

    if (!file || !companyId || !nombreVisible) {
      return res.status(400).json({ mensaje: "Debes indicar empresa, nombre visible y archivo" });
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    const saved = await DatabaseFile.create({
      companyId,
      nombreVisible,
      nombreArchivo: file.originalname,
      archivo: file.filename,
      extension: path.extname(file.originalname).replace(".", "").toLowerCase(),
      mimeType: file.mimetype,
      tipoArchivo,
      hoja: "",
      registros: 0,
      activa: true,
    });

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "create",
      modulo: "archivo-central",
      detalle: `Se subio ${saved.nombreVisible} a ${company.nombre}`,
    });

    res.status(201).json({ mensaje: "Documento subido", file: saved });
  }
);

router.get("/:id/detail", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const file = await DatabaseFile.findById(req.params.id).lean();

  if (!file) {
    return res.status(404).json({ mensaje: "Archivo no encontrado" });
  }

  const [company, records] = await Promise.all([
    Company.findById(file.companyId).select("nombre slug activa tipoCliente").lean(),
    Record.find({ databaseId: file._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  res.json({
    file: {
      ...file,
      tipoArchivo: inferType(file),
      company,
      extension:
        file.extension ||
        path.extname(file.nombreArchivo || "").replace(".", "").toLowerCase() ||
        "sin-extension",
    },
    preview: records,
  });
});

export default router;
