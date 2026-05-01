import express from "express";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { logAudit } from "../utils/audit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { PERMISSION_SEED, ROLE_DEFINITIONS } from "../utils/permissions.js";

const router = express.Router();

const roleDescriptions = {
  SUPER_ADMIN: "Control total de la plataforma: empresas, usuarios globales, seguridad y reportes consolidados.",
  ADMIN_COLEGIO: "Administra su colegio/empresa: empleados, ciclos, evaluaciones, configuracion y reportes.",
  RRHH: "Opera la gestion diaria de personas, evaluaciones y planes de desarrollo.",
  JEFE: "Evalua su equipo a cargo y consulta resultados del equipo.",
  EMPLEADO: "Accede a su perfil, autoevaluacion y reportes personales.",
  LECTOR: "Acceso de solo lectura para auditoria y consulta.",
};

function toRoleTemplate(role) {
  return {
    code: role.code,
    nombre: role.nombre,
    scope: role.scope,
    descripcion: roleDescriptions[role.code] || "",
    permisos: role.permisos,
  };
}

router.get("/catalog", auth, permit("manage_roles"), async (_req, res) => {
  res.json({
    permissions: PERMISSION_SEED,
    templates: ROLE_DEFINITIONS.map(toRoleTemplate),
  });
});

router.get("/", auth, async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const roles = await Role.find({ companyId }).lean();
  const users = await User.find({ companyId, isSuperAdmin: false }).select("roleId").lean();

  const enrichedRoles = roles.map((role) => ({
    ...role,
    usersCount: users.filter((user) => String(user.roleId) === String(role._id)).length,
    descripcion: role.descripcion || roleDescriptions[role.code] || "",
  }));

  res.json(enrichedRoles);
});

router.post("/", auth, permit("manage_roles"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const nombre = req.body.nombre?.trim();
  const permisos = req.body.permisos || [];
  const descripcion = req.body.descripcion?.trim() || "";
  const code = req.body.code?.trim() || null;

  if (!nombre) {
    return res.status(400).json({ mensaje: "El nombre del rol es obligatorio" });
  }

  if (code && !ROLE_DEFINITIONS.find((item) => item.code === code)) {
    return res.status(400).json({ mensaje: "Codigo de rol no valido" });
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
    code,
    nombre,
    descripcion: descripcion || (code ? roleDescriptions[code] : ""),
    permisos: code ? [...new Set([...(ROLE_DEFINITIONS.find((item) => item.code === code)?.permisos || []), ...permisos])] : permisos,
    scope: code ? ROLE_DEFINITIONS.find((item) => item.code === code)?.scope || "company" : "company",
    isSystem: Boolean(code),
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
  const descripcion = req.body.descripcion?.trim() || "";
  const { companyId } = await resolveCompanyScope(req);

  const role = await Role.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!role) {
    return res.status(404).json({ mensaje: "Rol no encontrado" });
  }

  if (role.isSystem && role.code === "SUPER_ADMIN") {
    return res.status(400).json({ mensaje: "El rol SUPER_ADMIN del sistema no puede modificarse desde esta pantalla" });
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
  role.descripcion = descripcion || role.descripcion || roleDescriptions[role.code] || "";
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
  const roleToDelete = await Role.findById(req.params.id);
  if (roleToDelete?.isSystem) {
    return res.status(400).json({ mensaje: "No se puede eliminar un rol base del sistema" });
  }

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

router.post("/sync-defaults", auth, permit("manage_roles"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const output = [];

  for (const template of ROLE_DEFINITIONS) {
    if (template.code === "SUPER_ADMIN") continue;

    const updated = await Role.findOneAndUpdate(
      { companyId, code: template.code },
      {
        companyId,
        code: template.code,
        nombre: template.nombre,
        descripcion: roleDescriptions[template.code] || "",
        permisos: template.permisos,
        scope: template.scope || "company",
        isSystem: true,
        activo: true,
      },
      { upsert: true, new: true }
    ).lean();

    output.push(updated);
  }

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "sync",
    modulo: "roles",
    detalle: "Se sincronizaron roles recomendados de sistema",
  });

  res.json({ mensaje: "Roles recomendados sincronizados", roles: output });
});

export default router;
