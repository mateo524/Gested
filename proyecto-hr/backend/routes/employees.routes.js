import express from "express";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationScore from "../models/EvaluationScore.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import School from "../models/School.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { isEmployeeScope, isManagerScope, getScopedEmployeeIds } from "../utils/employeeScope.js";
import {
  normalizeEmail,
  resolveDefaultEmployeeRole,
  syncUserForEmployeeCreation,
} from "../utils/userEmployeeSync.js";
import { triggerSheetSync } from "../utils/sheetSync.js";
import { runInBackground } from "../utils/background.js";

const router = express.Router();

function resolveTenantIds(req) {
  const companyFromHeader = req.get("X-Company-Id");
  return {
    companyId: req.scope.isSuperAdmin
      ? req.body.companyId || req.query.companyId || companyFromHeader
      : req.scope.companyId,
    schoolId: req.scope.isSuperAdmin
      ? req.body.schoolId || req.query.schoolId
      : req.scope.schoolId,
  };
}

async function findActiveSchool(companyId, schoolId) {
  if (!companyId || !schoolId) return null;
  return School.findOne({ _id: schoolId, companyId, activa: true }).select("_id").lean();
}

async function validateManager({ managerId, companyId, schoolId, employeeId = null }) {
  if (!managerId) return { ok: true, value: null };
  if (employeeId && String(managerId) === String(employeeId)) {
    return { ok: false, mensaje: "Un empleado no puede ser su propio jefe" };
  }

  const manager = await Employee.findOne({
    _id: managerId,
    companyId,
    schoolId,
    activo: true,
  })
    .select("_id")
    .lean();

  if (!manager) {
    return { ok: false, mensaje: "El jefe seleccionado no pertenece al mismo colegio/organizacion" };
  }

  return { ok: true, value: manager._id };
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_SELF_PROFILE,
    PERMISSIONS.VIEW_REPORTS,
  ),
  async (req, res) => {
    const filter = buildScopedFilter(req, {});

    if (isManagerScope(req.scope)) {
      const teamIds = await getScopedEmployeeIds(req.scope);
      const ids = teamIds || [];
      // ?includeSelf=true → include the manager's own employee record
      if (req.query.includeSelf === "true" && req.scope.employeeId) {
        const selfId = req.scope.employeeId;
        const alreadyIncluded = ids.some((id) => String(id) === String(selfId));
        if (!alreadyIncluded) ids.push(selfId);
      }
      if (ids.length) filter._id = { $in: ids };
    }

    if (isEmployeeScope(req.scope)) {
      filter._id = req.scope.employeeId;
    }

  if (req.query.schoolId && req.scope.isSuperAdmin) {
    filter.schoolId = req.query.schoolId;
  }

  if (req.query.area) {
    filter.area = req.query.area;
  }

  if (req.query.cargo) {
    filter.cargo = req.query.cargo;
  }

  if (req.query.managerId) {
    filter.managerId = req.query.managerId;
  }

  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [{ nombre: regex }, { apellido: regex }, { email: regex }, { cargo: regex }];
  }

  const employees = await Employee.find(filter)
    .select("-__v")
    .sort({ apellido: 1, nombre: 1 })
    .lean();
  res.json(employees);
});

router.get(
  "/org-chart",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EMPLOYEES),
  async (req, res) => {
    const filter = buildScopedFilter(req, { activo: true });
    const employees = await Employee.find(filter)
      .select("_id nombre apellido cargo area managerId tipoEmpleado")
      .sort({ apellido: 1, nombre: 1 })
      .lean();

    const nodes = employees.map((emp) => ({
      _id: String(emp._id),
      nombre: emp.nombre,
      apellido: emp.apellido,
      cargo: emp.cargo,
      area: emp.area || "",
      tipoEmpleado: emp.tipoEmpleado || "",
      managerId: emp.managerId ? String(emp.managerId) : null,
      avatarUrl: null,
    }));

    res.json({ nodes });
  }
);

