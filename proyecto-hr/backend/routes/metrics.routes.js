import express from "express";
import Metric from "../models/Metric.js";
import MetricLevel from "../models/MetricLevel.js";
import Competency from "../models/Competency.js";
import Employee from "../models/Employee.js";
import KPIRecord from "../models/KPIRecord.js";
import OKRRecord from "../models/OKRRecord.js";
import School from "../models/School.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { buildEmployeeScopedFilter } from "../utils/accessControl.js";
import { getScopedEmployeeIds, isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { cacheGetOrFetch, cacheDelete } from "../utils/cache.js";

const router = express.Router();
const METRIC_RECORD_READ_PERMISSIONS = [
  PERMISSIONS.MANAGE_METRICS,
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.DOWNLOAD_REPORTS,
  PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
  PERMISSIONS.DOWNLOAD_SELF_REPORT,
  PERMISSIONS.READ_ONLY_ACCESS,
  PERMISSIONS.VIEW_AUDIT,
];
const readMetricRecordsAccess = requireAnyPermission(...METRIC_RECORD_READ_PERMISSIONS);

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

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value, fallback = "active") {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || fallback;
}

function toNullableNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBooleanValue(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["yes", "si", "true", "1", "active"].includes(normalized)) return true;
  if (["no", "false", "0", "inactive"].includes(normalized)) return false;
  return fallback;
}

function buildLookupKey(...parts) {
  return parts
    .map((part) => normalizeText(part).toLowerCase())
    .filter(Boolean)
    .join("|");
}

function buildCyclePeriod(cycle) {
  return [cycle?.anio, cycle?.periodo].filter(Boolean).join("-");
}

function serializeKpiRecord(item) {
  return {
    ...item,
    _id: String(item._id),
    employeeId: item.employeeId ? String(item.employeeId) : null,
    ownerUserId: item.ownerUserId ? String(item.ownerUserId) : null,
    cycleId: item.cycleId ? String(item.cycleId) : null,
    importJobId: item.importJobId ? String(item.importJobId) : item.sourceImportJobId ? String(item.sourceImportJobId) : null,
    createdBy: item.createdBy ? String(item.createdBy) : null,
    updatedBy: item.updatedBy ? String(item.updatedBy) : null,
    currentValue: item.currentValue ?? null,
    period: item.period || "",
    weight: item.weight ?? 1,
    source: item.source || (item.sourceImportJobId ? "bulk_import" : "manual"),
  };
}

function serializeOkrRecord(item) {
  return {
    ...item,
    _id: String(item._id),
    employeeId: item.employeeId ? String(item.employeeId) : null,
    ownerUserId: item.ownerUserId ? String(item.ownerUserId) : null,
    cycleId: item.cycleId ? String(item.cycleId) : null,
    importJobId: item.importJobId ? String(item.importJobId) : item.sourceImportJobId ? String(item.sourceImportJobId) : null,
    createdBy: item.createdBy ? String(item.createdBy) : null,
    updatedBy: item.updatedBy ? String(item.updatedBy) : null,
    currentValue: item.currentValue ?? null,
    period: item.period || item.quarter || "",
    quarter: item.quarter || item.period || "",
    objective: item.objective || item.objectiveTitle || "",
    objectiveTitle: item.objectiveTitle || item.objective || "",
    keyResult: item.keyResult || item.keyResultTitle || "",
    keyResultTitle: item.keyResultTitle || item.keyResult || "",
    weight: item.weight ?? 1,
    source: item.source || (item.sourceImportJobId ? "bulk_import" : "manual"),
  };
}

