import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Company from "../models/Company.js";
import AuditLog from "../models/AuditLog.js";
import { auth } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
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

async function buildSafeUser(user) {
  const role = await Role.findById(user.roleId).lean();
  const company = await Company.findById(user.companyId).lean();

  return {
    _id: user._id,
    companyId: user.companyId,
    schoolId: user.schoolId || null,
    roleId: user.roleId,
    employeeId: user.employeeId || null,
    nombre: user.nombre,
    email: user.email,
    activo: user.activo,
    isSuperAdmin: !!user.isSuperAdmin,
    mustChangePassword: !!user.mustChangePassword,
    roleName: role?.nombre || "Sin rol",
    roleCode: role?.code || null,
    roleScope: role?.scope || "company",
    companyName: company?.nombre || "Sin empresa",
    permisos: role?.permisos || [],
  };
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
      roleScope: safeUser.roleScope,
      isSuperAdmin: !!user.isSuperAdmin,
      permisos: safeUser.permisos,
      nombre: user.nombre,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

router.post("/login", async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ mensaje: "Error en login", error: error.message });
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
  } catch {
    res.status(401).json({ mensaje: "Token invalido" });
  }
});

router.post("/change-password", auth, async (req, res) => {
  const currentPassword = req.body.currentPassword?.trim();
  const newPassword = req.body.newPassword?.trim();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ mensaje: "Debes indicar password actual y nueva" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ mensaje: "La nueva password debe tener al menos 6 caracteres" });
  }

  const user = await User.findById(req.user.userId);

  if (!user || !user.activo) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ mensaje: "La password actual no coincide" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();

  await logAudit({
    companyId: user.companyId,
    userId: user._id,
    accion: "actualizacion",
    modulo: "seguridad",
    detalle: "El usuario actualizo su password de acceso",
  });

  const safeUser = await buildSafeUser(user);
  const token = buildToken(user, safeUser);

  res.json({
    mensaje: "Password actualizada",
    token,
    user: safeUser,
  });
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