router.get(
  "/:id/profile",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_SELF_PROFILE,
    PERMISSIONS.VIEW_REPORTS
  ),
  async (req, res) => {
    const employee = await Employee.findOne(buildScopedFilter(req, { _id: req.params.id }))
      .select("-__v")
      .lean();
    if (!employee) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    if (isManagerScope(req.scope) && req.scope.employeeId) {
      const isSelf = String(employee._id) === String(req.scope.employeeId);
      const isTeam =
        req.scope.roleScope === "DEPARTMENT" && req.scope.departmentCode
          ? String(employee.area || "") === String(req.scope.departmentCode)
          : String(employee.managerId || "") === String(req.scope.employeeId);
      if (!isSelf && !isTeam) {
        return res.status(403).json({ mensaje: "No tienes acceso a esta ficha" });
      }
    }

    if (isEmployeeScope(req.scope) && req.scope.employeeId) {
      const isSelf = String(employee._id) === String(req.scope.employeeId);
      if (!isSelf) {
        return res.status(403).json({ mensaje: "Solo puedes ver tu propia ficha" });
      }
    }

    const [manager, evaluations, plans] = await Promise.all([
      employee.managerId
        ? Employee.findById(employee.managerId).select("nombre apellido cargo").lean()
        : null,
      Evaluation.find({
        companyId: employee.companyId,
        schoolId: employee.schoolId,
        employeeId: employee._id,
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("tipo estado resultadoFinal acuerdoEmpleado createdAt")
        .lean(),
      DevelopmentPlan.find({
        companyId: employee.companyId,
        schoolId: employee.schoolId,
        employeeId: employee._id,
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .select("fortalezas aspectoDesarrollar medicion fechaSeguimiento estado createdAt")
        .lean(),
    ]);

    const evaluationCount = evaluations.length;
    const averageScore = evaluationCount
      ? Number(
          (
            evaluations.reduce((sum, item) => sum + Number(item.resultadoFinal || 0), 0) /
            evaluationCount
          ).toFixed(2)
        )
      : 0;
    const openPlans = plans.filter((plan) => plan.estado !== "CERRADO").length;

    res.json({
      employee,
      manager,
      stats: {
        evaluationCount,
        averageScore,
        planCount: plans.length,
        openPlans,
      },
      evaluations,
      plans,
    });
  }
);

router.get(
  "/:id/evolution",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_SELF_PROFILE,
    PERMISSIONS.VIEW_REPORTS
  ),
  async (req, res) => {
    const employee = await Employee.findOne(buildScopedFilter(req, { _id: req.params.id }))
      .select("nombre apellido cargo companyId schoolId")
      .lean();

    if (!employee) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    // scope checks matching profile endpoint
    if (isManagerScope(req.scope) && req.scope.employeeId) {
      const isSelf = String(employee._id) === String(req.scope.employeeId);
      const isTeam =
        req.scope.roleScope === "DEPARTMENT" && req.scope.departmentCode
          ? String(employee.area || "") === String(req.scope.departmentCode)
          : String(employee.managerId || "") === String(req.scope.employeeId);
      if (!isSelf && !isTeam) {
        return res.status(403).json({ mensaje: "No tienes acceso a esta ficha" });
      }
    }

    if (isEmployeeScope(req.scope) && req.scope.employeeId) {
      if (String(employee._id) !== String(req.scope.employeeId)) {
        return res.status(403).json({ mensaje: "Solo puedes ver tu propia ficha" });
      }
    }

    // Fetch all closed/reviewed evaluations with their cycle populated
    const evaluations = await Evaluation.find({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      employeeId: employee._id,
      estado: { $in: ["CERRADA", "REVISADA"] },
    })
      .populate({ path: "cycleId", select: "periodo fechaInicio fechaFin anio" })
      .sort({ createdAt: 1 })
      .lean();

    if (!evaluations.length) {
      return res.json({
        employee: { nombre: employee.nombre, apellido: employee.apellido, cargo: employee.cargo },
        cycles: [],
      });
    }

    // Fetch all scores for these evaluations in one query
    const evaluationIds = evaluations.map((e) => e._id);
    const allScores = await EvaluationScore.find({ evaluationId: { $in: evaluationIds } })
      .populate({ path: "metricId", select: "nombre competencyId" })
      .lean();

    // Group scores by evaluationId
    const scoresByEvalId = new Map();
    for (const score of allScores) {
      const key = String(score.evaluationId);
      if (!scoresByEvalId.has(key)) scoresByEvalId.set(key, []);
      scoresByEvalId.get(key).push(score);
    }

    // Build cycles array, one entry per evaluation (sorted by cycle fechaInicio ascending)
    const cycles = evaluations
      .slice()
      .sort((a, b) => {
        const aDate = a.cycleId?.fechaInicio ? new Date(a.cycleId.fechaInicio) : new Date(0);
        const bDate = b.cycleId?.fechaInicio ? new Date(b.cycleId.fechaInicio) : new Date(0);
        return aDate - bDate;
      })
      .map((ev) => {
        const scores = (scoresByEvalId.get(String(ev._id)) || []).map((s) => ({
          competencia: s.metricId?.nombre || "Sin nombre",
          nivel: s.nivel,
          ...(s.comentario ? { comentario: s.comentario } : {}),
        }));

        return {
          cycleId: ev.cycleId?._id || ev.cycleId,
          periodo: ev.cycleId?.periodo || "",
          fecha: ev.cycleId?.fechaFin || ev.cycleId?.fechaInicio || null,
          scores,
          resultadoFinal: ev.resultadoFinal ?? 0,
          tipo: ev.tipo,
        };
      });

    res.json({
      employee: { nombre: employee.nombre, apellido: employee.apellido, cargo: employee.cargo },
      cycles,
    });
  }
);

router.post("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const { companyId, schoolId } = resolveTenantIds(req);
  let effectiveSchoolId = schoolId;

  if (companyId && !effectiveSchoolId) {
    const defaultSchool = await School.findOne({ companyId, activa: true }).select("_id").lean();
    if (defaultSchool?._id) {
      effectiveSchoolId = defaultSchool._id;
    }
  }

  if (!companyId || !effectiveSchoolId || !req.body.nombre || !req.body.apellido || !req.body.cargo) {
    return res.status(400).json({
      mensaje: !effectiveSchoolId
        ? "No hay colegio activo asignado. Crea o activa un colegio primero."
        : "Debes indicar colegio, nombre, apellido y cargo",
    });
  }

  const school = await findActiveSchool(companyId, effectiveSchoolId);
  if (!school) {
    return res.status(400).json({ mensaje: "El colegio seleccionado no existe o no pertenece a tu organizacion" });
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  if (normalizedEmail) {
    const existingUser = await User.findOne({
      companyId,
      email: normalizedEmail,
      isSuperAdmin: false,
    })
      .select("_id")
      .lean();

    if (!existingUser) {
      const employeeRole = await resolveDefaultEmployeeRole({ companyId });
      if (!employeeRole) {
        return res.status(400).json({
          mensaje: "No existe un rol base EMPLEADO configurado para crear el usuario asociado.",
        });
      }
    }
  }

  const managerValidation = await validateManager({
    managerId: req.body.managerId || null,
    companyId,
    schoolId: effectiveSchoolId,
  });
  if (!managerValidation.ok) {
    return res.status(400).json({ mensaje: managerValidation.mensaje });
  }

  const employee = await Employee.create({
    companyId,
    schoolId: effectiveSchoolId,
    managerId: managerValidation.value,
    legajo: req.body.legajo?.trim() || "",
    nombre: req.body.nombre.trim(),
    apellido: req.body.apellido.trim(),
    email: normalizedEmail || "",
    cargo: req.body.cargo.trim(),
    area: req.body.area?.trim() || "",
    tipoEmpleado: req.body.tipoEmpleado || "DOCENTE",
    fechaIngreso: req.body.fechaIngreso || null,
    activo: req.body.activo !== false,
  });
  const userLinkResult = await syncUserForEmployeeCreation({ employee });

  await logAudit({
    companyId,
    schoolId: effectiveSchoolId,
    userId: req.user.userId,
    accion: "create",
    modulo: "employees",
    detalle: `Se creo el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  const { __v, ...safeEmployee } = employee.toObject ? employee.toObject() : employee;

  res.status(201).json({
    mensaje: "Empleado creado",
    employee: safeEmployee,
    user:
      userLinkResult?.user
        ? {
            _id: userLinkResult.user._id,
            email: userLinkResult.user.email,
            action: userLinkResult.action,
          }
        : null,
    temporaryPassword: userLinkResult?.temporaryPassword || null,
  });
  runInBackground(() => triggerSheetSync({ companyId: safeEmployee.companyId, schoolId: safeEmployee.schoolId }), "sheet-sync-employee-create");
});

router.put("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const employee = await Employee.findOne(filter);

  if (!employee) {
    return res.status(404).json({ mensaje: "Empleado no encontrado" });
  }

  const editableFields = [
    "managerId",
    "legajo",
    "nombre",
    "apellido",
    "email",
    "cargo",
    "area",
    "tipoEmpleado",
    "fechaIngreso",
    "activo",
  ];

  editableFields.forEach((field) => {
    if (field in req.body) {
      if (field === "email") {
        employee[field] = req.body[field]?.trim().toLowerCase() || "";
      } else if (field === "managerId") {
        employee[field] = req.body[field] || null;
      } else {
        employee[field] = req.body[field];
      }
    }
  });

  const managerValidation = await validateManager({
    managerId: employee.managerId,
    companyId: employee.companyId,
    schoolId: employee.schoolId,
    employeeId: employee._id,
  });
  if (!managerValidation.ok) {
    return res.status(400).json({ mensaje: managerValidation.mensaje });
  }
  employee.managerId = managerValidation.value;

  await employee.save();

  await logAudit({
    companyId: employee.companyId,
    schoolId: employee.schoolId,
    userId: req.user.userId,
    accion: "update",
    modulo: "employees",
    detalle: `Se actualizo el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  const { __v: _vu, ...safeUpdated } = employee.toObject ? employee.toObject() : employee;
  res.json({ mensaje: "Empleado actualizado", employee: safeUpdated });
  runInBackground(() => triggerSheetSync({ companyId: employee.companyId, schoolId: employee.schoolId }), "sheet-sync-employee-update");
});

router.delete("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const employee = await Employee.findOne(filter);
  if (!employee) {
    return res.status(404).json({ mensaje: "Empleado no encontrado" });
  }

  await Employee.updateMany(
    { managerId: employee._id, companyId: employee.companyId },
    { $set: { managerId: null } }
  );
  await DevelopmentPlan.deleteMany({
    employeeId: employee._id,
    companyId: employee.companyId,
    schoolId: employee.schoolId,
  });
  const evaluationsToDelete = await Evaluation.find({
    employeeId: employee._id,
    companyId: employee.companyId,
    schoolId: employee.schoolId,
  }, "_id");
  const evaluationIds = evaluationsToDelete.map((e) => e._id);
  if (evaluationIds.length > 0) {
    await EvaluationScore.deleteMany({ evaluationId: { $in: evaluationIds } });
  }
  await Evaluation.deleteMany({
    employeeId: employee._id,
    companyId: employee.companyId,
    schoolId: employee.schoolId,
  });
  await Employee.deleteOne({ _id: employee._id });

  await logAudit({
    companyId: employee.companyId,
    schoolId: employee.schoolId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "employees",
    detalle: `Se elimino el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  res.json({ mensaje: "Empleado eliminado" });
  runInBackground(() => triggerSheetSync({ companyId: employee.companyId, schoolId: employee.schoolId }), "sheet-sync-employee-delete");
});

export default router;
