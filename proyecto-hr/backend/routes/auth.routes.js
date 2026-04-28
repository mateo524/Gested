import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Company from "../models/Company.js";
import { auth } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

async function buildSafeUser(user) {
  const role = await Role.findById(user.roleId).lean();
  const company = await Company.findById(user.companyId).lean();

  return {
    _id: user._id,
    companyId: user.companyId,
    roleId: user.roleId,
    nombre: user.nombre,
    email: user.email,
    activo: user.activo,
    isSuperAdmin: !!user.isSuperAdmin,
    mustChangePassword: !!user.mustChangePassword,
    roleName: role?.nombre || "Sin rol",
    companyName: company?.nombre || "Sin empresa",
    permisos: role?.permisos || [],
  };
}

function buildToken(user, safeUser) {
  return jwt.sign(
    {
      userId: user._id,
      companyId: user.companyId,
      roleId: user.roleId,
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

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y password son obligatorios" });
    }

    const user = await User.findOne({ email, activo: true });
    if (!user) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    const safeUser = await buildSafeUser(user);

    if (!safeUser.isSuperAdmin) {
      const company = await Company.findById(user.companyId).lean();
      if (!company?.activa) {
        return res.status(403).json({ mensaje: "La empresa tiene el acceso suspendido" });
      }
    }

    const token = buildToken(user, safeUser);

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

export default router;