export async function buildOperationalRecordFilter(req, options = {}) {
  const requestedEmployeeId = options.employeeId ?? req.query.employeeId;
  const requestedDepartmentCode = options.departmentCode ?? req.query.departmentCode;

  const filter = await buildEmployeeScopedFilter(req, {
    extra: {},
    employeeField: "employeeId",
    departmentField: "departmentCode",
    requestedEmployeeId,
    requestedDepartmentCode,
    outOfScopeMessage: "No puedes consultar métricas operativas de empleados fuera de tu alcance",
  });

  if (req.query.teamId) {
    if (!req.scope.isSuperAdmin && req.scope.roleScope === "TEAM" && req.scope.teamId && req.query.teamId !== req.scope.teamId) {
      const error = new Error("No puedes consultar métricas de otro equipo");
      error.status = 403;
      throw error;
    }
    filter.teamId = req.scope.roleScope === "TEAM" && req.scope.teamId ? req.scope.teamId : req.query.teamId;
  }

  if (req.query.cycleId) filter.cycleId = req.query.cycleId;
  if (req.query.period) filter.period = normalizeText(req.query.period);
  if (req.query.status) filter.status = normalizeStatus(req.query.status);
  if ("active" in req.query) filter.active = toBooleanValue(req.query.active, true);
  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [...(filter.$or || []), { name: regex }, { kpiCode: regex }, { okrCode: regex }, { objectiveTitle: regex }, { keyResultTitle: regex }];
  }

  if (isManagerScope(req.scope) && !requestedEmployeeId) {
    const teamIds = await getScopedEmployeeIds(req.scope);
    const allowedIds = Array.isArray(teamIds) ? teamIds : [];

    if (req.scope.roleScope === "DEPARTMENT" && req.scope.departmentCode) {
      delete filter.employeeId;
      delete filter.departmentCode;
      filter.$or = [
        ...(filter.$or || []),
        { employeeId: { $in: allowedIds } },
        { departmentCode: req.scope.departmentCode },
      ];
    } else if (req.scope.roleScope === "TEAM" && req.scope.teamId) {
      delete filter.employeeId;
      filter.$or = [
        ...(filter.$or || []),
        { employeeId: { $in: allowedIds } },
        { teamId: req.scope.teamId },
      ];
    }
  }

  return filter;
}

async function attachEmployeeSnapshot(records, scope = {}) {
  const employeeIds = [...new Set(records.map((item) => String(item.employeeId || "")).filter(Boolean))];
  if (!employeeIds.length) return records;

  const employeeFilter = { _id: { $in: employeeIds } };
  if (!scope.isSuperAdmin && scope.companyId) employeeFilter.companyId = scope.companyId;
  if (!scope.isSuperAdmin && scope.schoolId) employeeFilter.schoolId = scope.schoolId;

  const employees = await Employee.find(employeeFilter)
    .select("_id nombre apellido cargo area email")
    .lean();
  const employeeMap = new Map(
    employees.map((item) => [
      String(item._id),
      {
        _id: String(item._id),
        fullName: [item.apellido, item.nombre].filter(Boolean).join(", "),
        cargo: item.cargo || "",
        area: item.area || "",
        email: item.email || "",
      },
    ])
  );

  return records.map((item) => ({
    ...item,
    employee: employeeMap.get(String(item.employeeId)) || null,
  }));
}

async function attachCycleSnapshot(records, scope = {}) {
  const cycleIds = [...new Set(records.map((item) => String(item.cycleId || "")).filter(Boolean))];
  if (!cycleIds.length) return records;

  const cycleFilter = { _id: { $in: cycleIds } };
  if (!scope.isSuperAdmin && scope.companyId) cycleFilter.companyId = scope.companyId;
  if (!scope.isSuperAdmin && scope.schoolId) cycleFilter.schoolId = scope.schoolId;

  const cycles = await EvaluationCycle.find(cycleFilter).select("_id anio periodo etapa estado").lean();
  const cycleMap = new Map(
    cycles.map((item) => [
      String(item._id),
      {
        _id: String(item._id),
        label: [item.anio, item.periodo, item.etapa].filter(Boolean).join(" - "),
        estado: item.estado,
      },
    ])
  );

  return records.map((item) => ({
    ...item,
    cycle: item.cycleId ? cycleMap.get(String(item.cycleId)) || null : null,
  }));
}

async function attachRecordReferences(records, scope = {}) {
  const withEmployee = await attachEmployeeSnapshot(records, scope);
  return attachCycleSnapshot(withEmployee, scope);
}

async function resolveScopedEmployee(req, employeeId, departmentCode = "", notFoundMessage = "Empleado no encontrado") {
  if (!employeeId) return null;
  const filter = await buildEmployeeScopedFilter(req, {
    extra: { _id: employeeId },
    employeeField: "_id",
    departmentField: "area",
    requestedEmployeeId: employeeId,
    requestedDepartmentCode: departmentCode,
    outOfScopeMessage: "No puedes operar sobre empleados fuera de tu alcance",
  });

  const employee = await Employee.findOne(filter)
    .select("_id companyId schoolId area managerId")
    .lean();

  if (!employee) {
    const error = new Error(notFoundMessage);
    error.status = 404;
    throw error;
  }
  return employee;
}

