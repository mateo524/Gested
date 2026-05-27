import express from "express";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import Employee from "../models/Employee.js";
import KPIRecord from "../models/KPIRecord.js";
import OKRRecord from "../models/OKRRecord.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { getScopedEmployeeIds, isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";
import { buildEvaluationFilter } from "./evaluations.routes.js";
import { buildOperationalRecordFilter } from "./metrics.routes.js";
import Evaluation from "../models/Evaluation.js";

const router = express.Router();

function roundProgress(value) {
  return Number((value * 100).toFixed(1));
}

function buildEmployeeName(employee = {}) {
  return [employee.apellido, employee.nombre].filter(Boolean).join(", ") || employee.nombre || "Empleado";
}

function buildSuggestionId(prefix, sourceId, employeeId) {
  return `${prefix}:${String(sourceId)}:${String(employeeId || "global")}`;
}

export function buildSuggestionTenantFilter(req, extra = {}) {
  return buildScopedFilter(req, extra);
}

export function buildDevelopmentSuggestionsFromData({
  employees = [],
  kpis = [],
  okrs = [],
  evaluations = [],
  plans = [],
  canCreatePlan = false,
}) {
  const suggestions = [];
  const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));
  const openPlanEmployeeIds = new Set(
    plans
      .filter((plan) => plan.estado !== "CERRADO")
      .map((plan) => String(plan.employeeId?._id || plan.employeeId))
      .filter(Boolean)
  );
  const now = Date.now();

  kpis.forEach((kpi) => {
    const employee = employeeMap.get(String(kpi.employeeId || ""));
    if (!employee || typeof kpi.targetValue !== "number" || kpi.targetValue <= 0) return;

    const currentValue = typeof kpi.currentValue === "number" ? kpi.currentValue : null;
    if (currentValue === null) return;

    const progress = currentValue / kpi.targetValue;
    if (progress >= 0.7) return;

    const hasPlan = openPlanEmployeeIds.has(String(employee._id));
    suggestions.push({
      id: buildSuggestionId("kpi", kpi._id, employee._id),
      employeeId: employee._id,
      employeeName: buildEmployeeName(employee),
      departmentCode: kpi.departmentCode || employee.area || "",
      sourceType: "kpi",
      sourceId: kpi._id,
      severity: progress < 0.4 ? "high" : "medium",
      title: hasPlan ? "Objetivo en riesgo que requiere seguimiento" : "Objetivo en riesgo sin plan activo",
      reason: `El KPI ${kpi.name} esta por debajo del 70% de avance esperado.`,
      suggestedAction: hasPlan
        ? "Revisar objetivo y acordar accion de seguimiento."
        : "Crear plan de desarrollo para acompanar el objetivo en riesgo.",
      recommendedPlanTitle: hasPlan
        ? `Seguimiento de KPI: ${kpi.name}`
        : `Acompanamiento para ${employee.nombre || "la persona"}: ${kpi.name}`,
      recommendedPlanDescription: hasPlan
        ? `Revisar el avance actual de ${kpi.name}, acordar ajustes y definir un siguiente seguimiento.`
        : `Definir acciones concretas para acompanar el KPI ${kpi.name} y sostener el avance durante el periodo ${kpi.period || "actual"}.`,
      evidence: [
        { label: "KPI", value: kpi.name },
        { label: "Meta", value: `${kpi.targetValue}${kpi.unit || ""}` },
        { label: "Actual", value: `${currentValue}${kpi.unit || ""}` },
        { label: "Avance", value: `${roundProgress(progress)}%` },
      ],
      canCreatePlan,
    });
  });

  okrs.forEach((okr) => {
    const employee = employeeMap.get(String(okr.employeeId || ""));
    if (!employee) return;
    const targetValue = typeof okr.targetValue === "number" ? okr.targetValue : null;
    const currentValue = typeof okr.currentValue === "number" ? okr.currentValue : null;
    const progress = targetValue && targetValue > 0 && currentValue !== null ? currentValue / targetValue : 0;

    if (currentValue !== null && currentValue > 0 && progress >= 0.15) return;

    suggestions.push({
      id: buildSuggestionId("okr", okr._id, employee._id),
      employeeId: employee._id,
      employeeName: buildEmployeeName(employee),
      departmentCode: okr.departmentCode || employee.area || "",
      sourceType: "okr",
      sourceId: okr._id,
      severity: currentValue === null || currentValue === 0 ? "high" : "medium",
      title: "Resultado clave con avance muy bajo",
      reason: `El OKR ${okr.objectiveTitle || okr.objective || "sin titulo"} no muestra avance suficiente todavia.`,
      suggestedAction: "Definir proximos pasos y responsables para destrabar el resultado clave.",
      recommendedPlanTitle: `Impulso de OKR: ${okr.objectiveTitle || okr.objective || "Resultado clave"}`,
      recommendedPlanDescription: `Acordar acciones concretas para mover el resultado clave ${okr.keyResultTitle || okr.keyResult || "principal"} durante el periodo ${okr.period || "actual"}.`,
      evidence: [
        { label: "Objetivo", value: okr.objectiveTitle || okr.objective || "-" },
        { label: "Resultado clave", value: okr.keyResultTitle || okr.keyResult || "-" },
        { label: "Meta", value: targetValue ?? "-" },
        { label: "Actual", value: currentValue ?? 0 },
        { label: "Avance", value: `${roundProgress(progress)}%` },
      ],
      canCreatePlan,
    });
  });

  evaluations.forEach((evaluation) => {
    const employee = employeeMap.get(String(evaluation.employeeId?._id || evaluation.employeeId || ""));
    if (!employee) return;
    if (evaluation.estado === "CERRADA") return;

    suggestions.push({
      id: buildSuggestionId("evaluation", evaluation._id, employee._id),
      employeeId: employee._id,
      employeeName: buildEmployeeName(employee),
      departmentCode: employee.area || "",
      sourceType: "evaluation",
      sourceId: evaluation._id,
      severity: evaluation.estado === "REVISADA" ? "medium" : "high",
      title: "Evaluacion pendiente de cierre",
      reason: "Hay una evaluacion abierta que todavia no termino de consolidarse.",
      suggestedAction: "Completar evaluacion para poder definir plan de desarrollo.",
      recommendedPlanTitle: `Seguimiento posterior a evaluacion de ${employee.nombre || "la persona"}`,
      recommendedPlanDescription: "Una vez cerrada la evaluacion, definir las acciones concretas de mejora y su seguimiento.",
      evidence: [
        { label: "Tipo", value: evaluation.tipo },
        { label: "Estado", value: evaluation.estado },
        { label: "Resultado", value: evaluation.resultadoFinal ?? "-" },
      ],
      canCreatePlan: false,
    });
  });

  plans.forEach((plan) => {
    const employee = employeeMap.get(String(plan.employeeId?._id || plan.employeeId || ""));
    if (!employee) return;
    if (!plan.fechaSeguimiento || plan.estado === "CERRADO") return;
    if (new Date(plan.fechaSeguimiento).getTime() >= now) return;

    suggestions.push({
      id: buildSuggestionId("plan", plan._id, employee._id),
      employeeId: employee._id,
      employeeName: buildEmployeeName(employee),
      departmentCode: employee.area || "",
      sourceType: "plan",
      sourceId: plan._id,
      severity: "medium",
      title: "Plan vencido sin seguimiento actualizado",
      reason: "La fecha de seguimiento del plan ya vencio y conviene revisarlo.",
      suggestedAction: "Revisar plan vencido y actualizar seguimiento.",
      recommendedPlanTitle: `Actualizacion de seguimiento: ${employee.nombre || "Plan"}`,
      recommendedPlanDescription: `Revisar el plan sobre "${plan.aspectoDesarrollar}" y acordar un nuevo siguiente paso.`,
      evidence: [
        { label: "Aspecto", value: plan.aspectoDesarrollar },
        { label: "Estado", value: plan.estado },
        { label: "Seguimiento", value: new Date(plan.fechaSeguimiento).toLocaleDateString("es-AR") },
      ],
      canCreatePlan: false,
    });
  });

  return suggestions.sort((a, b) => {
    const severityWeight = { high: 3, medium: 2, low: 1 };
    return severityWeight[b.severity] - severityWeight[a.severity];
  });
}

