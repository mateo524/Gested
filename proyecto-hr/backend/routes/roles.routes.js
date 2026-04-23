import express from "express";
import Role from "../models/Role.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const roles = await Role.find({ companyId: req.user.companyId });
  res.json(roles);
});

router.post("/", auth, permit("manage_roles"), async (req, res) => {
  const role = await Role.create({
    companyId: req.user.companyId,
    nombre: req.body.nombre,
    permisos: req.body.permisos || [],
  });

  res.json({ mensaje: "Rol creado", role });
});

export default router;