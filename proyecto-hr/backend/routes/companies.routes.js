import express from "express";
import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { ensureCompanyStructure } from "../utils/bootstrap.js";
import { logAudit } from "../utils/audit.js";
import { generateTempPassword } from "../utils/password.js";

const router = express.Router();

router.get("/", auth, permit("manage_companies"), async (req, res) => {
  const companies = await Company.find().sort({ nombre: 1 }).lean();
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

router.post("/", auth, permit("manage_companies"), async (req, res) => {
  const {
    nombre,
    slug,
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

router.put("/:id", auth, permit("manage_companies"), async (req, res) => {
  const { nombre, slug, activa } = req.body;
  const company = await Company.findById(req.params.id);

  if (!company) {
    return res.status(404).json({ mensaje: "Empresa no encontrada" });
  }

  if (nombre) company.nombre = nombre.trim();
  if (slug) company.slug = slug.trim();
  if (typeof activa === "boolean") company.activa = activa;

  await company.save();

  res.json({ mensaje: "Empresa actualizada", company });
});

export default router;
