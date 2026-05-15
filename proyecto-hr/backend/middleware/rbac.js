import { can } from "../utils/accessControl.js";

export function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    const userPermissions = req.user?.permisos || [];
    const authorized = (
      await Promise.all(
        requiredPermissions.map(
          async (permission) => userPermissions.includes(permission) || await can(req.user, permission)
        )
      )
    ).every(Boolean);

    if (!authorized) {
      return res.status(403).json({
        mensaje: "No tienes permiso para realizar esta accion",
      });
    }

    next();
  };
}

export function requireAnyPermission(...requiredPermissions) {
  return async (req, res, next) => {
    const userPermissions = req.user?.permisos || [];
    const authorized = (
      await Promise.all(
        requiredPermissions.map(
          async (permission) => userPermissions.includes(permission) || await can(req.user, permission)
        )
      )
    ).some(Boolean);

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
    const currentRole = req.user?.roleCode || req.user?.roleKey;
    if (!roles.includes(currentRole)) {
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