async function resolveOwnerUser(companyId, ownerUserId) {
  if (!ownerUserId) return null;
  const user = await User.findOne({ _id: ownerUserId, companyId, isSuperAdmin: false }).select("_id").lean();
  if (!user) {
    const error = new Error("El ownerUserId no pertenece a tu organización");
    error.status = 400;
    throw error;
  }
  return user;
}

async function resolveScopedCycle(req, companyId, schoolId, cycleId) {
  if (!cycleId) return null;
  const filter = buildScopedFilter(req, { _id: cycleId });
  const cycle = await EvaluationCycle.findOne(filter).select("_id anio periodo etapa estado schoolId").lean();
  if (!cycle) {
    const error = new Error("El ciclo no existe dentro de tu alcance");
    error.status = 404;
    throw error;
  }
  return cycle;
}

async function assertOperationalRecordAccess(req, record) {
  if (!record) return;
  if (req.scope.isSuperAdmin) return;

  if (String(record.companyId || "") !== String(req.scope.companyId || "")) {
    const error = new Error("No tienes acceso a registros de otra organización");
    error.status = 403;
    throw error;
  }
  if (req.scope.schoolId && String(record.schoolId || "") !== String(req.scope.schoolId || "")) {
    const error = new Error("No tienes acceso a registros de otro colegio");
    error.status = 403;
    throw error;
  }

  if (isEmployeeScope(req.scope)) {
    if (String(record.employeeId || "") !== String(req.scope.employeeId || "")) {
      const error = new Error("Solo puedes acceder a tus propios objetivos e indicadores");
      error.status = 403;
      throw error;
    }
    return;
  }

  if (isManagerScope(req.scope)) {
    const teamIds = await getScopedEmployeeIds(req.scope);
    const allowedIds = Array.isArray(teamIds) ? teamIds.map(String) : [];
    const recordEmployeeId = String(record.employeeId || "");

    if (recordEmployeeId && allowedIds.includes(recordEmployeeId)) {
      return;
    }

    if (req.scope.roleScope === "DEPARTMENT" && req.scope.departmentCode) {
      if (String(record.departmentCode || "").trim() === String(req.scope.departmentCode).trim()) {
        return;
      }
    }

    if (req.scope.roleScope === "TEAM" && req.scope.teamId) {
      if (String(record.teamId || "").trim() === String(req.scope.teamId).trim()) {
        return;
      }
    }

    const error = new Error("No puedes acceder a objetivos o indicadores fuera de tu alcance");
    error.status = 403;
    throw error;
  }
}

