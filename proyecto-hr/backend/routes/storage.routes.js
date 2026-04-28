import express from "express";
import path from "node:path";
import DatabaseFile from "../models/DatabaseFile.js";
import Company from "../models/Company.js";
import Record from "../models/Record.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

function inferType(file) {
  if (file.tipoArchivo) return file.tipoArchivo;
  const extension = file.nombreArchivo?.split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xls", "csv"].includes(extension)) return "datos";
  if (["pdf", "doc", "docx"].includes(extension)) return "documento";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "imagen";
  return "otro";
}

router.get("/overview", auth, permit("manage_companies"), async (req, res) => {
  const companyId = req.query.companyId?.trim();
  const tipoArchivo = req.query.tipoArchivo?.trim();

  const filters = {};
  if (companyId) filters.companyId = companyId;

  const [files, companies] = await Promise.all([
    DatabaseFile.find(filters).sort({ fechaSubida: -1 }).lean(),
    Company.find().select("nombre slug activa").lean(),
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
    .filter((file) => (tipoArchivo ? file.tipoArchivo === tipoArchivo : true));

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

router.get("/:id/detail", auth, permit("manage_companies"), async (req, res) => {
  const file = await DatabaseFile.findById(req.params.id).lean();

  if (!file) {
    return res.status(404).json({ mensaje: "Archivo no encontrado" });
  }

  const [company, records] = await Promise.all([
    Company.findById(file.companyId).select("nombre slug activa").lean(),
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
