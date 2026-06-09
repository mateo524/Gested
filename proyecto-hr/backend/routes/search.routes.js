import express from "express";
import Announcement from "../models/Announcement.js";
import Company from "../models/Company.js";
import DatabaseFile from "../models/DatabaseFile.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

router.get("/global", auth, permit("manage_companies"), async (req, res) => {
  const q = req.query.q?.trim();

  if (!q) {
    return res.json({
      companies: [],
      files: [],
      announcements: [],
    });
  }

  const regex = { $regex: q, $options: "i" };

  const [companies, files, announcements] = await Promise.all([
    Company.find({
      $or: [{ nombre: regex }, { slug: regex }, { tipoCliente: regex }],
    })
      .select("nombre slug activa tipoCliente")
      .limit(20)
      .lean(),
    DatabaseFile.find({
      $or: [{ nombreVisible: regex }, { nombreArchivo: regex }, { tipoArchivo: regex }],
    })
      .select("nombreVisible nombreArchivo tipoArchivo companyId activa fechaSubida")
      .limit(30)
      .lean(),
    Announcement.find({
      $or: [{ titulo: regex }, { cuerpo: regex }, { categoria: regex }],
    })
      .select("titulo prioridad categoria companyId visible createdAt")
      .limit(30)
      .lean(),
  ]);

  const companyIds = [
    ...new Set(
      [...files, ...announcements]
        .map((item) => item.companyId?.toString())
        .filter(Boolean)
    ),
  ];
  const relatedCompanies = await Company.find({ _id: { $in: companyIds } })
    .select("nombre")
    .lean();
  const companyMap = new Map(relatedCompanies.map((item) => [String(item._id), item.nombre]));

  res.json({
    companies,
    files: files.map((item) => ({
      ...item,
      companyName: companyMap.get(String(item.companyId)) || "",
    })),
    announcements: announcements.map((item) => ({
      ...item,
      companyName: companyMap.get(String(item.companyId)) || "",
    })),
  });
});

export default router;
