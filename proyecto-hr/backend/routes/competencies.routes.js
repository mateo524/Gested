import express from "express";
import Competency from "../models/Competency.js";
import Metric from "../models/Metric.js";
import Employee from "../models/Employee.js";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { cacheGetOrFetch, cacheDelete } from "../utils/cache.js";

const router = express.Router();

function resolveTenantIds(req) {
  const companyFromHeader = req.get("X-Company-Id");
  return {
    companyId: req.scope.isSuperAdmin
      ? req.body.companyId || req.query.companyId || companyFromHeader
      : req.scope.companyId,
    schoolId: req.scope.isSuperAdmin
      ? req.body.schoolId || req.query.schoolId || null
      : req.scope.schoolId || null,
  };
}

async function assertSchoolInCompany(companyId, schoolId) {
  if (!schoolId) return true;
  const school = await School.findOne({ _id: schoolId, companyId, activa: true }).select("_id").lean();
  return Boolean(school);
}

router.get("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const companyId = String(req.scope.companyId || "");
  const hasFilters = req.query.tipo || req.query.componente || req.query.schoolId || req.query.q?.trim();

  if (!hasFilters && companyId) {
    const cached = await cacheGetOrFetch(
      `competencies:${companyId}`,
      async () => {
        const filter = buildScopedFilter(req, {});
        return Competency.find(filter).sort({ nombre: 1 }).lean();
      },
      300 // 5 minutes
    );
    return res.json(cached);
  }

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

  if (!(await assertSchoolInCompany(companyId, schoolId))) {
    return res.status(400).json({ mensaje: "El colegio seleccionado no pertenece a tu organizacion" });
  }

  const scopedEmployeeIds = Array.isArray(req.body.audienceEmployeeIds) && req.body.audienceEmployeeIds.length
    ? await Employee.find(
        buildScopedFilter(req, {
          _id: { $in: req.body.audienceEmployeeIds },
          activo: true,
        })
      )
        .select("_id")
        .lean()
    : [];

  const competency = await Competency.create({
    companyId,
    schoolId,
    nombre: req.body.nombre.trim(),
    descripcion: req.body.descripcion?.trim() || "",
    tipo: req.body.tipo,
    componente: req.body.componente,
    activa: req.body.activa !== false,
    audienceType: req.body.audienceType || "all",
    audienceDepartmentCodes: Array.isArray(req.body.audienceDepartmentCodes)
      ? req.body.audienceDepartmentCodes.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    audienceEmployeeIds: scopedEmployeeIds.map((item) => item._id),
    metadata: req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {},
  });

  cacheDelete(`competencies:${companyId}`);

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

  if ("audienceType" in req.body) {
    competency.audienceType = req.body.audienceType || "all";
  }
  if ("audienceDepartmentCodes" in req.body) {
    competency.audienceDepartmentCodes = Array.isArray(req.body.audienceDepartmentCodes)
      ? req.body.audienceDepartmentCodes.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  }
  if ("audienceEmployeeIds" in req.body) {
    const scopedEmployees = Array.isArray(req.body.audienceEmployeeIds) && req.body.audienceEmployeeIds.length
      ? await Employee.find(
          buildScopedFilter(req, {
            _id: { $in: req.body.audienceEmployeeIds },
            activo: true,
          })
        )
          .select("_id")
          .lean()
      : [];
    competency.audienceEmployeeIds = scopedEmployees.map((item) => item._id);
  }
  if ("metadata" in req.body && req.body.metadata && typeof req.body.metadata === "object") {
    competency.metadata = req.body.metadata;
  }

  await competency.save();

  cacheDelete(`competencies:${String(competency.companyId)}`);

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

router.delete("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const competency = await Competency.findOne(filter);
  if (!competency) {
    return res.status(404).json({ mensaje: "Competencia no encontrada" });
  }

  const metricCount = await Metric.countDocuments({
    companyId: competency.companyId,
    schoolId: competency.schoolId,
    competencyId: competency._id,
  });
  if (metricCount > 0) {
    return res.status(400).json({ mensaje: "No se puede eliminar la competencia porque tiene indicadores asociados" });
  }

  await Competency.deleteOne({ _id: competency._id });

  cacheDelete(`competencies:${String(competency.companyId)}`);

  await logAudit({
    companyId: competency.companyId,
    schoolId: competency.schoolId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "competencies",
    detalle: `Se elimino la competencia ${competency.nombre}`,
  });

  res.json({ mensaje: "Competencia eliminada" });
});

export default router;
