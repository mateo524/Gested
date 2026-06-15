import express from "express";
import { Parser } from "json2csv";
import Record from "../models/Record.js";
import DatabaseFile from "../models/DatabaseFile.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

function buildFilters(companyId, query) {
  const q = query.q?.trim();
  const rol = query.rol?.trim();
  const databaseId = query.databaseId?.trim();

  const filters = { companyId };
  if (rol) filters.rol = rol;
  if (databaseId) filters.databaseId = databaseId;
  if (q) {
    filters.$or = [
      { nombreCompleto: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { rol: { $regex: q, $options: "i" } },
    ];
  }

  return filters;
}

router.get("/", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const filters = buildFilters(companyId, req.query);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const allowedSortFields = ["nombreCompleto", "rol", "email", "createdAt"];
  const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? 1 : -1;

  const [records, total, roles, files] = await Promise.all([
    Record.find(filters).sort({ [sortBy]: sortDir }).skip(skip).limit(limit).lean(),
    Record.countDocuments(filters),
    Record.distinct("rol", { companyId }),
    DatabaseFile.find({ companyId }).select("nombreVisible").sort({ fechaSubida: -1 }).lean(),
  ]);

  res.json({
    records,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    filters: {
      roles: roles.filter(Boolean).sort(),
      files,
    },
  });
});

router.get("/export", auth, permit("export_reports"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const filters = buildFilters(companyId, req.query);
  const records = await Record.find(filters).lean();

  const parser = new Parser({
    fields: ["nombreCompleto", "rol", "email"],
  });

  const csv = parser.parse(records);
  res.header("Content-Type", "text/csv");
  res.attachment("registros-filtrados.csv");
  res.send(csv);
});

export default router;
