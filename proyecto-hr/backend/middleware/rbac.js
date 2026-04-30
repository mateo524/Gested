export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    const userPermissions = req.user?.permisos || [];
    const authorized = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!authorized) {
      return res.status(403).json({
        mensaje: "No tienes permiso para realizar esta accion",
      });
    }

    next();
  };
}

export function requireAnyPermission(...requiredPermissions) {
  return (req, res, next) => {
    const userPermissions = req.user?.permisos || [];
    const authorized = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!authorized) {
      return res.status(403).json({
        mensaje: "No tienes permiso para acceder a este recurso",
      });
    }

    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.roleCode)) {
      return res.status(403).json({
        mensaje: "Tu rol no tiene acceso a este modulo",
      });
    }

    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      mensaje: "Solo Super Admin puede acceder a este recurso",
    });
  }

  next();
}
