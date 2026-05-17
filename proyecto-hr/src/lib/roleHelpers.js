export function isEmployeeUser(user) {
  return user?.roleKey === "EMPLOYEE" || user?.roleCode === "EMPLEADO";
}

export function isManagerUser(user) {
  return user?.roleKey === "MANAGER" || user?.roleCode === "JEFE";
}

export function isReadOnlyUser(user, hasPermission) {
  return (
    user?.roleKey === "VIEWER" ||
    user?.roleKey === "AUDITOR" ||
    ["LECTOR", "LECTOR_AUDITOR"].includes(user?.roleCode || "") ||
    hasPermission?.("read_only_access")
  );
}

export function isAdminOrgUser(user) {
  return (
    user?.isSuperAdmin ||
    user?.roleKey === "ORG_OWNER" ||
    user?.roleKey === "ORG_ADMIN" ||
    user?.roleKey === "HR" ||
    user?.roleCode === "ADMIN_COLEGIO" ||
    user?.roleCode === "RRHH"
  );
}

export function canManageOnboardingUser(user) {
  return (
    isAdminOrgUser(user) ||
    user?.permisos?.includes("manage_settings") ||
    user?.permisos?.includes("manage_employees") ||
    user?.permisos?.includes("manage_users")
  );
}
