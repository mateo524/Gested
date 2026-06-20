import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import ExcelJS from "exceljs";
import Company from "../models/Company.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import School from "../models/School.js";
import Employee from "../models/Employee.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import { ensureCompanyStructure } from "../utils/bootstrap.js";
import { logAudit } from "../utils/audit.js";
import { generateTempPassword } from "../utils/password.js";
import { sendWelcomeEmail } from "../utils/mailer.js";
import { ensureEducationalRoles } from "../utils/seedRolesPermissions.js";
import { isForbiddenPlatformRoleInput, mapRoleInputToLegacyRoleCode } from "../utils/legacyRoleMapping.js";
import { slack } from "../utils/slackNotifier.js";
import { runInBackground } from "../utils/background.js";
import { triggerSheetSync } from "../utils/sheetSync.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.param("id", (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return res.status(400).json({ mensaje: "ID de empresa no válido" });
  }
  next();
});

async function parseUploadedRows(file) {
  if (!file) return [];
  const workbook = new ExcelJS.Workbook();
  const fileName = file.originalname.toLowerCase();
  if (fileName.endsWith(".csv")) await workbook.csv.readBuffer(file.buffer);
  else await workbook.xlsx.load(file.buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = worksheet
    .getRow(1)
    .values.slice(1)
    .map((value) => String(value || "").trim().toLowerCase());

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index];
    });
    rows.push(item);
  });
  return rows;
}

