import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Company from "../models/Company.js";
import AuditLog from "../models/AuditLog.js";
import { auth } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { resolveEffectiveRole } from "../utils/accessControl.js";

const router = express.Router();

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
// WARNING: loginAttempts/loginLocks are in-process Maps. They reset on restart and
// do NOT work across multiple instances (PM2 clusters, containers, load balancers).
// For multi-instance deployments, replace with a shared Redis store using
// rate-limit-redis or store state in the DB.
const loginAttempts = new Map();
const loginLocks = new Map();

function loginKey(req, email) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return `${String(ip)}::${String(email || "").toLowerCase()}`;
}

function cleanOldAttempts(key) {
  const now = Date.now();
  const items = loginAttempts.get(key) || [];
  const filtered = items.filter((timestamp) => now - timestamp <= LOGIN_WINDOW_MS);
  if (filtered.length) loginAttempts.set(key, filtered);
  else loginAttempts.delete(key);
  return filtered;
}

function registerFailedAttempt(key) {
  const attempts = cleanOldAttempts(key);
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
  if (attempts.length >= LOGIN_MAX_ATTEMPTS) {
    loginLocks.set(key, Date.now() + LOCK_TIME_MS);
  }
}

function clearAttempts(key) {
  loginAttempts.delete(key);
  loginLocks.delete(key);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    mensaje: "Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.",
  },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    mensaje: "Demasiadas solicitudes. Intenta nuevamente más tarde.",
  },
});

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function trimText(value) {
  return String(value || "").trim();
}

function validateAvatarUrl(value) {
  const nextValue = trimText(value);
  if (!nextValue) return "";
  try {
    const parsed = new URL(nextValue);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid_protocol");
    }
    return parsed.toString();
  } catch {
    throw createRouteError(400, "El avatar debe ser una URL valida.");
  }
}

export function sanitizeSelfProfilePayload(body = {}) {
  return {
    nombre: trimText(body.nombre),
    apellido: trimText(body.apellido),
    avatarUrl: validateAvatarUrl(body.avatarUrl),
  };
}

export function buildSafeUserPayload({ user, role, company, effectiveRole }) {
  return {
    _id: user._id,
    companyId: user.companyId,
    schoolId: user.schoolId || null,
    roleId: user.roleId,
    employeeId: user.employeeId || null,
    nombre: user.nombre,
    apellido: user.apellido || "",
    email: user.email,
    avatarUrl: user.avatarUrl || "",
    activo: user.activo,
    isSuperAdmin: !!user.isSuperAdmin,
    mustChangePassword: !!user.mustChangePassword,
    roleName: role?.nombre || "Sin rol",
    roleCode: effectiveRole?.roleCode || role?.code || null,
    roleKey: effectiveRole?.roleKey || null,
    roleLabel: effectiveRole?.roleLabel || role?.nombre || "Sin rol",
    roleScope: effectiveRole?.roleScope || role?.scope || "company",
    scope: effectiveRole?.roleScope || role?.scope || "company",
    departmentCode: effectiveRole?.departmentCode || "",
    teamId: effectiveRole?.teamId || "",
    companyName: company?.nombre || "Sin empresa",
    permisos: effectiveRole?.permisos || role?.permisos || [],
  };
}

