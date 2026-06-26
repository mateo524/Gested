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
import { runInBackground } from "../utils/background.js";
import { triggerSheetSync } from "../utils/sheetSync.js";

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

  async function fetchList() {
    const filter = buildScopedFilter(req, {});
    if (req.query.tipo) filter.tipo = req.query.tipo;
    if (req.query.componente) filter.componente = req.query.componente;
    if (req.query.schoolId && req.scope.isSuperAdmin) filter.schoolId = req.query.schoolId;
    if (req.query.q?.trim()) {
      const regex = { $regex: req.query.q.trim(), $options: "i" };
      filter.$or = [{ nombre: regex }, { descripcion: regex }];
    }
    const competencies = await Competency.find(filter).sort({ nombre: 1 }).lean();
    if (!competencies.length) return competencies;
    const ids = competencies.map((c) => c._id);
    const counts = await Metric.aggregate([
      { $match: { competencyId: { $in: ids } } },
      { $group: { _id: "$competencyId", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    return competencies.map((c) => ({ ...c, descriptoresCount: countMap[String(c._id)] || 0 }));
  }

  if (!hasFilters && companyId) {
    const cached = await cacheGetOrFetch(`competencies:${companyId}`, fetchList, 300);
    return res.json(cached);
  }

  res.json(await fetchList());
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

  const rawDescriptores = Array.isArray(req.body.descriptores) ? req.body.descriptores : [];
  const validDescriptores = rawDescriptores.filter((d) => String(d?.nombre || "").trim());
  if (validDescriptores.length > 0) {
    await Metric.insertMany(
      validDescriptores.map((d) => ({
        companyId,
        schoolId: schoolId ?? null,
        competencyId: competency._id,
        nombre: String(d.nombre).trim(),
        descripcion: String(d.descripcion || "").trim(),
        ponderacion: 1,
        activa: true,
      }))
    );
    cacheDelete(`metrics:${companyId}`);
  }

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
  runInBackground(() => triggerSheetSync({ companyId: competency.companyId, schoolId: competency.schoolId }), "sheet-sync-competency-create");
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

  if (Array.isArray(req.body.descriptores)) {
    const incoming = req.body.descriptores
      .filter((d) => String(d?.nombre || "").trim())
      .map((d) => ({
        _id: d._id ? String(d._id) : null,
        nombre: String(d.nombre).trim(),
        descripcion: String(d.descripcion || "").trim(),
      }));

    const currentMetrics = await Metric.find({
      companyId: competency.companyId,
      competencyId: competency._id,
    }).select("_id").lean();

    const incomingIds = new Set(incoming.filter((d) => d._id).map((d) => d._id));
    const toDelete = currentMetrics
      .filter((m) => !incomingIds.has(String(m._id)))
      .map((m) => m._id);
    if (toDelete.length > 0) await Metric.deleteMany({ _id: { $in: toDelete } });

    if (incoming.length > 0) {
      const ops = incoming.map((d) => ({
        updateOne: {
          filter: d._id
            ? { _id: d._id, companyId: competency.companyId }
            : { companyId: competency.companyId, competencyId: competency._id, nombre: d.nombre },
          update: {
            $set: { nombre: d.nombre, descripcion: d.descripcion },
            $setOnInsert: {
              companyId: competency.companyId,
              schoolId: competency.schoolId ?? null,
              competencyId: competency._id,
              ponderacion: 1,
              activa: true,
            },
          },
          upsert: true,
        },
      }));
      await Metric.bulkWrite(ops);
    }
    cacheDelete(`metrics:${String(competency.companyId)}`);
  }

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
  runInBackground(() => triggerSheetSync({ companyId: String(competency.companyId), schoolId: competency.schoolId ? String(competency.schoolId) : undefined }), "sheet-sync-competency-update");
});

router.delete("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_COMPETENCIES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const competency = await Competency.findOne(filter);
  if (!competency) {
    return res.status(404).json({ mensaje: "Competencia no encontrada" });
  }

  await Metric.deleteMany({ companyId: competency.companyId, competencyId: competency._id });
  await Competency.deleteOne({ _id: competency._id });

  cacheDelete(`competencies:${String(competency.companyId)}`);
  cacheDelete(`metrics:${String(competency.companyId)}`);

  await logAudit({
    companyId: competency.companyId,
    schoolId: competency.schoolId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "competencies",
    detalle: `Se elimino la competencia ${competency.nombre}`,
  });

  res.json({ mensaje: "Competencia eliminada" });
  runInBackground(() => triggerSheetSync({ companyId: String(competency.companyId), schoolId: competency.schoolId ? String(competency.schoolId) : undefined }), "sheet-sync-competency-delete");
});

export default router;