async function loadSuggestionDataset(req) {
  const baseFilter = buildSuggestionTenantFilter(req, {});
  const canCreatePlan = req.user?.permisos?.includes(PERMISSIONS.MANAGE_DEVELOPMENT_PLANS) || req.user?.permisos?.includes(PERMISSIONS.EVALUATE_TEAM);

  const employeeFilter = { ...baseFilter, activo: true };
  let scopedEmployeeIds = null;

  if (isManagerScope(req.scope)) {
    scopedEmployeeIds = await getScopedEmployeeIds(req.scope);
    employeeFilter._id = { $in: scopedEmployeeIds };
  } else if (isEmployeeScope(req.scope)) {
    employeeFilter._id = req.scope.employeeId;
  }

  const employees = await Employee.find(employeeFilter)
    .select("_id nombre apellido cargo area")
    .lean();

  if (!employees.length) {
    return { employees: [], kpis: [], okrs: [], evaluations: [], plans: [], canCreatePlan };
  }

  const employeeIds = employees.map((employee) => employee._id);
  const recordsFilter = await buildOperationalRecordFilter(req);
  const evaluationFilter = await buildEvaluationFilter(req);
  const plansFilter = await buildPlansFilter(req);

  const [kpis, okrs, evaluations, plans] = await Promise.all([
    KPIRecord.find({ ...recordsFilter, employeeId: { $in: employeeIds }, active: { $ne: false } })
      .select("_id employeeId departmentCode name targetValue currentValue unit period status")
      .lean(),
    OKRRecord.find({ ...recordsFilter, employeeId: { $in: employeeIds }, active: { $ne: false } })
      .select("_id employeeId departmentCode objective objectiveTitle keyResult keyResultTitle targetValue currentValue period status")
      .lean(),
    Evaluation.find({ ...evaluationFilter, employeeId: { $in: employeeIds } })
      .select("_id employeeId tipo estado resultadoFinal createdAt")
      .populate("employeeId", "nombre apellido area")
      .lean(),
    DevelopmentPlan.find({ ...plansFilter, employeeId: { $in: employeeIds } })
      .select("_id employeeId aspectoDesarrollar fechaSeguimiento estado")
      .populate("employeeId", "nombre apellido area")
      .lean(),
  ]);

  return { employees, kpis, okrs, evaluations, plans, canCreatePlan };
}

