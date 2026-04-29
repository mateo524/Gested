import express from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import AuditLog from "../models/AuditLog.js";
import CompanySetting from "../models/CompanySetting.js";
import DatabaseFile from "../models/DatabaseFile.js";
import Record from "../models/Record.js";
import Company from "../models/Company.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

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

function groupTimeline(items) {
  const map = new Map();

  items.forEach((item) => {
    const date = new Date(item.createdAt);
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    map.set(label, (map.get(label) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

router.get("/summary", auth, async (req, res) => {
  const { companyId, company } = await resolveCompanyScope(req);

  const [
    usersTotal,
    activeUsers,
    rolesTotal,
    auditEvents,
    activeFiles,
    totalFiles,
    recordsTotal,
    settings,
    latestAudit,
    recentRecords,
    files,
  ] = await Promise.all([
    User.countDocuments({ companyId }),
    User.countDocuments({ companyId, activo: true }),
    Role.countDocuments({ companyId }),
    AuditLog.countDocuments({ companyId }),
    DatabaseFile.countDocuments({ companyId, activa: true }),
    DatabaseFile.countDocuments({ companyId }),
    Record.countDocuments({ companyId }),
    CompanySetting.findOne({ companyId }).lean(),
    AuditLog.find({ companyId }).sort({ createdAt: -1 }).limit(6).lean(),
    Record.find({ companyId }).sort({ createdAt: -1 }).limit(2000).lean(),
    DatabaseFile.find({ companyId }).sort({ fechaSubida: -1 }).limit(20).lean(),
  ]);

  let superAdmin = null;
  if (req.user.isSuperAdmin) {
    const companies = await Company.find().select("tipoCliente activa").lean();
    const typeMap = new Map();
    companies.forEach((item) => {
      const label = item.tipoCliente || "general";
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });

    superAdmin = {
      totalCompanies: companies.length,
      activeCompanies: companies.filter((item) => item.activa).length,
      clientTypes: [...typeMap.entries()].map(([label, value]) => ({ label, value })),
    };
  }

  const roleDistribution = groupCount(recentRecords, "rol").slice(0, 8);
  const importTimeline = groupTimeline(files.map((file) => ({ createdAt: file.fechaSubida })));
  const fileRanking = files
    .map((file) => ({ label: file.nombreVisible, value: file.registros || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  res.json({
    cards: [
      { label: "Usuarios activos", value: activeUsers, hint: `${usersTotal} usuarios totales` },
      { label: "Roles configurados", value: rolesTotal, hint: "Accesos por empresa" },
      { label: "Bases activas", value: activeFiles, hint: `${totalFiles} archivos historicos` },
      { label: "Registros importados", value: recordsTotal, hint: "Datos listos para explotar" },
    ],
    latestAudit,
    company: {
      nombreVisible: settings?.nombreVisible || "Empresa Demo",
      legalName: company?.nombre || "Empresa Demo",
      primaryColor: settings?.primaryColor || "#10b981",
    },
    security: {
      totalAuditEvents: auditEvents,
      tokenWindow: "8 horas",
      permissionsInSession: req.user.permisos?.length || 0,
    },
    charts: {
      roleDistribution,
      importTimeline,
      fileRanking,
    },
    superAdmin,
  });
});

export default router;
