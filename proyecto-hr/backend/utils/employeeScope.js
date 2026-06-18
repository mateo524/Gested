import Employee from "../models/Employee.js";

function normalizeScopeContext(scope = {}) {
  return {
    roleKey: scope.roleKey || null,
    roleCode: scope.roleCode || null,
    roleScope: scope.roleScope || scope.scope || null,
    departmentCode: String(scope.departmentCode || "").trim(),
    employeeId: scope.employeeId || null,
    companyId: scope.companyId || null,
    schoolId: scope.schoolId || null,
    isSuperAdmin: Boolean(scope.isSuperAdmin),
  };
}

export function isManagerScope(scope = {}) {
  const context = normalizeScopeContext(scope);
  return context.roleKey === "MANAGER" || context.roleCode === "JEFE";
}

export function isEmployeeScope(scope = {}) {
  const context = normalizeScopeContext(scope);
  return context.roleKey === "EMPLOYEE" || context.roleCode === "EMPLEADO";
}

export function isDepartmentManagerScope(scope = {}) {
  const context = normalizeScopeContext(scope);
  return isManagerScope(context) && context.roleScope === "DEPARTMENT" && context.departmentCode;
}

export async function getScopedEmployeeIds(scope = {}, overrides = {}) {
  const context = normalizeScopeContext({ ...scope, ...overrides });

  if (!isManagerScope(context)) return null;
  if (!context.employeeId && !isDepartmentManagerScope(context)) return [];

  const filter = {
    companyId: context.companyId,
    activo: true,
  };

  if (!context.schoolId) return [];
  filter.schoolId = context.schoolId;

  if (isDepartmentManagerScope(context)) {
    filter.area = context.departmentCode;
  } else {
    filter.managerId = context.employeeId;
  }

  const employees = await Employee.find(filter).select("_id").lean();
  return employees.map((item) => item._id);
}
