import express from "express";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import Record from "../models/Record.js";
import DatabaseFile from "../models/DatabaseFile.js";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { extractExcelData } from "../utils/excel.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();
const uploadsDir = path.resolve("uploads");

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
  limits: { fileSize: 15 * 1024 * 1024 },
});

async function getActiveRecords(companyId) {
  const activeDbs = await DatabaseFile.find({ companyId, activa: true }).select("_id");
  const ids = activeDbs.map((d) => d._id);

  return Record.find({
    companyId,
    databaseId: { $in: ids },
  }).lean();
}

async function getRecordsByFile(databaseId) {
  return Record.find({ databaseId }).lean();
}

function groupCount(items, key, fallback = "Sin dato") {
  const map = new Map();

  items.forEach((item) => {
    const value = item?.[key] ? String(item[key]).trim() : fallback;
    map.set(value || fallback, (map.get(value || fallback) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function groupDomains(records) {
  const map = new Map();

  records.forEach((record) => {
    const email = record.email || "";
    const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "Sin dominio";
    map.set(domain, (map.get(domain) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

router.get("/overview", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);

  const [files, records, settings] = await Promise.all([
    DatabaseFile.find({ companyId }).sort({ fechaSubida: -1 }).lean(),
    Record.find({ companyId }).sort({ createdAt: -1 }).limit(5000).lean(),
    CompanySetting.findOne({ companyId }).lean(),
  ]);

  const activeFiles = files.filter((file) => file.activa);
  const roles = groupCount(records, "rol");
  const domains = groupDomains(records);
  const latestFile = files[0] || null;
  const fileStats = files.map((file) => ({
    ...file,
    isActive: !!file.activa,
  }));

  res.json({
    summary: {
      totalFiles: files.length,
      activeFiles: activeFiles.length,
      totalRecords: records.length,
      maxUploadSizeMb: settings?.maxUploadSizeMb || 10,
      latestUploadAt: latestFile?.fechaSubida || null,
    },
    roles: roles.slice(0, 8),
    domains: domains.slice(0, 8),
    files: fileStats.slice(0, 12),
    recentRecords: records.slice(0, 12),
  });
});

router.post(
  "/import",
  auth,
  permit("export_reports"),
  upload.single("file"),
  async (req, res) => {
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({ mensaje: "Selecciona un archivo Excel antes de importar" });
    }

    const { companyId } = await resolveCompanyScope(req);
    const settings = await CompanySetting.findOne({ companyId }).lean();
    const maxUploadSizeMb = settings?.maxUploadSizeMb || 10;

    if (uploadedFile.size > maxUploadSizeMb * 1024 * 1024) {
      await fs.unlink(uploadedFile.path).catch(() => {});
      return res.status(400).json({
        mensaje: `El archivo supera el limite configurado de ${maxUploadSizeMb} MB`,
      });
    }

    const extracted = await extractExcelData(uploadedFile.path);

    const databaseFile = await DatabaseFile.create({
      companyId,
      nombreVisible:
        req.body.nombreVisible?.trim() ||
        uploadedFile.originalname.replace(/\.[^.]+$/, ""),
      nombreArchivo: uploadedFile.originalname,
      archivo: uploadedFile.filename,
      extension: path.extname(uploadedFile.originalname).replace(".", "").toLowerCase(),
      mimeType: uploadedFile.mimetype,
      tipoArchivo: "datos",
      hoja: extracted.hoja,
      registros: extracted.registros,
      activa: true,
    });

    await Record.insertMany(
      extracted.datos.map((record) => ({
        ...record,
        companyId,
        databaseId: databaseFile._id,
      }))
    );

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "importacion",
      modulo: "datos",
      detalle: `Se importo ${databaseFile.nombreVisible} con ${extracted.registros} registros`,
    });

    res.status(201).json({
      mensaje: "Base importada correctamente",
      file: databaseFile,
      imported: {
        registros: extracted.registros,
        hoja: extracted.hoja,
        campos: ["apellido", "nombre", "rol", "email"],
      },
    });
  }
);

router.put("/:id/status", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const file = await DatabaseFile.findOne({ _id: req.params.id, companyId });

  if (!file) {
    return res.status(404).json({ mensaje: "Base no encontrada" });
  }

  file.activa = typeof req.body.activa === "boolean" ? req.body.activa : !file.activa;
  await file.save();

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "actualizacion",
    modulo: "datos",
    detalle: `${file.nombreVisible} quedo ${file.activa ? "activa" : "inactiva"} para analisis`,
  });

  res.json({ mensaje: "Estado de la base actualizado", file });
});

router.get("/compare", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const leftId = req.query.left;
  const rightId = req.query.right;

  if (!leftId || !rightId) {
    return res.status(400).json({ mensaje: "Selecciona dos bases para comparar" });
  }

  const [leftFile, rightFile] = await Promise.all([
    DatabaseFile.findOne({ _id: leftId, companyId }).lean(),
    DatabaseFile.findOne({ _id: rightId, companyId }).lean(),
  ]);

  if (!leftFile || !rightFile) {
    return res.status(404).json({ mensaje: "No se encontraron las bases seleccionadas" });
  }

  const [leftRecords, rightRecords] = await Promise.all([
    getRecordsByFile(leftFile._id),
    getRecordsByFile(rightFile._id),
  ]);

  const leftEmails = new Set(leftRecords.map((item) => item.email).filter(Boolean));
  const rightEmails = new Set(rightRecords.map((item) => item.email).filter(Boolean));
  let sharedEmails = 0;

  leftEmails.forEach((email) => {
    if (rightEmails.has(email)) sharedEmails += 1;
  });

  res.json({
    left: {
      id: leftFile._id,
      nombreVisible: leftFile.nombreVisible,
      registros: leftRecords.length,
      roles: groupCount(leftRecords, "rol").slice(0, 6),
    },
    right: {
      id: rightFile._id,
      nombreVisible: rightFile.nombreVisible,
      registros: rightRecords.length,
      roles: groupCount(rightRecords, "rol").slice(0, 6),
    },
    overlap: {
      sharedEmails,
      leftUniqueEmails: Math.max(leftEmails.size - sharedEmails, 0),
      rightUniqueEmails: Math.max(rightEmails.size - sharedEmails, 0),
    },
  });
});

router.get("/csv", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const records = await getActiveRecords(companyId);

  const parser = new Parser({
    fields: ["nombreCompleto", "rol", "email"],
  });

  const csv = parser.parse(records);

  res.header("Content-Type", "text/csv");
  res.attachment("reporte.csv");
  res.send(csv);
});

router.get("/excel", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const records = await getActiveRecords(companyId);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reporte");

  ws.columns = [
    { header: "Nombre", key: "nombreCompleto" },
    { header: "Rol", key: "rol" },
    { header: "Email", key: "email" },
  ];

  ws.addRows(records);

  await wb.xlsx.write(res);
  res.end();
});

export default router;
