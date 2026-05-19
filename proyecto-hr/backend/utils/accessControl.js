import Role from "../models/Role.js";
import UserRoleAssignment from "../models/UserRoleAssignment.js";
import {
  getPresetByLegacyRoleCode,
  getRolePreset,
  isValidRoleKey,
  isValidRoleScope,
  ROLE_PRESETS,
} from "./rolePresets.js";

function normalizeDepartmentCode(value) {
  return String(value || "").trim();
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

export function getLegacyRoleCodeForPreset(roleKey) {
  return getRolePreset(roleKey)?.legacyRoleCode || null;
}

export async function resolveLegacyRoleForPreset({ companyId, roleKey }) {
  const legacyRoleCode = getLegacyRoleCodeForPreset(roleKey);
  if (!legacyRoleCode) return null;
  return Role.findOne({ companyId, code: legacyRoleCode, activo: { $ne: false } });
}

export function buildEffectiveRoleFromPreset({
  user,
  preset,
  assignment = null,
  permissions = null,
}) {
  if (!preset) return null;
  const scope = assignment?.scope || (preset.allowedScopes?.[0] || "ORGANIZATION");
  const basePermissions =
    Array.isArray(permissions) && permissions.length
      ? permissions
      : preset.defaultPermissions || [];
  const effectivePermissions = Array.from(new Set(basePermissions));
  return {
    roleKey: preset.roleKey,
    roleLabel: preset.label,
    roleDescription: preset.description,
    roleCode: preset.legacyRoleCode,
    roleScope: scope,
    allowedScopes: preset.allowedScopes || [],
    permisos: effectivePermissions,
    readOnly: preset.roleKey === "VIEWER" || preset.roleKey === "AUDITOR",
    departmentCode: assignment?.departmentCode || "",
    teamId: assignment?.teamId || "",
    employeeId: user?.employeeId || assignment?.employeeId || null,
    companyId: user?.companyId || assignment?.companyId || null,
    userId: user?._id || user?.userId || assignment?.userId || null,
    isSuperAdmin: !!user?.isSuperAdmin,
  };
}

export async function resolveEffectiveRole(user, scope = {}) {
  if (!user) return null;
  if (user.isSuperAdmin) {
    return {
      roleKey: "SUPER_ADMIN",
      roleLabel: "Super Admin",
      roleDescription: "Acceso de plataforma.",
      roleCode: "SUPER_ADMIN",
      roleScope: "GLOBAL",
      allowedScopes: ["GLOBAL"],
      permisos: Array.isArray(user.permisos) ? user.permisos : [],
      readOnly: false,
      departmentCode: "",
      teamId: "",
      employeeId: user.employeeId || null,
      companyId: user.companyId || null,
      userId: user._id || user.userId || null,
      isSuperAdmin: true,
    };
  }

  if (user.effectiveRole?.roleKey) {
    return user.effectiveRole;
  }

  if (user.activeRoleAssignment?.roleKey) {
    const preset = getRolePreset(user.activeRoleAssignment.roleKey);
    return buildEffectiveRoleFromPreset({
      user,
      preset,
      assignment: user.activeRoleAssignment,
      permissions: user.permisos,
    });
  }

  const userId = user._id || user.userId || null;
  const companyId = user.companyId || scope.companyId || null;
  if (userId && companyId) {
    const assignment = await UserRoleAssignment.findOne({
      userId,
      companyId,
      active: true,
    }).lean();
    if (assignment?.roleKey) {
      const preset = getRolePreset(assignment.roleKey);
      return buildEffectiveRoleFromPreset({
        user,
        preset,
        assignment,
        permissions: user.permisos,
      });
    }
  }

  if (user.roleKey && isValidRoleKey(user.roleKey)) {
    const preset = getRolePreset(user.roleKey);
    return buildEffectiveRoleFromPreset({
      user,
      preset,
      assignment: {
        scope: scope.roleScope || scope.scope || user.roleScope || user.scope || preset.allowedScopes?.[0],
        departmentCode: scope.departmentCode || user.departmentCode || "",
        teamId: scope.teamId || user.teamId || "",
      },
      permissions: user.permisos,
    });
  }

  const preset = getPresetByLegacyRoleCode(user.roleCode || scope.roleCode || "");
  if (preset) {
    return buildEffectiveRoleFromPreset({
      user,
      preset,
      assignment: {
        scope: scope.roleScope || user.roleScope || preset.allowedScopes?.[0],
        departmentCode: scope.departmentCode || user.departmentCode || "",
        teamId: scope.teamId || user.teamId || "",
      },
      permissions: user.permisos,
    });
  }

  return null;
}

export async function can(user, action) {
  if (!action) return false;
  if (user?.isSuperAdmin) return true;
  const permissions = Array.isArray(user?.permisos) ? user.permisos : [];
  if (permissions.includes(action)) return true;
  const effectiveRole = await resolveEffectiveRole(user);
  return Array.isArray(effectiveRole?.permisos) && effectiveRole.permisos.includes(action);
}

export function scopeAccessAllowed(user, resource = {}) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  if (resource.companyId && user.companyId && !sameId(resource.companyId, user.companyId)) {
    return false;
  }

  const roleScope = user.roleScope || user.scope || user.effectiveRole?.roleScope || "ORGANIZATION";

  if (["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT"].includes(roleScope)) {
    return true;
  }

  if (roleScope === "DEPARTMENT") {
    const expected = normalizeDepartmentCode(user.departmentCode || user.effectiveRole?.departmentCode);
    const current = normalizeDepartmentCode(resource.departmentCode || resource.area);
    return Boolean(expected) && expected === current;
  }

  if (roleScope === "TEAM") {
    if (user.teamId && resource.teamId) {
      return sameId(user.teamId, resource.teamId);
    }
    if (user.employeeId && resource.managerId) {
      return sameId(user.employeeId, resource.managerId);
    }
    if (user.employeeId && resource.employeeId) {
      return sameId(user.employeeId, resource.employeeId);
    }
    return false;
  }

  if (roleScope === "SELF") {
    return (
      (user.employeeId && resource.employeeId && sameId(user.employeeId, resource.employeeId)) ||
      (user.userId && resource.userId && sameId(user.userId, resource.userId))
    );
  }

  return false;
}

