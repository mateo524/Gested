import express from "express";
import Record from "../models/Record.js";
import { requireAuth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { companyScope } from "../utils/companyScope.js";

const router = express.Router();

// Obtener todos los registros de empleados de la empresa
router.get("/", requireAuth, companyScope, async (req, res) => {
  try {
    const records = await Record.find({ companyId: req.company._id }).sort({
      nombreCompleto: 1,
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un registro específico
router.get("/:id", requireAuth, companyScope, async (req, res) => {
  try {
    const record = await Record.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un registro (requiere permiso de manage_users)
router.put("/:id", requireAuth, permit("manage_users"), companyScope, async (req, res) => {
  try {
    const record = await Record.findOneAndUpdate(
      { _id: req.params.id, companyId: req.company._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un registro (requiere permiso de manage_users)
router.delete("/:id", requireAuth, permit("manage_users"), companyScope, async (req, res) => {
  try {
    const record = await Record.findOneAndDelete({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