router.get("/", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const raw = req.query.q?.trim();
  const q = raw ? raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const companies = await Company.find(
    q
      ? {
          $or: [
            { nombre: { $regex: q, $options: "i" } },
            { slug: { $regex: q, $options: "i" } },
            { tipoCliente: { $regex: q, $options: "i" } },
          ],
        }
      : {}
  )
    .sort({ nombre: 1 })
    .lean();
  const companyIds = companies.map((c) => c._id);
  const userCounts = await User.aggregate([
    { $match: { companyId: { $in: companyIds }, isSuperAdmin: { $ne: true } } },
    { $group: { _id: "$companyId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(userCounts.map((u) => [String(u._id), u.count]));

  res.json(
    companies.map((company) => ({
      ...company,
      slug: company.slug || company.nombre.toLowerCase().replace(/\s+/g, "-"),
      usersCount: countMap.get(String(company._id)) || 0,
    }))
  );
});

// Any authenticated user can manually trigger a spreadsheet sync for their company
router.post("/sync-now", auth, async (req, res) => {
  const companyId = req.user.companyId;
  const schoolId = req.user.schoolId;
  if (!companyId) return res.status(400).json({ mensaje: "Sin empresa asignada" });
  runInBackground(() => triggerSheetSync({ companyId: String(companyId), schoolId: schoolId ? String(schoolId) : undefined }), "sheet-sync-manual");
  res.json({ mensaje: "Sincronización iniciada. El Excel se actualizará en unos segundos." });
});

// Any authenticated user can retrieve their own company's spreadsheet link
router.get("/my-spreadsheet", auth, async (req, res) => {
  let companyId = req.user.companyId;
  // SuperAdmin can pass a specific companyId as query param
  if (!companyId && req.user.isSuperAdmin && req.query.companyId) {
    companyId = req.query.companyId;
  }
  if (!companyId) return res.json({ spreadsheetUrl: null, spreadsheetLastSync: null });
  const company = await Company.findById(companyId).select("spreadsheetUrl spreadsheetLastSync").lean();
  if (!company) return res.json({ spreadsheetUrl: null, spreadsheetLastSync: null });
  res.json({ spreadsheetUrl: company.spreadsheetUrl || null, spreadsheetLastSync: company.spreadsheetLastSync || null });
});

router.get("/:id", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const company = await Company.findById(req.params.id).select("nombre slug tipoCliente activa spreadsheetId spreadsheetUrl spreadsheetLastSync").lean();
  if (!company) return res.status(404).json({ mensaje: "Empresa no encontrada" });
  res.json(company);
});

router.post("/", auth, requireSuperAdmin, permit("manage_companies"), upload.single("file"), async (req, res) => {
  const {
    nombre,
    slug,
    tipoCliente = "general",
    adminNombre,
    adminEmail,
    adminPassword,
    schoolName,
    createAdmin = true,
  } = req.body;

  if (!nombre || !slug) {
    return res.status(400).json({ mensaje: "Nombre y slug son obligatorios" });
  }

  const duplicatedCompany = await Company.findOne({
    $or: [{ nombre: nombre.trim() }, { slug: slug.trim() }],
  });

  if (duplicatedCompany) {
    return res.status(409).json({ mensaje: "Ya existe una empresa con ese nombre o slug" });
  }

  const { company, adminRole, school: defaultSchool } = await ensureCompanyStructure({
    companyName: nombre.trim(),
    companySlug: slug.trim(),
    schoolName: schoolName?.trim(),
  });
  await ensureEducationalRoles({ companyId: company._id, schoolId: defaultSchool?._id || null });

  company.tipoCliente = tipoCliente.trim() || "general";
  await company.save();

  let adminUser = null;
  let generatedPassword = null;

  if (createAdmin) {
    if (!adminNombre || !adminEmail) {
      return res.status(400).json({
        mensaje: "Para crear el admin de empresa faltan nombre o email",
      });
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ mensaje: "Ya existe un usuario con ese email" });
    }

    generatedPassword = adminPassword?.trim() || generateTempPassword();

    const directorRole = await Role.findOne({ companyId: company._id, code: "ADMIN_COLEGIO" });
    adminUser = await User.create({
      companyId: company._id,
      roleId: directorRole?._id || adminRole._id,
      schoolId: defaultSchool?._id || null,
      nombre: adminNombre.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(generatedPassword, 10),
      activo: true,
      isSuperAdmin: false,
      mustChangePassword: true,
    });
  }

  runInBackground(() => logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "create",
    modulo: "companies",
    detalle: `Empresa creada: ${company.nombre}`,
  }), "audit-company-create");

  let imported = { rows: 0, employees: 0, users: 0, errors: 0 };
  if (req.file) {
    const rows = await parseUploadedRows(req.file);
    const roles = await Role.find({ companyId: company._id }).lean();
    const roleMap = new Map(roles.map((role) => [role.code, role]));

    for (const row of rows) {
      try {
        const nombrePersona = String(row.nombre || "").trim();
        const apellido = String(row.apellido || "").trim();
        const email = String(row.email || "").trim().toLowerCase();
        const cargo = String(row.cargo || "Docente").trim();
        if (!nombrePersona || !apellido) {
          imported.errors += 1;
          continue;
        }

        const employee = await Employee.create({
          companyId: company._id,
          schoolId: defaultSchool?._id,
          nombre: nombrePersona,
          apellido,
          email: email || undefined,
          cargo,
          area: String(row.area || "").trim(),
          tipoEmpleado: String(row.tipoempleado || row.tipo || "DOCENTE").toUpperCase(),
          activo: String(row.activo || "true").toLowerCase() !== "false",
        });
        imported.employees += 1;

        const requestedRole = row.rol || row.role || row.roleKey;
        if (isForbiddenPlatformRoleInput(requestedRole)) {
          imported.errors += 1;
          continue;
        }

        const roleCode = mapRoleInputToLegacyRoleCode(requestedRole);
        const role = roleMap.get(roleCode) || roleMap.get("EMPLEADO");
        if (email && role) {
          const exists = await User.findOne({ email, companyId: company._id });
          if (!exists) {
            const tempPassword = String(row.password || "").trim() || generateTempPassword();
            await User.create({
              companyId: company._id,
              schoolId: defaultSchool?._id || null,
              roleId: role._id,
              nombre: `${nombrePersona} ${apellido}`.trim(),
              email,
              passwordHash: await bcrypt.hash(tempPassword, 10),
              activo: true,
              isSuperAdmin: false,
              mustChangePassword: true,
              employeeId: employee._id,
            });
            imported.users += 1;
          }
        }
      } catch {
        imported.errors += 1;
      } finally {
        imported.rows += 1;
      }
    }
  }

  if (adminUser && generatedPassword) {
    sendWelcomeEmail({
      to: adminUser.email,
      nombre: adminUser.nombre,
      companyName: company.nombre,
      password: generatedPassword,
    }).catch(() => {});
  }

  slack.newOrg(company.nombre, adminUser?.email || "sin admin").catch(() => {});

  res.status(201).json({
    mensaje: "Empresa creada",
    company,
    adminUser: adminUser
      ? {
          _id: adminUser._id,
          nombre: adminUser.nombre,
          email: adminUser.email,
          temporaryPassword: generatedPassword,
        }
      : null,
    imported,
  });
});

