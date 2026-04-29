import express from "express";
import Metric from "../models/Metric.js";
import MetricLevel from "../models/MetricLevel.js";
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

router.get("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  const filter = buildScopedFilter(req, {});

  if (req.query.competencyId) filter.competencyId = req.query.competencyId;
  if (req.query.schoolId && req.scope.isSuperAdmin) filter.schoolId = req.query.schoolId;
  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [{ nombre: regex }, { descripcion: regex }, { cargoAplica: regex }];
  }

  const metrics = await Metric.find(filter).sort({ nombre: 1 }).lean();
  const ids = metrics.map((item) => item._id);
  const levels = await MetricLevel.find({ metricId: { $in: ids } }).sort({ nivel: 1 }).lean();
  const levelMap = new Map();

  levels.forEach((level) => {
    const key = String(level.metricId);
    if (!levelMap.has(key)) levelMap.set(key, []);
    levelMap.get(key).push(level);
  });

  res.json(metrics.map((metric) => ({ ...metric, levels: levelMap.get(String(metric._id)) || [] })));
});

router.post("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  const { companyId, schoolId } = resolveTenantIds(req);

  if (!companyId || !req.body.competencyId || !req.body.nombre) {
    return res.status(400).json({ mensaje: "Debes indicar competencia y nombre de la metrica" });
  }

  const competency = await Competency.findOne({
    _id: req.body.competencyId,
    companyId,
  }).lean();

  if (!competency) {
    return res.status(404).json({ mensaje: "Competencia no encontrada" });
  }

  const metric = await Metric.create({
    companyId,
    schoolId,
    competencyId: req.body.competencyId,
    nombre: req.body.nombre.trim(),
    descripcion: req.body.descripcion?.trim() || "",
    cargoAplica: Array.isArray(req.body.cargoAplica) ? req.body.cargoAplica : [],
    ponderacion: Number(req.body.ponderacion || 1),
    activa: req.body.activa !== false,
  });

  const incomingLevels = Array.isArray(req.body.levels) ? req.body.levels : [];

  if (incomingLevels.length) {
    await MetricLevel.insertMany(
      incomingLevels.map((level) => ({
        metricId: metric._id,
        nivel: level.nivel,
        etiqueta: level.etiqueta,
        descripcion: level.descripcion || "",
      }))
    );
  }

  await logAudit({
    companyId,
    schoolId,
    userId: req.user.userId,
    accion: "create",
    modulo: "metrics",
    detalle: `Se creo la metrica ${metric.nombre}`,
  });

  res.status(201).json({ mensaje: "Metrica creada", metric });
});

router.put("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const metric = await Metric.findOne(filter);

  if (!metric) {
    return res.status(404).json({ mensaje: "Metrica no encontrada" });
  }

  ["nombre", "descripcion", "cargoAplica", "ponderacion", "activa"].forEach((field) => {
    if (field in req.body) {
      metric[field] = req.body[field];
    }
  });

  await metric.save();

  if (Array.isArray(req.body.levels)) {
    await MetricLevel.deleteMany({ metricId: metric._id });
    if (req.body.levels.length) {
      await MetricLevel.insertMany(
        req.body.levels.map((level) => ({
          metricId: metric._id,
          nivel: level.nivel,
          etiqueta: level.etiqueta,
          descripcion: level.descripcion || "",
        }))
      );
    }
  }

  await logAudit({
    companyId: metric.companyId,
    schoolId: metric.schoolId,
    userId: req.user.userId,
    accion: "update",
    modulo: "metrics",
    detalle: `Se actualizo la metrica ${metric.nombre}`,
  });

  res.json({ mensaje: "Metrica actualizada", metric });
});

export default router;
