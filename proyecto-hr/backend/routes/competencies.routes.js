import express from "express";
import Competency from "../models/Competency.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

function resolveTenantIds(req) {
  return {
    companyId: req.scope.isSuperAdmin ? req.body.companyId || req.query.companyId : req.scope.companyId,
    schoolId: req.scope.isSuperAdmin ? req.body.schoolId || req.query.schoolId || null : req.scope.schoolId,
  };
}

router.get("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const filter = buildScopedFilter(req, {});

  if (req.query.tipo) filter.tipo = req.query.tipo;
  if (req.query.componente) filter.componente = req.query.componente;
  if (req.query.schoolId && req.scope.isSuperAdmin) filter.schoolId = req.query.schoolId;
  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [{ nombre: regex }, { descripcion: regex }];
  }

  const competencies = await Competency.find(filter).sort({ nombre: 1 }).lean();
  res.json(competencies);
});

router.post("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const { companyId, schoolId } = resolveTenantIds(req);

  if (!companyId || !req.body.nombre || !req.body.tipo || !req.body.componente) {
    return res.status(400).json({ mensaje: "Debes indicar nombre, tipo y componente" });
  }

  const competency = await Competency.create({
    companyId,
    schoolId,
    nombre: req.body.nombre.trim(),
    descripcion: req.body.descripcion?.trim() || "",
    tipo: req.body.tipo,
    componente: req.body.componente,
    activa: req.body.activa !== false,
  });

  await logAudit({
    companyId,
    schoolId,
    userId: req.user.userId,
    accion: "create",
    modulo: "competencies",
    detalle: `Se creo la competencia ${competency.nombre}`,
  });

  res.status(201).json({ mensaje: "Competencia creada", competency });
});

router.put("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const competency = await Competency.findOne(filter);

  if (!competency) {
    return res.status(404).json({ mensaje: "Competencia no encontrada" });
  }

  ["nombre", "descripcion", "tipo", "componente", "activa"].forEach((field) => {
    if (field in req.body) {
      competency[field] = req.body[field];
    }
  });

  await competency.save();

  await logAudit({
    companyId: competency.companyId,
    schoolId: competency.schoolId,
    userId: req.user.userId,
    accion: "update",
    modulo: "competencies",
    detalle: `Se actualizo la competencia ${competency.nombre}`,
  });

  res.json({ mensaje: "Competencia actualizada", competency });
});

export default router;