router.get(
  "/suggestions",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.VIEW_SELF_PROFILE
  ),
  async (req, res) => {
    try {
      const dataset = await loadSuggestionDataset(req);
      const suggestions = buildDevelopmentSuggestionsFromData(dataset);
      res.json({ suggestions });
    } catch (error) {
      res.status(error.status || 400).json({ mensaje: error.message });
    }
  }
);

export async function buildPlansFilter(req) {
  const filter = buildScopedFilter(req, {});
  let jefeTeamIds = null;

  if (isManagerScope(req.scope)) {
    jefeTeamIds = await getScopedEmployeeIds(req.scope);
    filter.employeeId = { $in: jefeTeamIds };
  }

  if (isEmployeeScope(req.scope)) {
    filter.employeeId = req.scope.employeeId;
  }

  if (req.query.employeeId && !isEmployeeScope(req.scope)) {
    if (isManagerScope(req.scope)) {
      const requested = String(req.query.employeeId);
      const allowed = (jefeTeamIds || []).some((id) => String(id) === requested);
      if (!allowed) {
        const error = new Error("No puedes consultar planes de empleados fuera de tu equipo");
        error.status = 403;
        throw error;
      }
    }
    filter.employeeId = req.query.employeeId;
  }

  if (req.query.estado) {
    filter.estado = req.query.estado;
  }

  if (req.query.schoolId && req.scope.isSuperAdmin) {
    filter.schoolId = req.query.schoolId;
  }

  return filter;
}