export async function buildOperationalRecordPayload(req, kind, currentRecord = null) {
  const { companyId, schoolId } = resolveTenantIds(req);
  if (!companyId) {
    const error = new Error("No se pudo resolver la organización desde el scope autenticado");
    error.status = 400;
    throw error;
  }

  let employee = null;
  if (req.body.employeeId || currentRecord?.employeeId) {
    employee = await resolveScopedEmployee(
      req,
      req.body.employeeId || currentRecord?.employeeId,
      req.body.departmentCode || currentRecord?.departmentCode || "",
      "Empleado no encontrado dentro de tu alcance"
    );
  }

  const effectiveSchoolId = schoolId || employee?.schoolId || currentRecord?.schoolId || null;
  if (!(await assertSchoolInCompany(companyId, effectiveSchoolId))) {
    const error = new Error("El colegio seleccionado no pertenece a tu organización");
    error.status = 400;
    throw error;
  }

  if (!employee && isManagerScope(req.scope) && req.scope.roleScope === "TEAM" && !req.scope.teamId) {
    const error = new Error("Para registrar indicadores de equipo debes asociar un empleado o definir teamId explícito");
    error.status = 400;
    throw error;
  }

  const cycle = await resolveScopedCycle(req, companyId, effectiveSchoolId, req.body.cycleId || currentRecord?.cycleId || null);
  const ownerUser = await resolveOwnerUser(companyId, req.body.ownerUserId || currentRecord?.ownerUserId || null);

  let departmentCode = normalizeText(req.body.departmentCode || currentRecord?.departmentCode || employee?.area || "");
  if (req.scope.roleScope === "DEPARTMENT" && req.scope.departmentCode) {
    if (departmentCode && departmentCode !== req.scope.departmentCode) {
      const error = new Error("No puedes operar fuera de tu departamento asignado");
      error.status = 403;
      throw error;
    }
    departmentCode = req.scope.departmentCode;
  }

  let teamId = normalizeText(req.body.teamId || currentRecord?.teamId || "");
  if (req.scope.roleScope === "TEAM" && req.scope.teamId) {
    if (teamId && teamId !== req.scope.teamId) {
      const error = new Error("No puedes operar sobre otro equipo");
      error.status = 403;
      throw error;
    }
    teamId = req.scope.teamId;
  }

  const basePayload = {
    companyId,
    schoolId: effectiveSchoolId,
    employeeId: employee?._id || currentRecord?.employeeId || null,
    ownerUserId: ownerUser?._id || currentRecord?.ownerUserId || null,
    departmentCode,
    teamId,
    cycleId: cycle?._id || currentRecord?.cycleId || null,
    period: normalizeText(
      req.body.period ||
      req.body.quarter ||
      currentRecord?.period ||
      currentRecord?.quarter ||
      (cycle ? buildCyclePeriod(cycle) : "")
    ),
    weight: toNullableNumber(req.body.weight, currentRecord?.weight ?? 1) ?? 1,
    status: normalizeStatus(req.body.status, currentRecord?.status || "active"),
    active: toBooleanValue("active" in req.body ? req.body.active : currentRecord?.active, currentRecord?.active ?? true),
    source: currentRecord?.source || "manual",
    importJobId: currentRecord?.importJobId || currentRecord?.sourceImportJobId || null,
    sourceImportJobId: currentRecord?.sourceImportJobId || currentRecord?.importJobId || null,
    lastImportedAt: currentRecord?.lastImportedAt || null,
    createdBy: currentRecord?.createdBy || req.user.userId || null,
    updatedBy: req.user.userId || currentRecord?.updatedBy || null,
  };

  if (kind === "kpi") {
    const kpiCode = normalizeText(req.body.kpiCode || currentRecord?.kpiCode || "");
    const name = normalizeText(req.body.name || currentRecord?.name || "");
    const targetValue = toNullableNumber("targetValue" in req.body ? req.body.targetValue : currentRecord?.targetValue, null);

    if (!name || targetValue === null) {
      const error = new Error("Debes indicar name y targetValue para el KPI");
      error.status = 400;
      throw error;
    }

    return {
      ...basePayload,
      lookupKey: buildLookupKey(kpiCode || name, basePayload.period, basePayload.employeeId, basePayload.departmentCode, basePayload.teamId),
      kpiCode,
      name,
      targetValue,
      currentValue: toNullableNumber("currentValue" in req.body ? req.body.currentValue : currentRecord?.currentValue, null),
      unit: normalizeText(req.body.unit || currentRecord?.unit || ""),
      frequency: normalizeText(req.body.frequency || currentRecord?.frequency || ""),
    };
  }

  const okrCode = normalizeText(req.body.okrCode || currentRecord?.okrCode || "");
  const objective = normalizeText(req.body.objective || req.body.objectiveTitle || currentRecord?.objective || currentRecord?.objectiveTitle || "");
  const keyResult = normalizeText(req.body.keyResult || req.body.keyResultTitle || currentRecord?.keyResult || currentRecord?.keyResultTitle || "");

  if (!objective || !keyResult) {
    const error = new Error("Debes indicar objective y keyResult para el OKR");
    error.status = 400;
    throw error;
  }

  return {
    ...basePayload,
    lookupKey: buildLookupKey(okrCode || objective, keyResult, basePayload.period, basePayload.employeeId, basePayload.departmentCode, basePayload.teamId),
    okrCode,
    objective,
    objectiveTitle: objective,
    keyResult,
    keyResultTitle: keyResult,
    quarter: basePayload.period,
    targetValue: toNullableNumber("targetValue" in req.body ? req.body.targetValue : currentRecord?.targetValue, null),
    currentValue: toNullableNumber("currentValue" in req.body ? req.body.currentValue : currentRecord?.currentValue, null),
  };
}

