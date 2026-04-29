import express from "express";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import { requireAuth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { companyScope } from "../utils/companyScope.js";

const router = express.Router();

// Obtener todos los planes de desarrollo
router.get("/", requireAuth, companyScope, async (req, res) => {
  try {
    const planes = await DevelopmentPlan.find({ companyId: req.company._id }).sort({
      createdAt: -1,
    });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener planes de desarrollo de un empleado
router.get("/employee/:employeeId", requireAuth, companyScope, async (req, res) => {
  try {
    const planes = await DevelopmentPlan.find({
      employeeId: req.params.employeeId,
      companyId: req.company._id,
    }).sort({ createdAt: -1 });

    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un plan específico
router.get("/:id", requireAuth, companyScope, async (req, res) => {
  try {
    const plan = await DevelopmentPlan.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo plan de desarrollo
router.post("/", requireAuth, permit("manage_users"), companyScope, async (req, res) => {
  try {
    const newPlan = new DevelopmentPlan({
      ...req.body,
      companyId: req.company._id,
    });

    await newPlan.save();
    res.status(201).json(newPlan);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar un plan de desarrollo
router.put("/:id", requireAuth, permit("manage_users"), companyScope, async (req, res) => {
  try {
    const plan = await DevelopmentPlan.findOneAndUpdate(
      { _id: req.params.id, companyId: req.company._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    res.json(plan);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar un objetivo específico del plan
router.put("/:id/objectives/:objectiveIndex", requireAuth, companyScope, async (req, res) => {
  try {
    const plan = await DevelopmentPlan.findOne({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    const objIndex = parseInt(req.params.objectiveIndex);
    if (objIndex >= 0 && objIndex < plan.objetivos.length) {
      plan.objetivos[objIndex] = { ...plan.objetivos[objIndex], ...req.body };

      // Recalcular progreso
      const completados = plan.objetivos.filter((o) => o.estado === "completado").length;
      plan.progreso = Math.round((completados / plan.objetivos.length) * 100);

      await plan.save();
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un plan de desarrollo
router.delete("/:id", requireAuth, permit("manage_users"), companyScope, async (req, res) => {
  try {
    const plan = await DevelopmentPlan.findOneAndDelete({
      _id: req.params.id,
      companyId: req.company._id,
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    res.json({ message: "Plan eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
