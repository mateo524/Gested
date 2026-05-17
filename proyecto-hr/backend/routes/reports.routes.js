import express from "express";
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

async function resolveExecutiveDataset(req) {
  assertExecutiveReportAccess(req);
  const { company } = await resolveCompanyScope(req);
  const baseFilter = buildExecutiveBaseEmployeeFilter(req.scope, {
    companyId: company._id,
    department: req.query.department,
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

  const requestedEmployeeId = String(req.query.employeeId || "").trim();
  if (requestedEmployeeId) {
    const allowed = allowedEmployees.some((item) => String(item._id) === requestedEmployeeId);
    if (!allowed) {
      throw createHttpError(403, "No puedes consultar empleados fuera de tu alcance.");
    }
  }

  const requestedCycleId = String(req.query.cycleId || "").trim();
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

  const [evaluations, plans, managerRefs, kpiRecords, okrRecords] = await Promise.all([
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
    Employee.find({
      companyId: company._id,
      ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
    })
      .select("_id nombre apellido")
      .lean(),
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

  const managerMap = new Map(managerRefs.map((item) => [String(item._id), formatEmployeeName(item)]));
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

router.get(
  "/executive/overview",
  auth,
  attachTenantScope,
  requireAnyPermission(...EXECUTIVE_PERMISSION_SET),
  async (req, res) => {
    try {
      const dataset = await resolveExecutiveDataset(req);
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
        },
        okrs: {
          available: dataset.okrRecords.length > 0,
          message: dataset.okrRecords.length > 0 ? "" : OKR_EMPTY_MESSAGE,
          total: dataset.okrRecords.length,
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
      const dataset = await resolveExecutiveDataset({
        ...req,
        query: {
          ...req.query,
          employeeId: req.params.employeeId,
        },
      });

      const employee = dataset.selectedEmployee;
      if (!employee) {
        throw createHttpError(404, "Empleado no encontrado en este alcance.");
      }

      const [employeeDoc, employeeEvaluations, employeePlans, employeeKpis, employeeOkrs] = await Promise.all([
        Employee.findById(employee._id).lean(),
        Evaluation.find({
          companyId: dataset.company._id,
          ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
          employeeId: employee._id,
          ...(dataset.selectedCycleId ? { cycleId: dataset.selectedCycleId } : {}),
        })
          .sort({ createdAt: -1 })
          .populate("cycleId", "anio periodo etapa estado fechaInicio fechaFin")
          .lean(),
        DevelopmentPlan.find({
          companyId: dataset.company._id,
          ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
          employeeId: employee._id,
        })
          .sort({ createdAt: -1 })
          .lean(),
        KPIRecord.find({
          companyId: dataset.company._id,
          ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
          employeeId: employee._id,
        })
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean(),
        OKRRecord.find({
          companyId: dataset.company._id,
          ...(req.scope.schoolId ? { schoolId: req.scope.schoolId } : {}),
          employeeId: employee._id,
        })
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean(),
      ]);

      const scores = employeeEvaluations.length
        ? await EvaluationScore.find({ evaluationId: { $in: employeeEvaluations.map((item) => item._id) } })
            .populate("metricId", "nombre competencyId")
            .lean()
        : [];
      const metricIds = scores
        .map((item) => item.metricId?._id || item.metricId)
        .filter(Boolean);
      const metrics = metricIds.length
        ? await Metric.find({ _id: { $in: metricIds } }).select("_id nombre competencyId").lean()
        : [];
      const competencyIds = metrics.map((item) => item.competencyId).filter(Boolean);
      const competencies = competencyIds.length
        ? await Competency.find({ _id: { $in: competencyIds } }).select("_id nombre").lean()
        : [];

      const metricMap = new Map(metrics.map((item) => [String(item._id), item]));
      const competencyMap = new Map(competencies.map((item) => [String(item._id), item.nombre]));
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
            unit: item.unit || "",
            frequency: item.frequency || "",
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
            objectiveTitle: item.objectiveTitle,
            keyResultTitle: item.keyResultTitle,
            quarter: item.quarter || "",
            targetValue: item.targetValue,
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

export default router;
