import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, activo: true }).lean();
    if (!user) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    const role = await Role.findById(user.roleId).lean();

    const token = jwt.sign(
      {
        userId: user._id,
        companyId: user.companyId,
        roleId: user.roleId,
        permisos: role?.permisos || [],
        nombre: user.nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ mensaje: "Login correcto", token, user });
  } catch (error) {
    res.status(500).json({ mensaje: "Error en login", error: error.message });
  }
});

export default router;