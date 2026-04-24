import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

router.get("/", auth, permit("manage_users"), async (req, res) => {
  try {
    const users = await User.find({ companyId: req.user.companyId })
      .select("-passwordHash")
      .populate("roleId", "nombre permisos")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al cargar usuarios",
      error: error.message,
    });
  }
});

router.post("/", auth, permit("manage_users"), async (req, res) => {
  try {
    const { nombre, email, password, roleId } = req.body;

    if (!nombre || !email || !password || !roleId) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios",
      });
    }

    const role = await Role.findOne({
      _id: roleId,
      companyId: req.user.companyId,
    });

    if (!role) {
      return res.status(404).json({
        mensaje: "Rol no encontrado",
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({
        mensaje: "Ya existe un usuario con ese email",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      companyId: req.user.companyId,
      roleId,
      nombre,
      email,
      passwordHash,
      activo: true,
    });

    await logAudit({
      companyId: req.user.companyId,
      userId: req.user.userId,
      accion: "crear_usuario",
      modulo: "usuarios",
      detalle: `Se creó el usuario ${email}`,
    });

    res.json({
      mensaje: "Usuario creado correctamente",
      user,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear usuario",
      error: error.message,
    });
  }
});

router.put("/:id", auth, permit("manage_users"), async (req, res) => {
  try {
    const { nombre, email, roleId, activo } = req.body;

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    user.nombre = nombre ?? user.nombre;
    user.email = email ?? user.email;
    user.roleId = roleId ?? user.roleId;

    if (typeof activo === "boolean") {
      user.activo = activo;
    }

    await user.save();

    await logAudit({
      companyId: req.user.companyId,
      userId: req.user.userId,
      accion: "editar_usuario",
      modulo: "usuarios",
      detalle: `Se editó el usuario ${user.email}`,
    });

    res.json({
      mensaje: "Usuario actualizado correctamente",
      user,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar usuario",
      error: error.message,
    });
  }
});

router.put("/:id/password", auth, permit("manage_users"), async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        mensaje: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    await logAudit({
      companyId: req.user.companyId,
      userId: req.user.userId,
      accion: "cambiar_password",
      modulo: "usuarios",
      detalle: `Se cambió la contraseña de ${user.email}`,
    });

    res.json({
      mensaje: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al cambiar contraseña",
      error: error.message,
    });
  }
});

router.delete("/:id", auth, permit("manage_users"), async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!user) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    user.activo = false;
    await user.save();

    await logAudit({
      companyId: req.user.companyId,
      userId: req.user.userId,
      accion: "desactivar_usuario",
      modulo: "usuarios",
      detalle: `Se desactivó el usuario ${user.email}`,
    });

    res.json({
      mensaje: "Usuario desactivado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al desactivar usuario",
      error: error.message,
    });
  }
});

export default router;