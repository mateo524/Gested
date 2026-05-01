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
import { ensureEducationalRoles } from "../utils/seedRolesPermissions.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizeRoleCode(input) {
  const v = String(input || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!v) return "EMPLEADO";
  if (["DIRECTOR", "ADMIN", "ADMIN_COLEGIO", "DIRECTIVO"].includes(v)) return "ADMIN_COLEGIO";
  if (["RRHH", "RH"].includes(v)) return "RRHH";
  if (["JEFE", "LIDER"].includes(v)) return "JEFE";
  if (["LECTOR", "AUDITOR"].includes(v)) return "LECTOR";
  return "EMPLEADO";
}

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
  const q = req.query.q?.trim();
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
  const users = await User.find().select("companyId isSuperAdmin").lean();

  res.json(
    companies.map((company) => ({
      ...company,
      slug: company.slug || company.nombre.toLowerCase().replace(/\s+/g, "-"),
      usersCount: users.filter(
        (user) => String(user.companyId) === String(company._id) && !user.isSuperAdmin
      ).length,
    }))
  );
});

router.post("/", auth, requireSuperAdmin, permit("manage_companies"), upload.single("file"), async (req, res) => {
  const {
    nombre,
    slug,
    tipoCliente = "general",
    adminNombre,
    adminEmail,
    adminPassword,
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

  await logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "create",
    modulo: "companies",
    detalle: `Empresa creada: ${company.nombre}`,
  });

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

        const roleCode = normalizeRoleCode(row.rol || row.role);
        const role = roleMap.get(roleCode) || roleMap.get("EMPLEADO");
        if (email && role) {
          const exists = await User.findOne({ email });
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

  await logAudit({
    companyId: req.user.companyId,
    userId: req.user.userId,
    accion: "bulk",
    modulo: "companies",
    detalle: `Accion masiva ${action} sobre ${companies.length} empresa(s)`,
  });

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

  await logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "update",
    modulo: "companies",
    detalle: `Empresa actualizada: ${company.nombre} (${company.activa ? "activa" : "inactiva"})`,
  });

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

  await logAudit({
    companyId: company._id,
    userId: req.user.userId,
    accion: "delete",
    modulo: "companies",
    detalle: `Empresa eliminada: ${company.nombre}`,
  });

  res.json({ mensaje: "Empresa eliminada" });
});

export default router;
