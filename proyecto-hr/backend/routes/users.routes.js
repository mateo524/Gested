import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

router.get("/", auth, permit("manage_users"), async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId })
    .select("-passwordHash")
    .populate("roleId", "nombre permisos");

  res.json(users);
});

router.post("/", auth, permit("manage_users"), async (req, res) => {
  const { nombre, email, password, roleId, activo = true } = req.body;

  if (!nombre || !email || !password || !roleId) {
    return res.status(400).json({ mensaje: "Faltan datos obligatorios del usuario" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ mensaje: "Ya existe un usuario con ese email" });
  }

  const role = await Role.findOne({ _id: roleId, companyId: req.user.companyId });
  if (!role) {
    return res.status(400).json({ mensaje: "El rol seleccionado no es válido" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    companyId: req.user.companyId,
    nombre,
    email: normalizedEmail,
    passwordHash,
    roleId,
    activo,
  });

  await logAudit({
    companyId: req.user.companyId,
    userId: req.user.userId,
    accion: "create",
    modulo: "users",
    detalle: `Usuario creado: ${user.email}`,
  });

  const hydratedUser = await User.findById(user._id)
    .select("-passwordHash")
    .populate("roleId", "nombre permisos");

  res.status(201).json({ mensaje: "Usuario creado", user: hydratedUser });
});

router.put("/:id", auth, permit("manage_users"), async (req, res) => {
  const { nombre, email, password, roleId, activo } = req.body;
  const update = {};

  const user = await User.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  });

  if (!user) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  if (nombre) update.nombre = nombre;
  if (typeof activo === "boolean") update.activo = activo;

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const duplicated = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.params.id },
    });

    if (duplicated) {
      return res.status(409).json({ mensaje: "Ya existe un usuario con ese email" });
    }

    update.email = normalizedEmail;
  }

  if (roleId) {
    const role = await Role.findOne({ _id: roleId, companyId: req.user.companyId });
    if (!role) {
      return res.status(400).json({ mensaje: "El rol seleccionado no es válido" });
    }

    update.roleId = roleId;
  }

  if (password) {
    update.passwordHash = await bcrypt.hash(password, 10);
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
  })
    .select("-passwordHash")
    .populate("roleId", "nombre permisos");

  await logAudit({
    companyId: req.user.companyId,
    userId: req.user.userId,
    accion: "update",
    modulo: "users",
    detalle: `Usuario actualizado: ${updatedUser.email}`,
  });

  res.json({ mensaje: "Usuario actualizado", user: updatedUser });
});

router.delete("/:id", auth, permit("manage_users"), async (req, res) => {
  if (String(req.params.id) === String(req.user.userId)) {
    return res.status(400).json({ mensaje: "No podés eliminar tu propio usuario" });
  }

  const user = await User.findOneAndDelete({
    _id: req.params.id,
    companyId: req.user.companyId,
  });

  if (!user) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  await logAudit({
    companyId: req.user.companyId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "users",
    detalle: `Usuario eliminado: ${user.email}`,
  });

  res.json({ mensaje: "Usuario eliminado" });
});

export default router;
