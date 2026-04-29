import express from "express";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import Record from "../models/Record.js";
import DatabaseFile from "../models/DatabaseFile.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { companyScope } from "../utils/companyScope.js";
import { generateEmployeePDF, generateTeamReportPDF } from "../utils/pdf.js";

const router = express.Router();

async function getActiveRecords(companyId) {
  const activeDbs = await DatabaseFile.find({ companyId, activa: true }).select("_id");
  const ids = activeDbs.map((d) => d._id);

  return Record.find({
    companyId,
    databaseId: { $in: ids },
  }).lean();
}

// Exportar todos los registros (requiere permiso export_all_reports)
router.get("/csv", requireAuth, permit("export_reports", "export_all_reports"), companyScope, async (req, res) => {
  try {
    const records = await getActiveRecords(req.company._id);

    const parser = new Parser({
      fields: ["nombreCompleto", "rol", "email", "departamento", "telefono"],
    });

    const csv = parser.parse(records);

    res.header("Content-Type", "text/csv");
    res.attachment("reporte.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar a Excel
router.get("/excel", requireAuth, permit("export_reports", "export_all_reports"), companyScope, async (req, res) => {
  try {
    const records = await getActiveRecords(req.company._id);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte");

    ws.columns = [
      { header: "Nombre", key: "nombreCompleto" },
      { header: "Rol", key: "rol" },
      { header: "Email", key: "email" },
      { header: "Departamento", key: "departamento" },
      { header: "Teléfono", key: "telefono" },
    ];

    ws.addRows(records);

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar solo registros del empleado (reporte personal)
router.get("/personal", requireAuth, companyScope, async (req, res) => {
  try {
    const records = await getActiveRecords(req.company._id);
    
    // Filtrar solo registros del usuario actual
    const userRecords = records.filter(r => r.email === req.user.email);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Mi Reporte");

    ws.columns = [
      { header: "Nombre", key: "nombreCompleto" },
      { header: "Rol", key: "rol" },
      { header: "Email", key: "email" },
      { header: "Departamento", key: "departamento" },
      { header: "Teléfono", key: "telefono" },
      { header: "Fecha Ingreso", key: "fechaIngreso" },
    ];

    ws.addRows(userRecords);

    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment("mi-reporte.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar registros del equipo (si es jefe)
router.get("/team", requireAuth, companyScope, async (req, res) => {
  try {
    const tienePermiso = req.user.permisos?.includes("export_team_reports") || 
                         req.user.permisos?.includes("export_all_reports");

    if (!tienePermiso) {
      return res.status(403).json({ error: "No tiene permisos para exportar equipo" });
    }

    const records = await getActiveRecords(req.company._id);
    
    // Filtrar registros del equipo (donde el jefe actual es el jefe del registro)
    const teamRecords = records.filter(r => r.jefe === req.user.nombre);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Equipo");

    ws.columns = [
      { header: "Nombre", key: "nombreCompleto" },
      { header: "Rol", key: "rol" },
      { header: "Email", key: "email" },
      { header: "Departamento", key: "departamento" },
      { header: "Teléfono", key: "telefono" },
      { header: "Estado", key: "estado_empleado" },
    ];

    ws.addRows(teamRecords);

    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment("equipo-reporte.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar PDF individual de empleado
router.get("/pdf/employee/:id", requireAuth, companyScope, async (req, res) => {
  try {
    const employee = await Record.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!employee) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    // Validar permisos: solo el empleado o su jefe pueden descargar
    const esEmpleado = employee.email === req.user.email;
    const esJefe = employee.jefe === req.user.nombre;
    const tienPermiso = req.user.permisos?.includes("export_all_reports");

    if (!esEmpleado && !esJefe && !tienPermiso) {
      return res.status(403).json({ error: "No tiene permisos para descargar este archivo" });
    }

    res.header("Content-Type", "application/pdf");
    res.attachment(`${employee.nombreCompleto}-reporte.pdf`);

    generateEmployeePDF(employee, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar PDF de equipo
router.get("/pdf/team", requireAuth, companyScope, async (req, res) => {
  try {
    const tienePermiso =
      req.user.permisos?.includes("export_team_reports") ||
      req.user.permisos?.includes("export_all_reports");

    if (!tienePermiso) {
      return res.status(403).json({ error: "No tiene permisos para exportar equipo" });
    }

    const records = await getActiveRecords(req.company._id);

    // Filtrar registros del equipo
    const teamRecords = records.filter((r) => r.jefe === req.user.nombre);

    res.header("Content-Type", "application/pdf");
    res.attachment("equipo-reporte.pdf");

    generateTeamReportPDF(teamRecords, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;