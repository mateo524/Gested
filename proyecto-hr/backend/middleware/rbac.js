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
