import express from "express";
import ExcelJS from "exceljs";
import { cacheGetOrFetch, cacheClearByPrefix } from "../utils/cache.js";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import EvaluationScore from "../models/EvaluationScore.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import Metric from "../models/Metric.js";
import Competency from "../models/Competency.js";
import KPIRecord from "../models/KPIRecord.js";
import OKRRecord from "../models/OKRRecord.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { getScopedEmployeeIds, isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";

const router = express.Router();
const EXECUTIVE_PERMISSION_SET = [
  PERMISSIONS.VIEW_GLOBAL_REPORTS,
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.DOWNLOAD_REPORTS,
  PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
  PERMISSIONS.VIEW_AUDIT,
];
const KPI_EMPTY_MESSAGE = "Todavia no hay KPIs persistidos para este periodo.";
const OKR_EMPTY_MESSAGE = "Todavia no hay OKRs persistidos para este periodo.";

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isDepartmentManager(scope = {}) {
  return isManagerScope(scope) && scope.roleScope === "DEPARTMENT" && scope.departmentCode;
}

function formatEmployeeName(employee) {
  if (!employee) return "Sin nombre";
  return [employee.apellido, employee.nombre].filter(Boolean).join(", ") || "Sin nombre";
}

function buildCycleLabel(cycle) {
  return [cycle.anio, cycle.periodo, cycle.etapa].filter(Boolean).join(" - ");
}

