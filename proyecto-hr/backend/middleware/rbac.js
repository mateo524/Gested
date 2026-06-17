import { can } from "../utils/accessControl.js";
import User from "../models/User.js";
import { resolveEffectiveRole } from "../utils/accessControl.js";

async function hydrateUserPermissions(req) {
  // Re-fetch permissions from DB on each sensitive request.
  // Uses userId + iat as a per-request cache key to avoid N+1 on multi-permission checks.
  const cacheKey = `${req.user?.userId}:${req.user?.iat}`;
  if (req._permsCacheKey === cacheKey) return; // already hydrated this request

  const freshUser = await User.findOne({ _id: req.user?.userId, activo: true })
    .populate("roleId")
    .lean();
  if (!freshUser) {
    const err = new Error("Sesión inválida");
    err.status = 401;
    throw err;
  }

  const effectiveRole = await resolveEffectiveRole({
    ...freshUser,
    roleCode: freshUser.roleId?.code || null,
    roleScope: freshUser.roleId?.scope || "company",
    permisos: freshUser.roleId?.permisos || [],
  });

  req.user.permisos = effectiveRole?.permisos || freshUser.roleId?.permisos || [];
  req.user.isSuperAdmin = !!freshUser.isSuperAdmin;
  req._permsCacheKey = cacheKey;
}

export function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    try {
      await hydrateUserPermissions(req);
    } catch (err) {
      return res.status(err.status || 401).json({ mensaje: err.message || "Sesión inválida" });
    }

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
    try {
      await hydrateUserPermissions(req);
    } catch (err) {
      return res.status(err.status || 401).json({ mensaje: err.message || "Sesión inválida" });
    }

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
