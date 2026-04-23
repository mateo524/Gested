import express from "express";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { logAudit } from "../utils/audit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const roles = await Role.find({ companyId }).lean();
  const users = await User.find({ companyId, isSuperAdmin: false }).select("roleId").lean();

  const enrichedRoles = roles.map((role) => ({
    ...role,
    usersCount: users.filter((user) => String(user.roleId) === String(role._id)).length,
  }));

  res.json(enrichedRoles);
});

router.post("/", auth, permit("manage_roles"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const nombre = req.body.nombre?.trim();
  const permisos = req.body.permisos || [];

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre del rol es obligatorio" });
  }

  const existingRole = await Role.findOne({
    companyId,
    nombre,
  });

  if (existingRole) {
    return res.status(409).json({ mensaje: "Ya existe un rol con ese nombre" });
  }

  const role = await Role.create({
    companyId,
    nombre,
    permisos,
  });

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "create",
    modulo: "roles",
    detalle: `Rol creado: ${role.nombre}`,
  });

  res.status(201).json({ mensaje: "Rol creado", role: { ...role.toObject(), usersCount: 0 } });
});

router.put("/:id", auth, permit("manage_roles"), async (req, res) => {
  const nombre = req.body.nombre?.trim();
  const permisos = req.body.permisos || [];
  const { companyId } = await resolveCompanyScope(req);

  const role = await Role.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!role) {
    return res.status(404).json({ mensaje: "Rol no encontrado" });
  }

  if (nombre) {
    const duplicated = await Role.findOne({
      companyId: role.companyId,
      nombre,
      _id: { $ne: req.params.id },
    });

    if (duplicated) {
      return res.status(409).json({ mensaje: "Ya existe un rol con ese nombre" });
    }

    role.nombre = nombre;
  }

  role.permisos = permisos;
  await role.save();

  const usersCount = await User.countDocuments({
    companyId: role.companyId,
    roleId: role._id,
  });

  await logAudit({
    companyId: role.companyId,
    userId: req.user.userId,
    accion: "update",
    modulo: "roles",
    detalle: `Rol actualizado: ${role.nombre}`,
  });

  res.json({ mensaje: "Rol actualizado", role: { ...role.toObject(), usersCount } });
});

router.delete("/:id", auth, permit("manage_roles"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const usersCount = await User.countDocuments({
    companyId,
    roleId: req.params.id,
  });

  if (usersCount > 0) {
    return res.status(400).json({
      mensaje: "No podés eliminar un rol que todavía tiene usuarios asignados",
    });
  }

  const role = await Role.findOneAndDelete({
    _id: req.params.id,
    companyId,
  });

  if (!role) {
    return res.status(404).json({ mensaje: "Rol no encontrado" });
  }

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "roles",
    detalle: `Rol eliminado: ${role.nombre}`,
  });

  res.json({ mensaje: "Rol eliminado" });
});

export default router;