async function canEditPlanEmployee(req, employeeId) {
  const employee = await Employee.findOne(buildScopedFilter(req, { _id: employeeId })).lean();
  if (!employee) return { ok: false, status: 404, mensaje: "Empleado no encontrado" };

  if (isManagerScope(req.scope)) {
    const teamIds = await getScopedEmployeeIds(req.scope);
    const allowed = teamIds.some((id) => String(id) === String(employee._id));
    if (!allowed) {
      return { ok: false, status: 403, mensaje: "Solo puedes gestionar planes de tu equipo" };
    }
  }

  return { ok: true, employee };
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.VIEW_SELF_PROFILE
  ),
  async (req, res) => {
    let filter;
    try {
      filter = await buildPlansFilter(req);
    } catch (error) {
      return res.status(error.status || 400).json({ mensaje: error.message });
    }
    const plans = await DevelopmentPlan.find(filter)
      .sort({ createdAt: -1 })
      .populate("employeeId", "nombre apellido cargo area")
      .populate("evaluationId", "tipo estado resultadoFinal createdAt")
      .populate("responsableUserId", "nombre email")
      .lean();

    res.json(plans);
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_DEVELOPMENT_PLANS, PERMISSIONS.EVALUATE_TEAM),
  async (req, res) => {
    if (!req.body.employeeId || !req.body.aspectoDesarrollar?.trim()) {
      return res.status(400).json({ mensaje: "Debes indicar empleado y aspecto a desarrollar" });
    }

    const permission = await canEditPlanEmployee(req, req.body.employeeId);
    if (!permission.ok) {
      return res.status(permission.status).json({ mensaje: permission.mensaje });
    }

    const employee = permission.employee;

    const plan = await DevelopmentPlan.create({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      employeeId: employee._id,
      evaluationId: req.body.evaluationId || null,
      fortalezas: Array.isArray(req.body.fortalezas)
        ? req.body.fortalezas.map((item) => String(item).trim()).filter(Boolean)
        : [],
      aspectoDesarrollar: req.body.aspectoDesarrollar.trim(),
      medicion: req.body.medicion?.trim() || "",
      fechaSeguimiento: req.body.fechaSeguimiento || null,
      responsableUserId: req.body.responsableUserId || null,
      estado: req.body.estado || "PENDIENTE",
    });

    await logAudit({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "development-plans",
      detalle: `Se creo plan de desarrollo para ${employee.apellido}, ${employee.nombre}`,
    });

    res.status(201).json({ mensaje: "Plan de desarrollo creado", plan });
  }
);

router.put(
  "/:id",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_DEVELOPMENT_PLANS, PERMISSIONS.EVALUATE_TEAM),
  async (req, res) => {
    const plan = await DevelopmentPlan.findOne(buildScopedFilter(req, { _id: req.params.id }));
    if (!plan) {
      return res.status(404).json({ mensaje: "Plan no encontrado" });
    }

    if (isManagerScope(req.scope)) {
      const teamIds = await getScopedEmployeeIds(req.scope);
      const allowed = teamIds.some((id) => String(id) === String(plan.employeeId));
      if (!allowed) {
        return res.status(403).json({ mensaje: "Solo puedes editar planes de tu equipo" });
      }
    }

    const editableFields = [
      "evaluationId",
      "fortalezas",
      "aspectoDesarrollar",
      "medicion",
      "fechaSeguimiento",
      "responsableUserId",
      "estado",
    ];

    editableFields.forEach((field) => {
      if (field in req.body) {
        plan[field] = req.body[field];
      }
    });

    await plan.save();

    await logAudit({
      companyId: plan.companyId,
      schoolId: plan.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "development-plans",
      detalle: `Se actualizo el plan ${plan._id}`,
    });

    res.json({ mensaje: "Plan actualizado", plan });
  }
);

router.delete(
  "/:id",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_DEVELOPMENT_PLANS, PERMISSIONS.EVALUATE_TEAM),
  async (req, res) => {
    const plan = await DevelopmentPlan.findOne(buildScopedFilter(req, { _id: req.params.id }));
    if (!plan) {
      return res.status(404).json({ mensaje: "Plan no encontrado" });
    }

    if (isManagerScope(req.scope)) {
      const teamIds = await getScopedEmployeeIds(req.scope);
      const allowed = teamIds.some((id) => String(id) === String(plan.employeeId));
      if (!allowed) {
        return res.status(403).json({ mensaje: "Solo puedes eliminar planes de tu equipo" });
      }
    }

    await DevelopmentPlan.deleteOne({ _id: plan._id });

    await logAudit({
      companyId: plan.companyId,
      schoolId: plan.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "development-plans",
      detalle: `Se elimino el plan ${plan._id}`,
    });

    res.json({ mensaje: "Plan eliminado" });
  }
);

export default router;
