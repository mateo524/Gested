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

  const [records, roles, files] = await Promise.all([
    Record.find(filters).sort({ createdAt: -1 }).limit(300).lean(),
    Record.distinct("rol", { companyId }),
    DatabaseFile.find({ companyId }).select("nombreVisible").sort({ fechaSubida: -1 }).lean(),
  ]);

  res.json({
    records,
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
