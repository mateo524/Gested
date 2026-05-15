import express from "express";
import Role from "../models/Role.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import UserRoleAssignment from "../models/UserRoleAssignment.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { logAudit } from "../utils/audit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { PERMISSION_SEED, PERMISSIONS, ROLE_DEFINITIONS } from "../utils/permissions.js";
import {
  buildRolePresetCatalog,
  getLegacyRoleCodeForPreset,
  resolveLegacyRoleForPreset,
  syncPrimaryRoleAssignmentForUser,
  validateRoleAssignmentInput,
} from "../utils/accessControl.js";

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

async function findAssignmentUserOrFail({ companyId, userId }) {
  const user = await User.findOne({ _id: userId, companyId, isSuperAdmin: false });
  if (!user) {
    const error = new Error("Usuario no encontrado dentro de tu organizacion");
    error.status = 404;
    throw error;
  }
  return user;
}

async function findAssignmentEmployeeOrFail({ companyId, employeeId }) {
  if (!employeeId) return null;
  const employee = await Employee.findOne({ _id: employeeId, companyId }).lean();
  if (!employee) {
    const error = new Error("Empleado no encontrado dentro de tu organizacion");
    error.status = 404;
    throw error;
  }
  return employee;
}

router.get(
  "/presets",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS, PERMISSIONS.VIEW_AUDIT),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    const [roles, assignments] = await Promise.all([
      Role.find({ companyId, activo: { $ne: false } }).lean(),
      UserRoleAssignment.find({ companyId, active: true }).lean(),
    ]);

    const usersCountByRoleKey = assignments.reduce((acc, item) => {
      acc[item.roleKey] = (acc[item.roleKey] || 0) + 1;
      return acc;
    }, {});

    const presets = buildRolePresetCatalog().map((preset) => ({
      ...preset,
      legacyRoleCode: getLegacyRoleCodeForPreset(preset.roleKey),
      legacyRoleId:
        roles.find((role) => role.code === getLegacyRoleCodeForPreset(preset.roleKey))?._id || null,
      usersAssigned: usersCountByRoleKey[preset.roleKey] || 0,
    }));

    res.json({ presets });
  }
);

router.get(
  "/assignments",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS, PERMISSIONS.VIEW_AUDIT),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    const filter = { companyId };
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;
    if (req.query.roleKey) filter.roleKey = String(req.query.roleKey).trim().toUpperCase();
    if (req.query.scope) filter.scope = String(req.query.scope).trim().toUpperCase();
    if (req.query.userId) filter.userId = req.query.userId;

    const items = await UserRoleAssignment.find(filter)
      .sort({ updatedAt: -1 })
      .populate("userId", "nombre email activo companyId schoolId employeeId")
      .populate("employeeId", "nombre apellido cargo area email")
      .lean();

    res.json({ items });
  }
);

router.post(
  "/assignments",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const user = await findAssignmentUserOrFail({ companyId, userId: req.body.userId });
      const employee = await findAssignmentEmployeeOrFail({
        companyId,
        employeeId: req.body.employeeId || user.employeeId || null,
      });
      const payload = validateRoleAssignmentInput(req.body);
      const legacyRole = await resolveLegacyRoleForPreset({ companyId, roleKey: payload.roleKey });
      if (!legacyRole) {
        return res.status(400).json({ mensaje: "No existe el rol base compatible para esta organizacion" });
      }

      const assignment = await syncPrimaryRoleAssignmentForUser({
        user,
        companyId,
        employeeId: employee?._id || user.employeeId || null,
        roleKey: payload.roleKey,
        scope: payload.scope,
        departmentCode: payload.departmentCode,
        teamId: payload.teamId,
        active: payload.active,
      });

      await logAudit({
        companyId,
        userId: req.user.userId,
        accion: "create",
        modulo: "roles.assignments",
        detalle: `Asignacion creada para usuario ${user.email}: ${payload.roleKey}/${payload.scope}`,
      });

      res.status(201).json({ mensaje: "Asignacion creada", assignment, legacyRoleId: legacyRole._id });
    } catch (error) {
      res.status(error.status || 400).json({ mensaje: error.message });
    }
  }
);

router.put(
  "/assignments/:id",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const current = await UserRoleAssignment.findOne({ _id: req.params.id, companyId });
      if (!current) {
        return res.status(404).json({ mensaje: "Asignacion no encontrada" });
      }
      const user = await findAssignmentUserOrFail({ companyId, userId: current.userId });
      const employee = await findAssignmentEmployeeOrFail({
        companyId,
        employeeId: req.body.employeeId || current.employeeId || user.employeeId || null,
      });
      const payload = validateRoleAssignmentInput({
        ...current.toObject(),
        ...req.body,
      });
      const legacyRole = await resolveLegacyRoleForPreset({ companyId, roleKey: payload.roleKey });
      if (!legacyRole) {
        return res.status(400).json({ mensaje: "No existe el rol base compatible para esta organizacion" });
      }

      current.employeeId = employee?._id || user.employeeId || null;
      current.roleKey = payload.roleKey;
      current.scope = payload.scope;
      current.departmentCode = payload.departmentCode;
      current.teamId = payload.teamId;
      current.active = payload.active;
      await current.save();

      user.roleId = legacyRole._id;
      await user.save();

      await UserRoleAssignment.updateMany(
        { companyId, userId: user._id, _id: { $ne: current._id } },
        { $set: { active: false } }
      );

      await logAudit({
        companyId,
        userId: req.user.userId,
        accion: "update",
        modulo: "roles.assignments",
        detalle: `Asignacion actualizada para usuario ${user.email}: ${payload.roleKey}/${payload.scope}`,
      });

      res.json({ mensaje: "Asignacion actualizada", assignment: current, legacyRoleId: legacyRole._id });
    } catch (error) {
      res.status(error.status || 400).json({ mensaje: error.message });
    }
  }
);

router.get("/catalog", auth, permit("manage_roles"), async (_req, res) => {
  res.json({
    permissions: PERMISSION_SEED,
    templates: ROLE_DEFINITIONS.map(toRoleTemplate),
    presets: buildRolePresetCatalog(),
  });
});

router.get("/qa/status", auth, permit("manage_roles"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const [roles, users] = await Promise.all([
    Role.find({ companyId }).lean(),
    User.find({ companyId, isSuperAdmin: false }).select("roleId").lean(),
  ]);

  const byCode = new Map(roles.filter((r) => r.code).map((r) => [r.code, r]));
  const items = ROLE_DEFINITIONS.filter((r) => r.code !== "SUPER_ADMIN").map((template) => {
    const role = byCode.get(template.code);
    const usersCount = role
      ? users.filter((u) => String(u.roleId) === String(role._id)).length
      : 0;
    const current = new Set(role?.permisos || []);
    const expected = new Set(template.permisos || []);
    const missing = [...expected].filter((p) => !current.has(p));
    const extra = [...current].filter((p) => !expected.has(p));
    return {
      code: template.code,
      nombre: template.nombre,
      exists: Boolean(role),
      usersCount,
      missing,
      extra,
      ok: Boolean(role) && missing.length === 0,
    };
  });

  res.json({ items });
});

router.get("/", auth, permit("manage_roles"), async (req, res) => {
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

  if (code === "SUPER_ADMIN" && !req.user?.isSuperAdmin) {
    return res.status(403).json({ mensaje: "SUPER_ADMIN solo puede administrarse desde plataforma" });
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