function calculateProgress(currentValue, targetValue) {
  const current = Number(currentValue);
  const target = Number(targetValue);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function summarizeOperationalStatus(records = []) {
  return records.reduce(
    (acc, record) => {
      const progress = calculateProgress(record.currentValue, record.targetValue);
      const rawStatus = String(record.status || "").trim().toLowerCase();

      if (rawStatus === "completed" || progress >= 100) {
        acc.completed += 1;
      } else if (progress === null) {
        acc.noData += 1;
      } else if (progress < 70 || rawStatus === "at_risk") {
        acc.atRisk += 1;
      } else {
        acc.inProgress += 1;
      }

      return acc;
    },
    { total: records.length, completed: 0, inProgress: 0, atRisk: 0, noData: 0 }
  );
}

export function assertExecutiveReportAccess(req) {
  const permissions = Array.isArray(req.user?.permisos) ? req.user.permisos : [];
  const allowed = req.user?.isSuperAdmin || EXECUTIVE_PERMISSION_SET.some((permission) => permissions.includes(permission));
  if (!allowed) {
    throw createHttpError(403, "No tienes permisos para ver el reporte ejecutivo.");
  }
  if (isEmployeeScope(req.scope)) {
    throw createHttpError(403, "El reporte ejecutivo organizacional no esta disponible para este perfil.");
  }
}

export function buildExecutiveBaseEmployeeFilter(scope, options = {}) {
  if (isEmployeeScope(scope)) {
    throw createHttpError(403, "El reporte ejecutivo organizacional no esta disponible para este perfil.");
  }

  const filter = {
    companyId: options.companyId || scope.companyId,
    activo: true,
  };

  if (!scope.isSuperAdmin && scope.schoolId) {
    filter.schoolId = scope.schoolId;
  }

  if (options.schoolId && scope.isSuperAdmin) {
    filter.schoolId = options.schoolId;
  }

  if (isDepartmentManager(scope)) {
    const requestedDepartment = String(options.department || "").trim();
    if (requestedDepartment && requestedDepartment !== scope.departmentCode) {
      throw createHttpError(403, "Solo puedes ver empleados de tu departamento asignado.");
    }
    filter.area = scope.departmentCode;
    return filter;
  }

  const requestedDepartment = String(options.department || "").trim();
  if (requestedDepartment) {
    filter.area = requestedDepartment;
  }

  return filter;
}

async function getAllowedManagerEmployeeIds(scope, baseFilter) {
  if (!isManagerScope(scope) || isDepartmentManager(scope)) {
    return null;
  }
  return getScopedEmployeeIds(scope, { extraFilter: baseFilter });
}

function summarizeEmployees(employees, evaluationMap, plansMap, managerMap) {
  return employees.map((employee) => {
    const evalStats = evaluationMap.get(String(employee._id)) || {
      total: 0,
      pending: 0,
      average: 0,
      latestAt: null,
    };
    const planStats = plansMap.get(String(employee._id)) || {
      total: 0,
      open: 0,
      overdue: 0,
      latestAt: null,
    };

    return {
      _id: String(employee._id),
      fullName: formatEmployeeName(employee),
      nombre: employee.nombre,
      apellido: employee.apellido,
      email: employee.email || "",
      cargo: employee.cargo || "",
      area: employee.area || "",
      hasManager: Boolean(employee.managerId),
      managerName: employee.managerId ? managerMap.get(String(employee.managerId)) || "" : "",
      evaluationCount: evalStats.total,
      pendingEvaluations: evalStats.pending,
      averageScore: Number((evalStats.average || 0).toFixed(2)),
      latestEvaluationAt: evalStats.latestAt,
      planCount: planStats.total,
      openPlans: planStats.open,
      overduePlans: planStats.overdue,
      latestPlanAt: planStats.latestAt,
      needsAttention:
        !employee.managerId ||
        evalStats.pending > 0 ||
        planStats.overdue > 0 ||
        (evalStats.total > 0 && evalStats.average > 0 && evalStats.average < 3),
    };
  });
}

function buildRecommendedActions({ cycles, employees, evaluations, plans, selectedCycleId }) {
  const now = new Date();
  const actions = [];
  const evaluationPool = selectedCycleId
    ? evaluations.filter((item) => String(item.cycleId) === String(selectedCycleId))
    : evaluations;
  const overdueEvaluations = evaluationPool.filter(
    (item) =>
      ["BORRADOR", "ENVIADA"].includes(item.estado) &&
      item.cycleId &&
      item.cycleId.fechaFin &&
      new Date(item.cycleId.fechaFin) < now
  );
  const cyclesClosing = cycles.filter(
    (cycle) =>
      cycle.estado === "ABIERTO" &&
      cycle.fechaFin &&
      new Date(cycle.fechaFin).getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000
  );
  const employeesWithoutManager = employees.filter((employee) => !employee.hasManager);
  const overduePlans = plans.filter(
    (plan) => plan.estado !== "CERRADO" && plan.fechaSeguimiento && new Date(plan.fechaSeguimiento) < now
  );
  const lowCoverageEmployees = employees.filter((employee) => employee.evaluationCount === 0);

  if (overdueEvaluations.length) {
    actions.push({
      key: "overdue-evaluations",
      severity: "high",
      title: "Evaluaciones vencidas",
      count: overdueEvaluations.length,
      description: "Hay evaluaciones abiertas en ciclos que ya superaron su fecha de cierre.",
    });
  }
  if (cyclesClosing.length) {
    actions.push({
      key: "cycles-closing",
      severity: "medium",
      title: "Ciclos por cerrar",
      count: cyclesClosing.length,
      description: "Conviene revisar los ciclos abiertos que vencen en los proximos siete dias.",
    });
  }
  if (employeesWithoutManager.length) {
    actions.push({
      key: "employees-without-manager",
      severity: "medium",
      title: "Empleados sin manager",
      count: employeesWithoutManager.length,
      description: "Hay personas visibles en este alcance sin responsable asignado.",
    });
  }
  if (overduePlans.length) {
    actions.push({
      key: "overdue-plans",
      severity: "high",
      title: "Planes vencidos",
      count: overduePlans.length,
      description: "Hay planes de desarrollo con seguimiento pendiente y fecha ya vencida.",
    });
  }
  if (lowCoverageEmployees.length) {
    actions.push({
      key: "low-evaluation-coverage",
      severity: "low",
      title: "Baja carga de evaluaciones",
      count: lowCoverageEmployees.length,
      description: "Hay personas sin evaluaciones cargadas en el alcance seleccionado.",
    });
  }

  return actions;
}

async function resolveExecutiveDataset(req, overrides = {}) {
  assertExecutiveReportAccess(req);
  const { company } = await resolveCompanyScope(req);
  const query = {
    ...(req?.query || {}),
    ...(overrides.query || {}),
  };
  const baseFilter = buildExecutiveBaseEmployeeFilter(req.scope, {
    companyId: company._id,
    department: query.department,
  });

  let managerTeamIds = await getAllowedManagerEmployeeIds(req.scope, baseFilter);
  if (Array.isArray(managerTeamIds)) {
    baseFilter._id = { $in: managerTeamIds };
  }

  const [employeesRaw, cycles] = await Promise.all([
    Employee.find(baseFilter)
      .sort({ area: 1, apellido: 1, nombre: 1 })
      .select("nombre apellido email cargo area managerId activo createdAt")
      .lean(),
    EvaluationCycle.find({
      companyId: company._id,
      ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
    })
      .sort({ fechaInicio: -1, createdAt: -1 })
      .lean(),
  ]);

  if (managerTeamIds && managerTeamIds.length === 0) {
    managerTeamIds = [];
  }

  const allowedEmployees = employeesRaw;
  const allowedEmployeeIds = allowedEmployees.map((item) => item._id);

  const requestedEmployeeId = String(query.employeeId || "").trim();
  if (requestedEmployeeId) {
    const allowed = allowedEmployees.some((item) => String(item._id) === requestedEmployeeId);
    if (!allowed) {
      throw createHttpError(403, "No puedes consultar empleados fuera de tu alcance.");
    }
  }

  const requestedCycleId = String(query.cycleId || "").trim();
  const selectedCycle =
    (requestedCycleId && cycles.find((item) => String(item._id) === requestedCycleId)) ||
    cycles.find((item) => item.estado === "ABIERTO") ||
    cycles[0] ||
    null;

  const selectedCycleId = selectedCycle ? selectedCycle._id : null;
  const selectedEmployee =
    (requestedEmployeeId && allowedEmployees.find((item) => String(item._id) === requestedEmployeeId)) ||
    allowedEmployees[0] ||
    null;

  const evaluationFilter = {
    companyId: company._id,
    ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
    employeeId: { $in: allowedEmployeeIds },
    ...(selectedCycleId ? { cycleId: selectedCycleId } : {}),
  };

  const planFilter = {
    companyId: company._id,
    ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
    employeeId: { $in: allowedEmployeeIds },
  };
  const recordFilter = {
    companyId: company._id,
    ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
    employeeId: { $in: allowedEmployeeIds },
  };

  const [evaluations, plans, kpiRecords, okrRecords] = await Promise.all([
    allowedEmployeeIds.length
      ? Evaluation.find(evaluationFilter)
          .sort({ createdAt: -1 })
          .populate("cycleId", "anio periodo etapa estado fechaInicio fechaFin")
          .lean()
      : [],
    allowedEmployeeIds.length
      ? DevelopmentPlan.find(planFilter)
          .sort({ createdAt: -1 })
          .lean()
      : [],
    allowedEmployeeIds.length
      ? KPIRecord.find(recordFilter)
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean()
      : [],
    allowedEmployeeIds.length
      ? OKRRecord.find(recordFilter)
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean()
      : [],
  ]);

  const managerMap = new Map(employeesRaw.map((item) => [String(item._id), formatEmployeeName(item)]));
  const evaluationMap = evaluations.reduce((acc, item) => {
    const key = String(item.employeeId);
    const current = acc.get(key) || { total: 0, pending: 0, totalScore: 0, scoreCount: 0, latestAt: null };
    current.total += 1;
    if (["BORRADOR", "ENVIADA"].includes(item.estado)) {
      current.pending += 1;
    }
    if (Number(item.resultadoFinal || 0) > 0) {
      current.totalScore += Number(item.resultadoFinal);
      current.scoreCount += 1;
    }
    if (!current.latestAt || new Date(item.createdAt) > new Date(current.latestAt)) {
      current.latestAt = item.createdAt;
    }
    acc.set(key, current);
    return acc;
  }, new Map());

  for (const item of evaluationMap.values()) {
    item.average = item.scoreCount ? item.totalScore / item.scoreCount : 0;
  }

  const plansMap = plans.reduce((acc, item) => {
    const key = String(item.employeeId);
    const current = acc.get(key) || { total: 0, open: 0, overdue: 0, latestAt: null };
    current.total += 1;
    if (item.estado !== "CERRADO") current.open += 1;
    if (item.estado !== "CERRADO" && item.fechaSeguimiento && new Date(item.fechaSeguimiento) < new Date()) {
      current.overdue += 1;
    }
    if (!current.latestAt || new Date(item.createdAt) > new Date(current.latestAt)) {
      current.latestAt = item.createdAt;
    }
    acc.set(key, current);
    return acc;
  }, new Map());

  const employees = summarizeEmployees(allowedEmployees, evaluationMap, plansMap, managerMap);
  const departmentMap = new Map();
  employees.forEach((employee) => {
    const label = employee.area || "Sin area";
    departmentMap.set(label, (departmentMap.get(label) || 0) + 1);
  });

  const departments = [...departmentMap.entries()]
    .map(([code, count]) => ({ code, label: code, count }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const actions = buildRecommendedActions({
    cycles,
    employees,
    evaluations,
    plans,
    selectedCycleId,
  });

  return {
    company,
    cycles,
    employees,
    evaluations,
    plans,
    departments,
    selectedCycle,
    selectedEmployee,
    selectedCycleId,
    actions,
    kpiRecords,
    okrRecords,
  };
}

export function invalidateReportCache(companyId) {
  cacheClearByPrefix(`report:${companyId}:`);
}

router.get(
  "/executive/overview",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const companyId = req.user?.companyId || "global";
      const schoolId = req.user?.schoolId || "";
      const roleScope = req.scope?.roleScope || "";
      const departmentCode = req.scope?.departmentCode || "";
      const teamId = req.scope?.teamId || "";
      const cacheKey = `report:${companyId}:${schoolId}:${roleScope}:${departmentCode}:${teamId}:${req.query.cycleId || ""}:${req.query.department || ""}`;
      const dataset = await cacheGetOrFetch(cacheKey, () => resolveExecutiveDataset(req), 90);
      const averageScoreBase = dataset.employees.filter((item) => item.averageScore > 0);
      const averageScore = averageScoreBase.length
        ? averageScoreBase.reduce((sum, item) => sum + item.averageScore, 0) / averageScoreBase.length
        : 0;

      return res.json({
        ok: true,
        filters: {
          selectedCycleId: dataset.selectedCycle ? String(dataset.selectedCycle._id) : "",
          selectedDepartment: String(req.query.department || "").trim(),
          selectedEmployeeId: dataset.selectedEmployee ? String(dataset.selectedEmployee._id) : "",
        },
        summary: {
          employeesTotal: dataset.employees.length,
          departmentsTotal: dataset.departments.length,
          cyclesTotal: dataset.cycles.length,
          cyclesOpen: dataset.cycles.filter((item) => item.estado === "ABIERTO").length,
          evaluationsTotal: dataset.evaluations.length,
          evaluationsPending: dataset.evaluations.filter((item) => ["BORRADOR", "ENVIADA"].includes(item.estado)).length,
          completedEvaluations: dataset.evaluations.filter((item) => ["REVISADA", "CERRADA"].includes(item.estado)).length,
          openPlans: dataset.plans.filter((item) => item.estado !== "CERRADO").length,
          overduePlans: dataset.plans.filter(
            (item) => item.estado !== "CERRADO" && item.fechaSeguimiento && new Date(item.fechaSeguimiento) < new Date()
          ).length,
          employeesWithoutManager: dataset.employees.filter((item) => !item.hasManager).length,
          averageScore: Number(averageScore.toFixed(2)),
        },
        catalogs: {
          cycles: dataset.cycles.map((cycle) => ({
            _id: String(cycle._id),
            label: buildCycleLabel(cycle),
            estado: cycle.estado,
            fechaInicio: cycle.fechaInicio,
            fechaFin: cycle.fechaFin,
          })),
          departments: dataset.departments,
          employees: dataset.employees,
        },
        selectedCycle: dataset.selectedCycle
          ? {
              _id: String(dataset.selectedCycle._id),
              label: buildCycleLabel(dataset.selectedCycle),
              estado: dataset.selectedCycle.estado,
              fechaInicio: dataset.selectedCycle.fechaInicio,
              fechaFin: dataset.selectedCycle.fechaFin,
            }
          : null,
        selectedEmployee: dataset.selectedEmployee
          ? dataset.employees.find((item) => item._id === String(dataset.selectedEmployee._id)) || null
          : null,
        actions: dataset.actions,
        kpis: {
          available: dataset.kpiRecords.length > 0,
          message: dataset.kpiRecords.length > 0 ? "" : KPI_EMPTY_MESSAGE,
          total: dataset.kpiRecords.length,
          summaryByStatus: summarizeOperationalStatus(dataset.kpiRecords),
        },
        okrs: {
          available: dataset.okrRecords.length > 0,
          message: dataset.okrRecords.length > 0 ? "" : OKR_EMPTY_MESSAGE,
          total: dataset.okrRecords.length,
          summaryByStatus: summarizeOperationalStatus(dataset.okrRecords),
        },
        development: {
          total: dataset.plans.length,
          active: dataset.plans.filter((item) => item.estado !== "CERRADO").length,
          overdue: dataset.plans.filter(
            (item) => item.estado !== "CERRADO" && item.fechaSeguimiento && new Date(item.fechaSeguimiento) < new Date()
          ).length,
          completed: dataset.plans.filter((item) => item.estado === "CERRADO").length,
        },
        departments: dataset.departments.map((department) => {
          const departmentEmployees = dataset.employees.filter((item) => (item.area || "Sin area") === department.code);
          const employeeIds = new Set(departmentEmployees.map((item) => String(item._id)));
          const departmentPlans = dataset.plans.filter((item) => employeeIds.has(String(item.employeeId)));
          const departmentKpis = dataset.kpiRecords.filter(
            (item) =>
              String(item.departmentCode || "").trim() === department.code ||
              employeeIds.has(String(item.employeeId || ""))
          );
          const departmentOkrs = dataset.okrRecords.filter(
            (item) =>
              String(item.departmentCode || "").trim() === department.code ||
              employeeIds.has(String(item.employeeId || ""))
          );

          return {
            ...department,
            employees: departmentEmployees.length,
            kpis: departmentKpis.length,
            okrs: departmentOkrs.length,
            pendingPlans: departmentPlans.filter((item) => item.estado !== "CERRADO").length,
          };
        }),
        tabGuidance: {
          resumen: "Vista rapida de estado general.",
          personas: "Seguimiento por empleado o equipo.",
          kpis: "Indicadores medibles y avance contra metas.",
          okrs: "Objetivos y resultados clave.",
          evaluaciones: "Estado del ciclo de evaluacion.",
          desarrollo: "Planes y acciones de mejora.",
          acciones: "Recomendaciones operativas segun los datos disponibles.",
        },
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        ok: false,
        message: error.message || "No pudimos generar el reporte ejecutivo.",
      });
    }
  }
);

router.get(
  "/executive/employees/:employeeId",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const companyId = req.user?.companyId || "global";
      const schoolId = req.user?.schoolId || "";
      const empCacheKey = `report:${companyId}:${schoolId}:emp:${req.params.employeeId}:${req.query.cycleId || ""}`;
      const dataset = await cacheGetOrFetch(
        empCacheKey,
        () => resolveExecutiveDataset(req, { query: { employeeId: req.params.employeeId } }),
        60
      );

      const employee = dataset.selectedEmployee;
      if (!employee) {
        throw createHttpError(404, "Empleado no encontrado en este alcance.");
      }

      const empIdStr = String(employee._id);
      const cycleMap = new Map(dataset.cycles.map((c) => [String(c._id), c]));

      // Reuse already-fetched dataset data — filter in memory instead of re-querying
      const employeePlans = dataset.plans
        .filter((p) => String(p.employeeId) === empIdStr)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const employeeKpis = dataset.kpiRecords
        .filter((k) => String(k.employeeId) === empIdStr)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      const employeeOkrs = dataset.okrRecords
        .filter((o) => String(o.employeeId) === empIdStr)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      // Attach cycle objects from cycle map (avoids extra populate round-trip)
      const rawEvals = dataset.evaluations.filter((ev) => String(ev.employeeId) === empIdStr);
      const employeeEvaluations = rawEvals
        .map((ev) => ({ ...ev, cycleId: cycleMap.get(String(ev.cycleId)) || ev.cycleId }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Still need the full employee document for extra fields not in the summary
      const [employeeDoc] = await Promise.all([Employee.findById(employee._id).lean()]);

      // Single query with nested populate — eliminates 2 sequential round-trips
      const scores = employeeEvaluations.length
        ? await EvaluationScore.find({ evaluationId: { $in: employeeEvaluations.map((item) => item._id) } })
            .populate({
              path: "metricId",
              select: "nombre competencyId",
              populate: { path: "competencyId", select: "nombre" },
            })
            .lean()
        : [];

      const metricMap = new Map();
      const competencyMap = new Map();
      for (const s of scores) {
        const m = s.metricId;
        if (!m) continue;
        metricMap.set(String(m._id), m);
        if (m.competencyId && typeof m.competencyId === "object") {
          competencyMap.set(String(m.competencyId._id), m.competencyId.nombre);
        }
      }
      const metricSignalsMap = new Map();
      scores.forEach((item) => {
        const metric = metricMap.get(String(item.metricId?._id || item.metricId));
        if (!metric) return;
        const key = String(metric._id);
        const current = metricSignalsMap.get(key) || {
          metricId: key,
          metricName: metric.nombre,
          competencyName: competencyMap.get(String(metric.competencyId)) || "Competencia",
          total: 0,
          count: 0,
        };
        current.total += Number(item.nivel || 0);
        current.count += 1;
        metricSignalsMap.set(key, current);
      });

      const metricSignals = [...metricSignalsMap.values()]
        .map((item) => ({
          metricId: item.metricId,
          metricName: item.metricName,
          competencyName: item.competencyName,
          averageScore: item.count ? Number((item.total / item.count).toFixed(2)) : 0,
          scoreCount: item.count,
        }))
        .sort((left, right) => left.averageScore - right.averageScore);

      const averageScore =
        employeeEvaluations.length > 0
          ? Number(
              (
                employeeEvaluations.reduce((sum, item) => sum + Number(item.resultadoFinal || 0), 0) /
                employeeEvaluations.filter((item) => Number(item.resultadoFinal || 0) > 0).length || 0
              ).toFixed(2)
            )
          : 0;

      const employeeActions = [];
      if (!employeeDoc?.managerId) {
        employeeActions.push({
          severity: "medium",
          title: "Asignar manager",
          description: "La persona todavia no tiene manager definido.",
        });
      }
      if (employeePlans.some((item) => item.estado !== "CERRADO" && item.fechaSeguimiento && new Date(item.fechaSeguimiento) < new Date())) {
        employeeActions.push({
          severity: "high",
          title: "Revisar plan vencido",
          description: "Hay al menos un plan de desarrollo con seguimiento vencido.",
        });
      }
      if (employeeEvaluations.some((item) => ["BORRADOR", "ENVIADA"].includes(item.estado))) {
        employeeActions.push({
          severity: "medium",
          title: "Cerrar evaluaciones abiertas",
          description: "Todavia quedan evaluaciones sin cerrar para esta persona.",
        });
      }

      return res.json({
        ok: true,
        employee: {
          _id: String(employee._id),
          fullName: formatEmployeeName(employeeDoc || employee),
          nombre: employeeDoc?.nombre || employee.nombre,
          apellido: employeeDoc?.apellido || employee.apellido,
          email: employeeDoc?.email || employee.email || "",
          cargo: employeeDoc?.cargo || employee.cargo || "",
          area: employeeDoc?.area || employee.area || "",
          hasManager: Boolean(employeeDoc?.managerId),
        },
        summary: {
          evaluationCount: employeeEvaluations.length,
          completedEvaluations: employeeEvaluations.filter((item) => ["REVISADA", "CERRADA"].includes(item.estado)).length,
          pendingEvaluations: employeeEvaluations.filter((item) => ["BORRADOR", "ENVIADA"].includes(item.estado)).length,
          averageScore,
          openPlans: employeePlans.filter((item) => item.estado !== "CERRADO").length,
          overduePlans: employeePlans.filter(
            (item) => item.estado !== "CERRADO" && item.fechaSeguimiento && new Date(item.fechaSeguimiento) < new Date()
          ).length,
        },
        evaluations: employeeEvaluations.map((item) => ({
          _id: String(item._id),
          tipo: item.tipo,
          estado: item.estado,
          resultadoFinal: item.resultadoFinal || 0,
          acuerdoEmpleado: item.acuerdoEmpleado,
          comentariosGenerales: item.comentariosGenerales || "",
          createdAt: item.createdAt,
          cycle: item.cycleId
            ? {
                _id: String(item.cycleId._id),
                label: buildCycleLabel(item.cycleId),
                estado: item.cycleId.estado,
                fechaInicio: item.cycleId.fechaInicio,
                fechaFin: item.cycleId.fechaFin,
              }
            : null,
        })),
        developmentPlans: employeePlans.map((item) => ({
          _id: String(item._id),
          estado: item.estado,
          fortalezas: item.fortalezas || [],
          aspectoDesarrollar: item.aspectoDesarrollar,
          medicion: item.medicion || "",
          fechaSeguimiento: item.fechaSeguimiento,
          createdAt: item.createdAt,
        })),
        metricSignals,
        kpis: {
          available: employeeKpis.length > 0,
          message: employeeKpis.length > 0 ? "" : KPI_EMPTY_MESSAGE,
          items: employeeKpis.map((item) => ({
            _id: String(item._id),
            code: item.kpiCode || "",
            name: item.name,
            targetValue: item.targetValue,
            currentValue: item.currentValue,
            unit: item.unit || "",
            period: item.period || "",
            weight: item.weight,
            status: item.status || "",
            active: item.active !== false,
            departmentCode: item.departmentCode || "",
            updatedAt: item.updatedAt,
          })),
        },
        okrs: {
          available: employeeOkrs.length > 0,
          message: employeeOkrs.length > 0 ? "" : OKR_EMPTY_MESSAGE,
          items: employeeOkrs.map((item) => ({
            _id: String(item._id),
            code: item.okrCode || "",
            objectiveTitle: item.objectiveTitle || item.objective || "",
            keyResultTitle: item.keyResultTitle || item.keyResult || "",
            quarter: item.quarter || item.period || "",
            targetValue: item.targetValue,
            currentValue: item.currentValue,
            weight: item.weight,
            status: item.status || "",
            departmentCode: item.departmentCode || "",
            updatedAt: item.updatedAt,
          })),
        },
        actions: employeeActions,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        ok: false,
        message: error.message || "No pudimos cargar el detalle del empleado.",
      });
    }
  }
);

router.get(
  "/export-excel",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const dataset = await resolveExecutiveDataset(req);
      const { company, employees, evaluations, selectedCycle } = dataset;

      // Gather evaluation scores for the detail sheet
      const evaluationIds = evaluations.map((item) => item._id);
      const [scores, metrics, competencies] = await (async () => {
        if (!evaluationIds.length) return [[], [], []];
        const rawScores = await EvaluationScore.find({ evaluationId: { $in: evaluationIds } })
          .populate("metricId", "nombre competencyId")
          .lean();
        const metricIds = rawScores.map((s) => s.metricId?._id || s.metricId).filter(Boolean);
        const rawMetrics = metricIds.length
          ? await Metric.find({ _id: { $in: metricIds } }).select("_id nombre competencyId").lean()
          : [];
        const competencyIds = rawMetrics.map((m) => m.competencyId).filter(Boolean);
        const rawCompetencies = competencyIds.length
          ? await Competency.find({ _id: { $in: competencyIds } }).select("_id nombre").lean()
          : [];
        return [rawScores, rawMetrics, rawCompetencies];
      })();

      const metricMap = new Map(metrics.map((m) => [String(m._id), m]));
      const competencyMap = new Map(competencies.map((c) => [String(c._id), c.nombre]));
      const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

      // Build evaluation map keyed by employeeId
      const evalByEmployee = new Map();
      for (const ev of evaluations) {
        const key = String(ev.employeeId);
        if (!evalByEmployee.has(key)) evalByEmployee.set(key, []);
        evalByEmployee.get(key).push(ev);
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Zentor";
      workbook.created = new Date();

      // ─── Sheet 1: Resumen ─────────────────────────────────────────────────
      const summarySheet = workbook.addWorksheet("Resumen");
      summarySheet.columns = [
        { header: "Empleado", key: "empleado", width: 30 },
        { header: "Área", key: "area", width: 20 },
        { header: "Tipo eval.", key: "tipo", width: 16 },
        { header: "Estado", key: "estado", width: 16 },
        { header: "Resultado final", key: "resultadoFinal", width: 18 },
        { header: "# Competencias evaluadas", key: "competencias", width: 26 },
      ];

      // Style header row
      const summaryHeaderRow = summarySheet.getRow(1);
      summaryHeaderRow.font = { bold: true, color: { argb: "FF0F172A" } };
      summaryHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14B8A6" } };
      summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
      summaryHeaderRow.height = 20;

      for (const employee of employees) {
        const evs = evalByEmployee.get(String(employee._id)) || [];
        if (evs.length === 0) {
          summarySheet.addRow({
            empleado: employee.fullName,
            area: employee.area || "",
            tipo: "",
            estado: "Sin evaluaciones",
            resultadoFinal: "",
            competencias: 0,
          });
        } else {
          for (const ev of evs) {
            const evScores = scores.filter((s) => String(s.evaluationId) === String(ev._id));
            const uniqueCompetencies = new Set(
              evScores.map((s) => {
                const metric = metricMap.get(String(s.metricId?._id || s.metricId));
                return metric?.competencyId ? String(metric.competencyId) : null;
              }).filter(Boolean)
            );
            summarySheet.addRow({
              empleado: employee.fullName,
              area: employee.area || "",
              tipo: ev.tipo || "",
              estado: ev.estado || "",
              resultadoFinal: Number(ev.resultadoFinal || 0) > 0 ? Number(ev.resultadoFinal) : "",
              competencias: uniqueCompetencies.size,
            });
          }
        }
      }

      summarySheet.autoFilter = { from: "A1", to: "F1" };

      // ─── Sheet 2: Scores detalle ──────────────────────────────────────────
      const detailSheet = workbook.addWorksheet("Scores detalle");
      detailSheet.columns = [
        { header: "Empleado", key: "empleado", width: 30 },
        { header: "Competencia", key: "competencia", width: 28 },
        { header: "Nivel (1-5)", key: "nivel", width: 14 },
        { header: "Comentario", key: "comentario", width: 50 },
      ];

      const detailHeaderRow = detailSheet.getRow(1);
      detailHeaderRow.font = { bold: true, color: { argb: "FF0F172A" } };
      detailHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14B8A6" } };
      detailHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
      detailHeaderRow.height = 20;

      for (const score of scores) {
        const ev = evaluations.find((e) => String(e._id) === String(score.evaluationId));
        const employeeEntry = ev ? employeeMap.get(String(ev.employeeId)) : null;
        const metric = metricMap.get(String(score.metricId?._id || score.metricId));
        const competencyName = metric?.competencyId
          ? competencyMap.get(String(metric.competencyId)) || metric.nombre || ""
          : metric?.nombre || "";

        detailSheet.addRow({
          empleado: employeeEntry?.fullName || "",
          competencia: competencyName,
          nivel: Number(score.nivel || 0),
          comentario: score.comentario || "",
        });
      }

      detailSheet.autoFilter = { from: "A1", to: "D1" };

      // ─── Send response ────────────────────────────────────────────────────
      const cyclePart = selectedCycle
        ? `${selectedCycle.anio || ""}${selectedCycle.periodo ? `-${selectedCycle.periodo}` : ""}`
        : new Date().toISOString().slice(0, 10);
      const filename = `zentor-reporte-${cyclePart}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error) {
      return res.status(error.status || 500).json({
        ok: false,
        message: error.message || "No pudimos generar el archivo Excel.",
      });
    }
  }
);

// ── GET /reports/participation — Participation report by cycle ────────────────
router.get(
  "/participation",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const cycleId = req.query.cycleId || null;

      const cycleFilter = cycleId ? { _id: cycleId, companyId } : { companyId };
      const cycles = await EvaluationCycle.find(cycleFilter).sort({ createdAt: -1 }).limit(5).lean();
      if (!cycles.length) return res.json({ ok: true, rows: [], total: 0 });

      const targetCycleIds = cycles.map((c) => c._id);
      const [totalEmployees, evaluations] = await Promise.all([
        Employee.countDocuments({ companyId }),
        Evaluation.find({ companyId, cycleId: { $in: targetCycleIds } })
          .select("cycleId estado employeeId")
          .lean(),
      ]);

      const rows = cycles.map((cycle) => {
        const cycleEvals = evaluations.filter((e) => String(e.cycleId) === String(cycle._id));
        const completed = cycleEvals.filter((e) => ["REVISADA", "CERRADA"].includes(e.estado)).length;
        const pending = cycleEvals.filter((e) => ["BORRADOR", "ENVIADA"].includes(e.estado)).length;
        const rate = totalEmployees > 0 ? Math.round((completed / totalEmployees) * 100) : 0;
        return {
          cycleId: String(cycle._id),
          cycleLabel: buildCycleLabel(cycle),
          estado: cycle.estado,
          totalEmployees,
          totalEvaluations: cycleEvals.length,
          completed,
          pending,
          participationRate: rate,
        };
      });

      res.json({ ok: true, rows, total: rows.length });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    }
  }
);

// ── GET /reports/plans-summary — Development plans summary ───────────────────
router.get(
  "/plans-summary",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);

      const plans = await DevelopmentPlan.find({ companyId })
        .select("estado fechaSeguimiento prioridad employeeId createdAt")
        .lean();

      const now = new Date();
      const total = plans.length;
      const open = plans.filter((p) => p.estado !== "CERRADO").length;
      const completed = plans.filter((p) => p.estado === "CERRADO").length;
      const overdue = plans.filter(
        (p) => p.estado !== "CERRADO" && p.fechaSeguimiento && new Date(p.fechaSeguimiento) < now
      ).length;
      const highPriority = plans.filter((p) => p.prioridad === "ALTA" && p.estado !== "CERRADO").length;

      const byStatus = plans.reduce((acc, p) => {
        const key = p.estado || "SIN_ESTADO";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      res.json({ ok: true, summary: { total, open, completed, overdue, highPriority, byStatus } });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    }
  }
);

// ─── Analytics summary for dashboard ─────────────────────────────────────────
router.get(
  "/summary",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const cycleId = req.query.cycleId || null;
      const schoolId = req.scope?.schoolId ? String(req.scope.schoolId) : null;
      const department = req.query.department || null;
      const cacheKey = `reports-summary:${String(companyId)}:${schoolId || "all"}:${cycleId || "all"}:${department || "all"}`;

      const result = await cacheGetOrFetch(cacheKey, async () => {
        const empFilter = { companyId };
        if (schoolId) empFilter.schoolId = schoolId;
        if (department) empFilter.area = department;

        const evalMatch = { companyId, estado: { $in: ["REVISADA", "CERRADA"] } };
        if (cycleId) evalMatch.cycleId = cycleId;
        if (schoolId) evalMatch.schoolId = schoolId;

        // Restrict evaluations to employees in scope
        const scopedEmpIds = schoolId || department
          ? (await Employee.find(empFilter, "_id").lean()).map(e => e._id)
          : null;
        if (scopedEmpIds) evalMatch.employeeId = { $in: scopedEmpIds };

        const [employeesTotal, evaluations, competencyAvgs, recentEvals, competencyByAreaRaw] = await Promise.all([
          Employee.countDocuments(empFilter),
          Evaluation.find(evalMatch, "employeeId resultadoFinal tipo").lean(),
          EvaluationScore.aggregate([
            { $lookup: { from: "evaluations", localField: "evaluationId", foreignField: "_id", as: "ev" } },
            { $unwind: "$ev" },
            { $match: { "ev.companyId": companyId, "ev.estado": { $in: ["REVISADA", "CERRADA"] }, ...(scopedEmpIds ? { "ev.employeeId": { $in: scopedEmpIds } } : {}) } },
            { $lookup: { from: "metrics", localField: "metricId", foreignField: "_id", as: "metric" } },
            { $unwind: "$metric" },
            { $lookup: { from: "competencies", localField: "metric.competencyId", foreignField: "_id", as: "comp" } },
            { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$comp._id", nombre: { $first: { $ifNull: ["$comp.nombre", "Sin competencia"] } }, total: { $sum: "$nivel" }, count: { $sum: 1 } } },
            { $project: { nombre: 1, avg: { $divide: ["$total", "$count"] }, count: 1 } },
            { $sort: { avg: -1 } },
          ]),
          Evaluation.find({ ...evalMatch, tipo: "FINAL" })
            .sort({ updatedAt: -1 })
            .limit(12)
            .populate("employeeId", "nombre apellido cargo area")
            .lean(),
          // competency averages broken down by area
          EvaluationScore.aggregate([
            { $lookup: { from: "evaluations", localField: "evaluationId", foreignField: "_id", as: "ev" } },
            { $unwind: "$ev" },
            { $match: { "ev.companyId": companyId, "ev.estado": { $in: ["REVISADA", "CERRADA"] }, "ev.tipo": "FINAL", ...(scopedEmpIds ? { "ev.employeeId": { $in: scopedEmpIds } } : {}) } },
            { $lookup: { from: "employees", localField: "ev.employeeId", foreignField: "_id", as: "emp" } },
            { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "metrics", localField: "metricId", foreignField: "_id", as: "metric" } },
            { $unwind: "$metric" },
            { $lookup: { from: "competencies", localField: "metric.competencyId", foreignField: "_id", as: "comp" } },
            { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },
            { $group: {
              _id: { area: { $ifNull: ["$emp.area", "Sin área"] }, compId: "$comp._id" },
              nombre: { $first: { $ifNull: ["$comp.nombre", "Sin competencia"] } },
              total: { $sum: "$nivel" },
              count: { $sum: 1 },
            }},
            { $project: { area: "$_id.area", nombre: 1, avg: { $divide: ["$total", "$count"] }, count: 1 } },
            { $sort: { area: 1, nombre: 1 } },
          ]),
        ]);

        const finalEvals = evaluations.filter((e) => e.tipo === "FINAL" && e.resultadoFinal > 0);
        const evaluatedCount = new Set(finalEvals.map((e) => String(e.employeeId))).size;
        const scores = finalEvals.map((e) => e.resultadoFinal);
        const averageScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const scoreExcepcional = scores.filter((s) => s >= 4.5).length;
        const scoreNeedsAttention = scores.filter((s) => s > 0 && s < 2.5).length;

        const distMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        scores.forEach((s) => { const b = Math.max(1, Math.min(5, Math.round(s))); distMap[b] = (distMap[b] || 0) + 1; });
        const DIST_LABELS = { 1: "Insatisfactorio", 2: "Mínimo", 3: "En Desarrollo", 4: "Competente", 5: "Excepcional" };
        const scoreDistribution = [1, 2, 3, 4, 5].map((b) => ({ bucket: b, label: DIST_LABELS[b], count: distMap[b] }));

        const recentEvaluations = recentEvals.map((e) => ({
          employeeName: e.employeeId ? [e.employeeId.apellido, e.employeeId.nombre].filter(Boolean).join(", ") : "—",
          cargo: e.employeeId?.cargo || "—",
          area: e.employeeId?.area || "—",
          finalScore: e.resultadoFinal || 0,
        }));

        // Build area → { compName → avg } map
        const areaCompMap = {};
        for (const row of competencyByAreaRaw) {
          const area = row.area;
          if (!areaCompMap[area]) areaCompMap[area] = {};
          areaCompMap[area][row.nombre] = Math.round(row.avg * 100) / 100;
        }

        return {
          stats: { employeesTotal, evaluatedCount, averageScore: Math.round(averageScore * 100) / 100, scoreExcepcional, scoreNeedsAttention },
          competencyAverages: competencyAvgs.map((c) => ({ nombre: c.nombre, avg: Math.round(c.avg * 100) / 100, count: c.count })),
          scoreDistribution,
          recentEvaluations,
          competencyByArea: areaCompMap,
        };
      }, 300);

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    }
  }
);

// ─── Reports grouped by area ───────────────────────────────────────────────────
router.get(
  "/by-level",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const cycleId = req.query.cycleId || null;
      const schoolId = req.scope?.schoolId ? String(req.scope.schoolId) : null;
      const department = req.query.department || null;
      const cacheKey = `reports-by-level:${String(companyId)}:${schoolId || "all"}:${cycleId || "all"}:${department || "all"}`;

      const result = await cacheGetOrFetch(cacheKey, async () => {
        const empMatch = { companyId };
        if (schoolId) empMatch.schoolId = schoolId;
        if (department) empMatch.area = department;
        const data = await Employee.aggregate([
          { $match: empMatch },
          {
            $lookup: {
              from: "evaluations",
              let: { empId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$employeeId", "$$empId"] },
                        { $in: ["$estado", ["REVISADA", "CERRADA"]] },
                        { $eq: ["$tipo", "FINAL"] },
                      ],
                    },
                  },
                },
                { $project: { resultadoFinal: 1 } },
              ],
              as: "evals",
            },
          },
          {
            $group: {
              _id: { $ifNull: ["$area", "Sin área"] },
              employeeCount: { $sum: 1 },
              avgScore: { $avg: { $arrayElemAt: ["$evals.resultadoFinal", 0] } },
              evaluatedCount: { $sum: { $cond: [{ $gt: [{ $size: "$evals" }, 0] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        return {
          areas: data.map((d) => ({
            area: d._id,
            employeeCount: d.employeeCount,
            evaluatedCount: d.evaluatedCount,
            avgScore: d.avgScore ? Math.round(d.avgScore * 100) / 100 : null,
          })),
        };
      }, 300);

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    }
  }
);

// ─── Full analytics dataset for demo-style reports ───────────────────────────
router.get(
  "/analytics",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const { companyId } = await resolveCompanyScope(req);
      const cycleId = req.query.cycleId || null;
      const schoolId = req.scope?.schoolId ? String(req.scope.schoolId) : null;
      const department = req.query.department || null;
      const cacheKey = `reports-analytics:${String(companyId)}:${schoolId || "all"}:${cycleId || "all"}:${department || "all"}`;

      const result = await cacheGetOrFetch(cacheKey, async () => {
        const empFilter = { companyId, activo: true };
        if (schoolId) empFilter.schoolId = schoolId;
        if (department) empFilter.area = department;
        const employees = await Employee.find(empFilter)
          .select("nombre apellido cargo area managerId")
          .lean();

        const empMap = new Map(employees.map((e) => [String(e._id), e]));
        const managerIdSet = new Set(
          employees.map((e) => (e.managerId ? String(e.managerId) : null)).filter(Boolean)
        );

        const evalMatch = { companyId, estado: { $in: ["REVISADA", "CERRADA"] } };
        if (cycleId) evalMatch.cycleId = cycleId;
        if (schoolId) evalMatch.schoolId = schoolId;
        if (schoolId || department) evalMatch.employeeId = { $in: employees.map(e => e._id) };

        const [evaluations, scores] = await (async () => {
          const evs = await Evaluation.find(evalMatch).select("employeeId tipo resultadoFinal").lean();
          if (!evs.length) return [evs, []];
          const evalIds = evs.map((e) => e._id);
          const sc = await EvaluationScore.find({ evaluationId: { $in: evalIds } })
            .populate({
              path: "metricId",
              select: "nombre competencyId",
              populate: { path: "competencyId", select: "nombre" },
            })
            .lean();
          return [evs, sc];
        })();

        const compMap = new Map();
        scores.forEach((s) => {
          const comp = s.metricId?.competencyId;
          if (comp?._id) compMap.set(String(comp._id), comp.nombre);
        });
        const competencias = [...compMap.entries()].map(([id, nombre]) => ({ id, nombre }));

        const evalById = new Map(evaluations.map((e) => [String(e._id), e]));

        const scoreMatrix = {};
        scores.forEach((s) => {
          const ev = evalById.get(String(s.evaluationId));
          if (!ev) return;
          const empId = String(ev.employeeId);
          const tipo = ev.tipo;
          const comp = s.metricId?.competencyId;
          if (!comp) return;
          const compId = String(comp._id);
          if (!scoreMatrix[empId]) scoreMatrix[empId] = {};
          if (!scoreMatrix[empId][tipo]) scoreMatrix[empId][tipo] = {};
          if (!scoreMatrix[empId][tipo][compId]) scoreMatrix[empId][tipo][compId] = { total: 0, count: 0 };
          scoreMatrix[empId][tipo][compId].total += Number(s.nivel || 0);
          scoreMatrix[empId][tipo][compId].count += 1;
        });

        const finalEvalByEmp = {};
        evaluations.filter((e) => e.tipo === "FINAL").forEach((e) => {
          const empId = String(e.employeeId);
          if (!finalEvalByEmp[empId]) finalEvalByEmp[empId] = [];
          finalEvalByEmp[empId].push(Number(e.resultadoFinal || 0));
        });

        const personas = employees.map((emp) => {
          const empId = String(emp._id);
          const matrix = scoreMatrix[empId] || {};
          const compScores = {};
          competencias.forEach(({ id, nombre }) => {
            const autoE = matrix["AUTOEVALUACION"]?.[id];
            const jefeE = matrix["JEFATURA"]?.[id];
            const autoAvg = autoE?.count ? autoE.total / autoE.count : null;
            const jefeAvg = jefeE?.count ? jefeE.total / jefeE.count : null;
            if (autoAvg !== null || jefeAvg !== null) {
              compScores[id] = {
                nombre,
                auto: autoAvg !== null ? Math.round(autoAvg * 100) / 100 : null,
                jefe: jefeAvg !== null ? Math.round(jefeAvg * 100) / 100 : null,
              };
            }
          });

          const autoVals = Object.values(compScores).map((c) => c.auto).filter((v) => v !== null);
          const jefeVals = Object.values(compScores).map((c) => c.jefe).filter((v) => v !== null);
          const autoGeneral = autoVals.length ? autoVals.reduce((a, b) => a + b, 0) / autoVals.length : null;
          const jefeGeneral = jefeVals.length ? jefeVals.reduce((a, b) => a + b, 0) / jefeVals.length : null;
          const finalScores = (finalEvalByEmp[empId] || []).filter((v) => v > 0);
          const general =
            finalScores.length
              ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length
              : autoGeneral !== null && jefeGeneral !== null
              ? (autoGeneral + jefeGeneral) / 2
              : autoGeneral ?? jefeGeneral ?? null;

          const mgr = emp.managerId ? empMap.get(String(emp.managerId)) : null;
          const managerName = mgr
            ? [mgr.apellido, mgr.nombre].filter(Boolean).join(", ")
            : null;

          return {
            _id: empId,
            nombre: [emp.apellido, emp.nombre].filter(Boolean).join(", "),
            cargo: emp.cargo || "",
            area: emp.area || "Sin área",
            esJefatura: managerIdSet.has(empId),
            managerName: managerName || "—",
            managerId: emp.managerId ? String(emp.managerId) : null,
            compScores,
            autoGeneral: autoGeneral !== null ? Math.round(autoGeneral * 100) / 100 : null,
            jefeGeneral: jefeGeneral !== null ? Math.round(jefeGeneral * 100) / 100 : null,
            general: general !== null ? Math.round(general * 100) / 100 : null,
          };
        });

        const areaMap = {};
        personas.forEach((p) => {
          if (!areaMap[p.area]) areaMap[p.area] = [];
          areaMap[p.area].push(p);
        });

        const grupos = Object.entries(areaMap)
          .map(([area, people]) => {
            const compStats = {};
            competencias.forEach(({ id, nombre }) => {
              const vals = people.map((p) => p.compScores[id]?.auto).filter((v) => v != null);
              if (!vals.length) return;
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              const dist = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => Math.round(v) === n).length);
              compStats[id] = {
                nombre,
                avg: Math.round(avg * 100) / 100,
                dist,
                pctLow: Math.round((vals.filter((v) => v < 2.5).length / vals.length) * 100),
                pctHigh: Math.round((vals.filter((v) => v >= 4).length / vals.length) * 100),
                count: vals.length,
              };
            });
            const genVals = people.map((p) => p.general).filter((v) => v != null);
            const genAvg = genVals.length ? genVals.reduce((a, b) => a + b, 0) / genVals.length : null;
            const genDist = [1, 2, 3, 4, 5].map((n) =>
              genVals.filter((v) => Math.round(v) === n).length
            );
            return {
              area,
              count: people.length,
              avgScore: genAvg !== null ? Math.round(genAvg * 100) / 100 : null,
              genDist,
              compStats,
            };
          })
          .sort((a, b) => a.area.localeCompare(b.area));

        return { personas, competencias, grupos };
      }, 300);

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, message: err.message });
    }
  }
);

export default router;
