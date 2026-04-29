export function attachTenantScope(req, _res, next) {
  const user = req.user;

  req.scope = {
    companyId: user?.companyId || null,
    schoolId: user?.schoolId || null,
    roleCode: user?.roleCode || null,
    employeeId: user?.employeeId || null,
    isSuperAdmin: !!user?.isSuperAdmin,
  };

  next();
}

export function buildScopedFilter(req, extra = {}) {
  const scope = req.scope || {};

  if (scope.isSuperAdmin) {
    return { ...extra };
  }

  const base = {
    ...extra,
    companyId: scope.companyId,
  };

  if (scope.schoolId) {
    base.schoolId = scope.schoolId;
  }

  return base;
}