async function findOperationalRecordOrFail(req, Model, id, notFoundMessage) {
  const record = await Model.findOne(buildScopedFilter(req, { _id: id }));
  if (!record) {
    const error = new Error(notFoundMessage);
    error.status = 404;
    throw error;
  }
  await assertOperationalRecordAccess(req, record);
  return record;
}

router.get("/", auth, attachTenantScope, requireAnyPermission(PERMISSIONS.MANAGE_METRICS, PERMISSIONS.MANAGE_EVALUATIONS, PERMISSIONS.EVALUATE_TEAM, PERMISSIONS.SELF_EVALUATE, PERMISSIONS.VIEW_REPORTS), async (req, res) => {
  const companyId = String(req.scope.companyId || "");
  const hasFilters = req.query.competencyId || req.query.schoolId || req.query.q?.trim();

  if (!hasFilters && companyId) {
    const cached = await cacheGetOrFetch(
      `metrics:${companyId}`,
      async () => {
        const filter = buildScopedFilter(req, {});
        const metrics = await Metric.find(filter).sort({ orden: 1, nombre: 1 }).lean();
        const ids = metrics.map((item) => item._id);
        const levels = await MetricLevel.find({ metricId: { $in: ids } }).sort({ nivel: 1 }).lean();
        const levelMap = new Map();
        levels.forEach((level) => {
          const key = String(level.metricId);
          if (!levelMap.has(key)) levelMap.set(key, []);
          levelMap.get(key).push(level);
        });
        // Populate competencyId with name + description for grouping in eval form
        const compIds = [...new Set(metrics.map(m => String(m.competencyId)).filter(Boolean))];
        const comps = await Competency.find({ _id: { $in: compIds } }, { nombre: 1, descripcion: 1, tipo: 1 }).lean();
        const compMap = new Map(comps.map(c => [String(c._id), c]));
        return metrics.map((metric) => ({
          ...metric,
          competencyId: compMap.get(String(metric.competencyId)) || metric.competencyId,
          levels: levelMap.get(String(metric._id)) || [],
        }));
      },
      300 // 5 minutes
    );
    return res.json(cached);
  }

  const filter = buildScopedFilter(req, {});

  if (req.query.competencyId) filter.competencyId = req.query.competencyId;
  if (req.query.schoolId && req.scope.isSuperAdmin) filter.schoolId = req.query.schoolId;
  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [{ nombre: regex }, { descripcion: regex }, { cargoAplica: regex }];
  }

  const metrics = await Metric.find(filter).sort({ orden: 1, nombre: 1 }).lean();
  const ids = metrics.map((item) => item._id);
  const levels = await MetricLevel.find({ metricId: { $in: ids } }).sort({ nivel: 1 }).lean();
  const levelMap = new Map();

  levels.forEach((level) => {
    const key = String(level.metricId);
    if (!levelMap.has(key)) levelMap.set(key, []);
    levelMap.get(key).push(level);
  });

  const compIds2 = [...new Set(metrics.map(m => String(m.competencyId)).filter(Boolean))];
  const comps2 = await Competency.find({ _id: { $in: compIds2 } }, { nombre: 1, descripcion: 1, tipo: 1 }).lean();
  const compMap2 = new Map(comps2.map(c => [String(c._id), c]));

  res.json(metrics.map((metric) => ({
    ...metric,
    competencyId: compMap2.get(String(metric.competencyId)) || metric.competencyId,
    levels: levelMap.get(String(metric._id)) || [],
  })));
});

router.get("/kpi-records", auth, attachTenantScope, readMetricRecordsAccess, async (req, res) => {
  let filter;
  try {
    filter = await buildOperationalRecordFilter(req);
  } catch (error) {
    return res.status(error.status || 400).json({ mensaje: error.message });
  }
  const records = await KPIRecord.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
  const withRefs = await attachRecordReferences(records, req.scope);
  res.json(withRefs.map((item) => serializeKpiRecord(item)));
});

