import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Company from "../models/Company.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y password son obligatorios" });
    }

    const user = await User.findOne({ email, activo: true }).lean();
    if (!user) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    const role = await Role.findById(user.roleId).lean();
    const company = await Company.findById(user.companyId).lean();
    const safeUser = {
      _id: user._id,
      companyId: user.companyId,
      roleId: user.roleId,
      nombre: user.nombre,
      email: user.email,
      activo: user.activo,
      isSuperAdmin: !!user.isSuperAdmin,
      roleName: role?.nombre || "Sin rol",
      companyName: company?.nombre || "Sin empresa",
      permisos: role?.permisos || [],
    };

    const token = jwt.sign(
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

    res.json({ mensaje: "Login correcto", token, user: safeUser });
  } catch (error) {
    res.status(500).json({ mensaje: "Error en login", error: error.message });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "No autorizado" });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      _id: payload.userId,
      companyId: payload.companyId,
      activo: true,
    }).lean();

    if (!user) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    const role = await Role.findById(user.roleId).lean();
    const company = await Company.findById(user.companyId).lean();

    res.json({
      _id: user._id,
      companyId: user.companyId,
      roleId: user.roleId,
      nombre: user.nombre,
      email: user.email,
      activo: user.activo,
      isSuperAdmin: !!user.isSuperAdmin,
      roleName: role?.nombre || "Sin rol",
      companyName: company?.nombre || "Sin empresa",
      permisos: role?.permisos || [],
    });
  } catch (error) {
    res.status(401).json({ mensaje: "Token inválido" });
  }
});

export default router;
