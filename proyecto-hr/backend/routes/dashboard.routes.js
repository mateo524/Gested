import express from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import AuditLog from "../models/AuditLog.js";
import CompanySetting from "../models/CompanySetting.js";
import DatabaseFile from "../models/DatabaseFile.js";
import Record from "../models/Record.js";

const router = express.Router();

router.get("/summary", auth, async (req, res) => {
  const companyId = req.user.companyId;

  const [usersTotal, activeUsers, rolesTotal, auditEvents, activeFiles, recordsTotal, settings] =
    await Promise.all([
      User.countDocuments({ companyId }),
      User.countDocuments({ companyId, activo: true }),
      Role.countDocuments({ companyId }),
      AuditLog.countDocuments({ companyId }),
      DatabaseFile.countDocuments({ companyId, activa: true }),
      Record.countDocuments({ companyId }),
      CompanySetting.findOne({ companyId }).lean(),
    ]);

  const latestAudit = await AuditLog.find({ companyId })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  res.json({
    cards: [
      { label: "Usuarios activos", value: activeUsers, hint: `${usersTotal} usuarios totales` },
      { label: "Roles configurados", value: rolesTotal, hint: "Accesos por empresa" },
      { label: "Archivos activos", value: activeFiles, hint: "Bases disponibles" },
      { label: "Registros importados", value: recordsTotal, hint: "Datos listos para explotar" },
    ],
    latestAudit,
    company: {
      nombreVisible: settings?.nombreVisible || "Empresa Demo",
      primaryColor: settings?.primaryColor || "#10b981",
    },
    security: {
      totalAuditEvents: auditEvents,
      tokenWindow: "8 horas",
      permissionsInSession: req.user.permisos?.length || 0,
    },
  });
});

export default router;