router.get("/kpi-records/:id", auth, attachTenantScope, readMetricRecordsAccess, async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, KPIRecord, req.params.id, "KPI no encontrado");
    const withRefs = await attachRecordReferences([record.toObject()], req.scope);
    res.json(serializeKpiRecord(withRefs[0]));
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.post("/kpi-records", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const payload = await buildOperationalRecordPayload(req, "kpi");
    const record = await KPIRecord.create(payload);

    await logAudit({
      companyId: payload.companyId,
      schoolId: payload.schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "kpi-records",
      detalle: `Se creó el KPI ${payload.name}`,
    });

    res.status(201).json({ mensaje: "KPI creado", record: serializeKpiRecord(record.toObject()) });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.put("/kpi-records/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, KPIRecord, req.params.id, "KPI no encontrado");
    const payload = await buildOperationalRecordPayload(req, "kpi", record);
    Object.assign(record, payload);
    await record.save();

    await logAudit({
      companyId: record.companyId,
      schoolId: record.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "kpi-records",
      detalle: `Se actualizó el KPI ${record.name}`,
    });

    res.json({ mensaje: "KPI actualizado", record: serializeKpiRecord(record.toObject()) });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.delete("/kpi-records/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, KPIRecord, req.params.id, "KPI no encontrado");
    await KPIRecord.deleteOne({ _id: record._id });

    await logAudit({
      companyId: record.companyId,
      schoolId: record.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "kpi-records",
      detalle: `Se eliminó el KPI ${record.name}`,
    });

    res.json({ mensaje: "KPI eliminado" });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.get("/okr-records", auth, attachTenantScope, readMetricRecordsAccess, async (req, res) => {
  let filter;
  try {
    filter = await buildOperationalRecordFilter(req);
  } catch (error) {
    return res.status(error.status || 400).json({ mensaje: error.message });
  }
  const records = await OKRRecord.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
  const withRefs = await attachRecordReferences(records, req.scope);
  res.json(withRefs.map((item) => serializeOkrRecord(item)));
});

router.get("/okr-records/:id", auth, attachTenantScope, readMetricRecordsAccess, async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, OKRRecord, req.params.id, "OKR no encontrado");
    const withRefs = await attachRecordReferences([record.toObject()], req.scope);
    res.json(serializeOkrRecord(withRefs[0]));
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.post("/okr-records", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const payload = await buildOperationalRecordPayload(req, "okr");
    const record = await OKRRecord.create(payload);

    await logAudit({
      companyId: payload.companyId,
      schoolId: payload.schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "okr-records",
      detalle: `Se creó el OKR ${payload.objectiveTitle}`,
    });

    res.status(201).json({ mensaje: "OKR creado", record: serializeOkrRecord(record.toObject()) });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.put("/okr-records/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, OKRRecord, req.params.id, "OKR no encontrado");
    const payload = await buildOperationalRecordPayload(req, "okr", record);
    Object.assign(record, payload);
    await record.save();

    await logAudit({
      companyId: record.companyId,
      schoolId: record.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "okr-records",
      detalle: `Se actualizó el OKR ${record.objectiveTitle}`,
    });

    res.json({ mensaje: "OKR actualizado", record: serializeOkrRecord(record.toObject()) });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
});

router.delete("/okr-records/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  try {
    const record = await findOperationalRecordOrFail(req, OKRRecord, req.params.id, "OKR no encontrado");
    await OKRRecord.deleteOne({ _id: record._id });

    await logAudit({
      companyId: record.companyId,
      schoolId: record.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "okr-records",
      detalle: `Se eliminó el OKR ${record.objectiveTitle}`,
    });

    res.json({ mensaje: "OKR eliminado" });
  } catch (error) {
    res.status(error.status || 400).json({ mensaje: error.message });
  }
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

  cacheDelete(`metrics:${companyId}`);

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

  cacheDelete(`metrics:${String(metric.companyId)}`);

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

router.delete("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_METRICS), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const metric = await Metric.findOne(filter);
  if (!metric) {
    return res.status(404).json({ mensaje: "Metrica no encontrada" });
  }

  await MetricLevel.deleteMany({ metricId: metric._id });
  await Metric.deleteOne({ _id: metric._id });

  cacheDelete(`metrics:${String(metric.companyId)}`);

  await logAudit({
    companyId: metric.companyId,
    schoolId: metric.schoolId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "metrics",
    detalle: `Se elimino la metrica ${metric.nombre}`,
  });

  res.json({ mensaje: "Metrica eliminada" });
});

export default router;
