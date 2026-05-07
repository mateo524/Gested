import express from "express";
import Metric from "../models/Metric.js";
import MetricLevel from "../models/MetricLevel.js";
import Competency from "../models/Competency.js";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

function resolveTenantIds(req) {
  const companyFromHeader = req.get("X-Company-Id");
  return {
    companyId: req.scope.isSuperAdmin
      ? req.body.companyId || req.query.companyId || companyFromHeader
      : req.scope.companyId || req.body.companyId || req.query.companyId,
    schoolId: req.scope.isSuperAdmin
      ? req.body.schoolId || req.query.schoolId || null
      : req.scope.schoolId || req.body.schoolId || req.query.schoolId || null,
  };
}

async function assertSchoolInCompany(companyId, schoolId) {
  if (!schoolId) return true;
  const school = await School.findOne({ _id: schoolId, companyId, activa: true }).select("_id").lean();
  return Boolean(school);
}

function normalizeLevels(levels) {
  if (!Array.isArray(levels)) return { levels: [] };

  const seen = new Set();
  const normalized = [];
  for (const level of levels) {
    const nivel = Number(level.nivel);
    const etiqueta = String(level.etiqueta || "").trim();
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5 || !etiqueta || seen.has(nivel)) {
      return { error: "Los niveles deben ser 1 a 5, sin duplicados y con etiqueta" };
    }
    seen.add(nivel);
    normalized.push({
      nivel,
      etiqueta,
      descripcion: String(level.descripcion || "").trim(),
    });
  }

  return { levels: normalized };
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

  const effectiveSchoolId = schoolId || competency.schoolId || null;
  if (!(await assertSchoolInCompany(companyId, effectiveSchoolId))) {
    return res.status(400).json({ mensaje: "El colegio seleccionado no pertenece a tu organizacion" });
  }

  if (competency.schoolId && effectiveSchoolId && String(competency.schoolId) !== String(effectiveSchoolId)) {
    return res.status(400).json({ mensaje: "La competencia seleccionada pertenece a otro colegio" });
  }

  const normalizedLevels = normalizeLevels(req.body.levels);
  if (normalizedLevels.error) {
    return res.status(400).json({ mensaje: normalizedLevels.error });
  }

  const metric = await Metric.create({
    companyId,
    schoolId: effectiveSchoolId,
    competencyId: req.body.competencyId,
    nombre: req.body.nombre.trim(),
    descripcion: req.body.descripcion?.trim() || "",
    cargoAplica: Array.isArray(req.body.cargoAplica) ? req.body.cargoAplica : [],
    ponderacion: Number(req.body.ponderacion || 1),
    activa: req.body.activa !== false,
  });

  const incomingLevels = normalizedLevels.levels;

  if (incomingLevels.length) {
    await MetricLevel.insertMany(
      incomingLevels.map((level) => ({
        metricId: metric._id,
        nivel: level.nivel,
        etiqueta: level.etiqueta,
        descripcion: level.descripcion,
      }))
    );
  }

  await logAudit({
    companyId,
    schoolId: effectiveSchoolId,
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

  if (req.body.competencyId && String(req.body.competencyId) !== String(metric.competencyId)) {
    const competency = await Competency.findOne({
      _id: req.body.competencyId,
      companyId: metric.companyId,
      $or: [{ schoolId: metric.schoolId }, { schoolId: null }],
    }).lean();

    if (!competency) {
      return res.status(400).json({ mensaje: "La competencia seleccionada no pertenece al alcance de la metrica" });
    }

    metric.competencyId = competency._id;
  }

  ["nombre", "descripcion", "cargoAplica", "ponderacion", "activa"].forEach((field) => {
    if (field in req.body) {
      metric[field] = req.body[field];
    }
  });

  await metric.save();

  if (Array.isArray(req.body.levels)) {
    const normalizedLevels = normalizeLevels(req.body.levels);
    if (normalizedLevels.error) {
      return res.status(400).json({ mensaje: normalizedLevels.error });
    }

    await MetricLevel.deleteMany({ metricId: metric._id });
    if (normalizedLevels.levels.length) {
      await MetricLevel.insertMany(
        normalizedLevels.levels.map((level) => ({
          metricId: metric._id,
          nivel: level.nivel,
          etiqueta: level.etiqueta,
          descripcion: level.descripcion,
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