router.post("/bulk", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const { action, companyIds = [] } = req.body;

  if (!action || !Array.isArray(companyIds) || !companyIds.length) {
    return res.status(400).json({ mensaje: "Debes indicar accion y empresas" });
  }

  const companies = await Company.find({ _id: { $in: companyIds } });
  if (!companies.length) {
    return res.status(404).json({ mensaje: "No se encontraron empresas para procesar" });
  }

  if (action === "activate") {
    await Company.updateMany({ _id: { $in: companyIds } }, { activa: true });
  } else if (action === "deactivate") {
    await Company.updateMany({ _id: { $in: companyIds } }, { activa: false });
  } else {
    return res.status(400).json({ mensaje: "Accion masiva no valida" });
  }

  runInBackground(() => logAudit({
    companyId: req.user.companyId,
    userId: req.user.userId,
    accion: "bulk",
    modulo: "companies",
    detalle: `Accion masiva ${action} sobre ${companies.length} empresa(s)`,
  }), "audit-company-bulk");

  res.json({ mensaje: "Accion masiva aplicada", processed: companies.length });
});

router.put("/:id", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const { nombre, slug, activa, tipoCliente } = req.body;
  const company = await Company.findById(req.params.id);

  if (!company) {
    return res.status(404).json({ mensaje: "Empresa no encontrada" });
  }

  if (nombre) company.nombre = nombre.trim();
  if (slug) company.slug = slug.trim();
  if (tipoCliente) company.tipoCliente = tipoCliente.trim();
  if (typeof activa === "boolean") company.activa = activa;

  await company.save();

  runInBackground(() => logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "update",
    modulo: "companies",
    detalle: `Empresa actualizada: ${company.nombre} (${company.activa ? "activa" : "inactiva"})`,
  }), "audit-company-update");

  res.json({ mensaje: "Empresa actualizada", company });
});

router.delete("/:id", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    return res.status(404).json({ mensaje: "Empresa no encontrada" });
  }

  const [usersCount, schoolsCount] = await Promise.all([
    User.countDocuments({ companyId: company._id }),
    School.countDocuments({ companyId: company._id }),
  ]);

  if (usersCount > 0 || schoolsCount > 0) {
    return res.status(400).json({
      mensaje:
        "No se puede eliminar: la empresa tiene usuarios o colegios asociados. Primero desactiva o depura esos datos.",
    });
  }

  await Company.deleteOne({ _id: company._id });

  runInBackground(() => logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "delete",
    modulo: "companies",
    detalle: `Empresa eliminada: ${company.nombre}`,
  }), "audit-company-delete");

  res.json({ mensaje: "Empresa eliminada" });
});

const ALLOWED_MODULE_KEYS = [
  "evaluaciones", "competencias", "planesDesarrollo", "reporteEjecutivo",
  "orgchart", "exportacion", "kpis", "calibracion", "cargaMasiva",
];

router.patch("/:id/modules", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ mensaje: "Empresa no encontrada" });

  const updates = req.body || {};
  const patch = {};
  for (const key of ALLOWED_MODULE_KEYS) {
    if (typeof updates[key] === "boolean") patch[key] = updates[key];
  }

  company.modules = { ...(company.modules?.toObject?.() ?? company.modules ?? {}), ...patch };
  await company.save();

  runInBackground(() => logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "update",
    modulo: "companies",
    detalle: `Módulos actualizados: ${JSON.stringify(patch)}`,
  }), "audit-company-modules");

  res.json({ mensaje: "Módulos actualizados", modules: company.modules });
});

// PATCH /:id/plan — superAdmin sets plan and optional expiry
router.patch("/:id/plan", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
  const { plan, planExpiresAt } = req.body;
  const validPlans = ["base", "pro"];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ ok: false, mensaje: `Plan inválido. Valores permitidos: ${validPlans.join(", ")}.` });
  }

  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ ok: false, mensaje: "Empresa no encontrada." });

  company.plan = plan;
  company.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
  await company.save();

  res.json({ ok: true, plan: company.plan, planExpiresAt: company.planExpiresAt });
});

// GET /:id/plan — anyone authenticated can check their own company plan
router.get("/:id/plan", auth, async (req, res) => {
  const company = await Company.findById(req.params.id).select("plan planExpiresAt nombre").lean();
  if (!company) return res.status(404).json({ ok: false, mensaje: "Empresa no encontrada." });
  const expired = company.planExpiresAt && new Date(company.planExpiresAt) < new Date();
  res.json({ ok: true, plan: company.plan, planExpiresAt: company.planExpiresAt, expired });
});

export default router;
