import express from "express";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import Record from "../models/Record.js";
import DatabaseFile from "../models/DatabaseFile.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

async function getActiveRecords(companyId) {
  const activeDbs = await DatabaseFile.find({ companyId, activa: true }).select("_id");
  const ids = activeDbs.map((d) => d._id);

  return Record.find({
    companyId,
    databaseId: { $in: ids },
  }).lean();
}

router.get("/csv", auth, permit("export_reports"), async (req, res) => {
  const records = await getActiveRecords(req.user.companyId);

  const parser = new Parser({
    fields: ["nombreCompleto", "rol", "email"],
  });

  const csv = parser.parse(records);

  res.header("Content-Type", "text/csv");
  res.attachment("reporte.csv");
  res.send(csv);
});

router.get("/excel", auth, permit("export_reports"), async (req, res) => {
  const records = await getActiveRecords(req.user.companyId);

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