export function validatePasswordChangePayload(body = {}) {
  const currentPassword = trimText(body.currentPassword);
  const newPassword = trimText(body.newPassword);
  const confirmPassword =
    body.confirmPassword === undefined ? undefined : trimText(body.confirmPassword);

  if (!currentPassword || !newPassword) {
    throw createRouteError(400, "Debes indicar password actual y nueva");
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw createRouteError(400, `La nueva password debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw createRouteError(400, "La confirmacion de la nueva password no coincide");
  }

  return { currentPassword, newPassword };
}

export async function updateOwnPassword({ user, currentPassword, newPassword }) {
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    throw createRouteError(401, "La password actual no coincide");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  if (typeof user.save === "function") {
    await user.save();
  }

  return user;
}

async function buildSafeUser(user) {
  const role = user.roleId ? await Role.findById(user.roleId).lean() : null;
  const company = await Company.findById(user.companyId).lean();
  const effectiveRole = await resolveEffectiveRole({
    ...user.toObject(),
    roleCode: role?.code || null,
    roleScope: role?.scope || "company",
    permisos: role?.permisos || [],
  });

  return buildSafeUserPayload({ user, role, company, effectiveRole });
}

function buildToken(user, safeUser) {
  return jwt.sign(
    {
      userId: user._id,
      companyId: user.companyId,
      schoolId: user.schoolId || null,
      roleId: user.roleId,
      employeeId: user.employeeId || null,
      roleCode: safeUser.roleCode,
      roleKey: safeUser.roleKey || null,
      roleScope: safeUser.roleScope,
      scope: safeUser.scope,
      departmentCode: safeUser.departmentCode || "",
      teamId: safeUser.teamId || "",
      isSuperAdmin: !!user.isSuperAdmin,
      permisos: safeUser.permisos,
      nombre: user.nombre,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function buildResetUrl(rawToken) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const key = loginKey(req, email);

    const lockUntil = loginLocks.get(key);
    if (lockUntil && lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        mensaje: `Demasiados intentos fallidos. Reintenta en ${waitMinutes} minuto(s).`,
      });
    }
    if (lockUntil && lockUntil <= Date.now()) {
      loginLocks.delete(key);
    }

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y password son obligatorios" });
    }

    const user = await User.findOne({ email, activo: true });
    if (!user) {
      registerFailedAttempt(key);
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      registerFailedAttempt(key);
      await logAudit({
        companyId: user.companyId,
        userId: user._id,
        accion: "login_failed",
        modulo: "seguridad",
        detalle: "Intento de login fallido",
        metadata: { email, ip: req.ip || null },
      });
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    clearAttempts(key);

    const safeUser = await buildSafeUser(user);

    if (!safeUser.isSuperAdmin) {
      const company = await Company.findById(user.companyId).lean();
      if (!company?.activa) {
        return res.status(403).json({ mensaje: "La empresa tiene el acceso suspendido" });
      }
    }

    const token = buildToken(user, safeUser);

    await logAudit({
      companyId: user.companyId,
      userId: user._id,
      accion: "login_success",
      modulo: "seguridad",
      detalle: "Inicio de sesion exitoso",
      metadata: { email, ip: req.ip || null },
    });

    res.json({ mensaje: "Login correcto", token, user: safeUser });
  } catch (err) {
    console.error('[auth] login error', err);
    res.status(500).json({ mensaje: "Error en login" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user.userId,
      companyId: req.user.companyId,
      activo: true,
    });

    if (!user) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const safeUser = await buildSafeUser(user);

    if (!safeUser.isSuperAdmin) {
      const company = await Company.findById(user.companyId).lean();
      if (!company?.activa) {
        return res.status(403).json({ mensaje: "La empresa tiene el acceso suspendido" });
      }
    }

    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
});

router.put("/me/profile", auth, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user.userId,
      companyId: req.user.companyId,
      activo: true,
    });

    if (!user) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const payload = sanitizeSelfProfilePayload(req.body || {});
    if (!payload.nombre) {
      return res.status(400).json({ mensaje: "El nombre es obligatorio." });
    }

    user.nombre = payload.nombre;
    user.apellido = payload.apellido;
    user.avatarUrl = payload.avatarUrl;
    await user.save();

    await logAudit({
      companyId: user.companyId,
      userId: user._id,
      accion: "actualizacion",
      modulo: "perfil",
      detalle: "El usuario actualizo sus datos basicos",
    });

    const safeUser = await buildSafeUser(user);
    const token = buildToken(user, safeUser);

    res.json({
      mensaje: "Perfil actualizado",
      token,
      user: safeUser,
    });
  } catch (error) {
    res.status(error.status || 500).json({ mensaje: error.message || "No pudimos actualizar el perfil." });
  }
});

async function handleChangeOwnPassword(req, res) {
  let currentPassword = "";
  let newPassword = "";
  try {
    ({ currentPassword, newPassword } = validatePasswordChangePayload(req.body || {}));

    const user = await User.findById(req.user.userId);

    if (!user || !user.activo) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    await updateOwnPassword({ user, currentPassword, newPassword });

    await logAudit({
      companyId: user.companyId,
      userId: user._id,
      accion: "actualizacion",
      modulo: "seguridad",
      detalle: "El usuario actualizo su password de acceso",
    });

    const safeUser = await buildSafeUser(user);
    const token = buildToken(user, safeUser);

    return res.json({
      mensaje: "Password actualizada",
      token,
      user: safeUser,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ mensaje: error.message || "No pudimos actualizar la password." });
  }
}

router.put("/me/password", auth, passwordChangeLimiter, handleChangeOwnPassword);
router.post("/change-password", auth, passwordChangeLimiter, handleChangeOwnPassword);

router.post("/forgot-password", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ mensaje: "Debes indicar un email" });
    }

    const user = await User.findOne({ email, activo: true });

    if (!user) {
      return res.json({
        mensaje:
          "Si el correo existe, enviaremos un enlace para restablecer la contrasena.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashResetToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = buildResetUrl(rawToken);
    const mailResult = await sendPasswordResetEmail({ to: user.email, resetUrl });

    await logAudit({
      companyId: user.companyId,
      userId: user._id,
      accion: "password_reset_requested",
      modulo: "seguridad",
      detalle: "Se solicito recuperacion de contrasena",
      metadata: { email: user.email, sentByEmail: !!mailResult?.sent },
    });

    res.json({
      mensaje:
        "Si el correo existe, enviaremos un enlace para restablecer la contrasena.",
      delivery:
        mailResult?.sent
          ? "email_sent"
          : "email_not_configured",
    });
  } catch (err) {
    console.error('[auth] forgot-password error', err);
    res.status(500).json({ mensaje: "Error interno" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const rawToken = req.body.token?.trim();
    const newPassword = req.body.newPassword?.trim();

    if (!rawToken || !newPassword) {
      return res.status(400).json({ mensaje: "Debes indicar token y nueva contrasena" });
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ mensaje: `La nueva contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });
    }

    const tokenHash = hashResetToken(rawToken);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      activo: true,
    });

    if (!user) {
      return res.status(400).json({ mensaje: "El token no es valido o expiro" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    await logAudit({
      companyId: user.companyId,
      userId: user._id,
      accion: "password_reset_completed",
      modulo: "seguridad",
      detalle: "Contrasena restablecida por token",
    });

    res.json({ mensaje: "Contrasena actualizada correctamente" });
  } catch (err) {
    console.error('[auth] reset-password error', err);
    res.status(500).json({ mensaje: "Error interno" });
  }
});

router.get("/security-status", auth, async (req, res) => {
  if (!req.user.isSuperAdmin && !req.user.permisos?.includes("manage_settings")) {
    return res.status(403).json({ mensaje: "No tienes permisos para ver estado de seguridad" });
  }

  const [failedLogins, successLogins] = await Promise.all([
    AuditLog.find({
      companyId: req.user.companyId,
      modulo: "seguridad",
      accion: "login_failed",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    AuditLog.find({
      companyId: req.user.companyId,
      modulo: "seguridad",
      accion: "login_success",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  res.json({
    policy: {
      windowMinutes: LOGIN_WINDOW_MS / 60000,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      lockMinutes: LOCK_TIME_MS / 60000,
    },
    recentFailedLogins: failedLogins,
    recentSuccessLogins: successLogins,
  });
});

export default router;
