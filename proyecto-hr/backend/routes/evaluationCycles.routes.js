import express from "express";
import EvaluationCycle from "../models/EvaluationCycle.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

function resolveTenantIds(req) {
  return {
    companyId: req.scope.isSuperAdmin ? req.body.companyId || req.query.companyId : req.scope.companyId,
    schoolId: req.scope.isSuperAdmin ? req.body.schoolId || req.query.schoolId : req.scope.schoolId,
  };
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES, PERMISSIONS.VIEW_REPORTS),
  async (req, res) => {
    const filter = buildScopedFilter(req, {});

    if (req.scope.isSuperAdmin && req.query.schoolId) {
      filter.schoolId = req.query.schoolId;
    }

    if (req.query.anio) {
      filter.anio = Number(req.query.anio);
    }

    if (req.query.estado) {
      filter.estado = req.query.estado;
    }

    const cycles = await EvaluationCycle.find(filter).sort({ anio: -1, fechaInicio: -1 }).lean();
    res.json(cycles);
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const { companyId, schoolId } = resolveTenantIds(req);

    if (!companyId || !schoolId || !req.body.anio || !req.body.periodo || !req.body.etapa) {
      return res.status(400).json({ mensaje: "Debes indicar colegio, año, periodo y etapa" });
    }

    const cycle = await EvaluationCycle.create({
      companyId,
      schoolId,
      anio: Number(req.body.anio),
      periodo: req.body.periodo.trim(),
      etapa: req.body.etapa,
      estado: req.body.estado || "BORRADOR",
      fechaInicio: req.body.fechaInicio,
      fechaFin: req.body.fechaFin,
    });

    await logAudit({
      companyId,
      schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "evaluation-cycles",
      detalle: `Se creo el ciclo ${cycle.periodo} ${cycle.anio}`,
    });

    res.status(201).json({ mensaje: "Ciclo creado", cycle });
  }
);

router.put(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const cycle = await EvaluationCycle.findOne(filter);

    if (!cycle) {
      return res.status(404).json({ mensaje: "Ciclo no encontrado" });
    }

    ["anio", "periodo", "etapa", "estado", "fechaInicio", "fechaFin"].forEach((field) => {
      if (field in req.body) {
        cycle[field] = req.body[field];
      }
    });

    await cycle.save();

    await logAudit({
      companyId: cycle.companyId,
      schoolId: cycle.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "evaluation-cycles",
      detalle: `Se actualizo el ciclo ${cycle.periodo} ${cycle.anio}`,
    });

    res.json({ mensaje: "Ciclo actualizado", cycle });
  }
);

export default router;