export function assertScopeAccess(user, resource = {}) {
  if (!scopeAccessAllowed(user, resource)) {
    const error = new Error("No tienes acceso al recurso solicitado dentro de tu alcance");
    error.status = 403;
    throw error;
  }
  return true;
}

export function validateRoleAssignmentInput(payload = {}) {
  const roleKey = String(payload.roleKey || "").trim().toUpperCase();
  const scope = String(payload.scope || "").trim().toUpperCase();
  if (!isValidRoleKey(roleKey)) {
    const error = new Error("roleKey invalido");
    error.status = 400;
    throw error;
  }
  if (roleKey === "SUPER_ADMIN" || roleKey === "PLATFORM") {
    const error = new Error("No se permite asignar roles de plataforma desde cliente");
    error.status = 400;
    throw error;
  }
  if (!isValidRoleScope(scope)) {
    const error = new Error("scope invalido");
    error.status = 400;
    throw error;
  }
  const preset = getRolePreset(roleKey);
  if (!preset || !preset.allowedScopes.includes(scope)) {
    const error = new Error("El scope no es valido para el roleKey seleccionado");
    error.status = 400;
    throw error;
  }

  return {
    roleKey,
    scope,
    departmentCode: normalizeDepartmentCode(payload.departmentCode),
    teamId: String(payload.teamId || "").trim(),
    active: payload.active !== false,
  };
}

export function buildAssignmentSyncPlanForLegacyRole({
  currentAssignment = null,
  targetLegacyRoleCode,
}) {
  const legacyRoleCode = String(targetLegacyRoleCode || "").trim().toUpperCase();
  if (!legacyRoleCode) return null;

  const targetPreset = getPresetByLegacyRoleCode(legacyRoleCode);
  if (!targetPreset || targetPreset.roleKey === "SUPER_ADMIN") {
    return null;
  }

  if (!currentAssignment?.roleKey) {
    return {
      roleKey: targetPreset.roleKey,
      scope: targetPreset.allowedScopes?.[0] || "ORGANIZATION",
      departmentCode: "",
      teamId: "",
      active: true,
    };
  }

  const currentPreset = getRolePreset(currentAssignment.roleKey);
  if (currentPreset?.legacyRoleCode === legacyRoleCode) {
    return {
      roleKey: currentAssignment.roleKey,
      scope: currentAssignment.scope,
      departmentCode: normalizeDepartmentCode(currentAssignment.departmentCode),
      teamId: String(currentAssignment.teamId || "").trim(),
      active: currentAssignment.active !== false,
    };
  }

  if (!targetPreset.allowedScopes.includes(currentAssignment.scope)) {
    const error = new Error(
      "El rol base seleccionado no es compatible con el alcance actual. Actualizalo desde Roles y accesos."
    );
    error.status = 400;
    throw error;
  }

  return {
    roleKey: targetPreset.roleKey,
    scope: currentAssignment.scope,
    departmentCode: normalizeDepartmentCode(currentAssignment.departmentCode),
    teamId: String(currentAssignment.teamId || "").trim(),
    active: currentAssignment.active !== false,
  };
}

export async function syncPrimaryRoleAssignmentForUser({
  user,
  companyId,
  employeeId = null,
  roleKey,
  scope,
  departmentCode = "",
  teamId = "",
  active = true,
  session = null,
}) {
  if (!user?._id || !companyId || !roleKey || !scope) return null;

  const deactivateQuery = UserRoleAssignment.updateMany(
    { companyId, userId: user._id, _id: { $ne: user.activeRoleAssignment?._id || null } },
    { $set: { active: false } }
  );
  if (session) deactivateQuery.session(session);
  await deactivateQuery;

  const upsertQuery = UserRoleAssignment.findOneAndUpdate(
    { companyId, userId: user._id },
    {
      $set: {
        companyId,
        userId: user._id,
        employeeId: employeeId || user.employeeId || null,
        roleKey,
        scope,
        departmentCode,
        teamId,
        active,
      },
    },
    { upsert: true, new: true }
  );
  if (session) upsertQuery.session(session);
  const assignment = await upsertQuery;

  const legacyRole = await resolveLegacyRoleForPreset({ companyId, roleKey });
  if (legacyRole && String(user.roleId || "") !== String(legacyRole._id)) {
    user.roleId = legacyRole._id;
    await user.save(session ? { session } : undefined);
  }

  return assignment;
}

export function buildRolePresetCatalog() {
  return ROLE_PRESETS.map((preset) => ({
    roleKey: preset.roleKey,
    label: preset.label,
    description: preset.description,
    allowedScopes: preset.allowedScopes,
    defaultPermissions: preset.defaultPermissions,
    isSystem: preset.isSystem,
    cannot: preset.cannot,
  }));
}
