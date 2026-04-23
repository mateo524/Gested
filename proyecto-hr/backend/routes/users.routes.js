import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

router.get("/", auth, permit("manage_users"), async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId }).select("-passwordHash");
  res.json(users);
});

router.post("/", auth, permit("manage_users"), async (req, res) => {
  const { nombre, email, password, roleId } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    companyId: req.user.companyId,
    nombre,
    email,
    passwordHash,
    roleId,
  });

  res.json({ mensaje: "Usuario creado", user });
});

export default router;