import express from "express";
import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import { ensureCompanyStructure } from "../utils/bootstrap.js";
import { logAudit } from "../utils/audit.js";
import { generateTempPassword } from "../utils/password.js";

const router = express.Router();

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

router.post("/", auth, requireSuperAdmin, permit("manage_companies"), async (req, res) => {
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

  const { company, adminRole } = await ensureCompanyStructure({
    companyName: nombre.trim(),
    companySlug: slug.trim(),
  });

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

    adminUser = await User.create({
      companyId: company._id,
      roleId: adminRole._id,
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

export default router;
