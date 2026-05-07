import express from "express";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

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

router.get("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const filter = buildScopedFilter(req, {});

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

  const employees = await Employee.find(filter).sort({ apellido: 1, nombre: 1 }).lean();
  res.json(employees);
});

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
    const employee = await Employee.findOne(buildScopedFilter(req, { _id: req.params.id })).lean();
    if (!employee) {
      return res.status(404).json({ mensaje: "Empleado no encontrado" });
    }

    if (req.scope.roleCode === "JEFE" && req.scope.employeeId) {
      const isSelf = String(employee._id) === String(req.scope.employeeId);
      const isTeam = String(employee.managerId || "") === String(req.scope.employeeId);
      if (!isSelf && !isTeam) {
        return res.status(403).json({ mensaje: "No tienes acceso a esta ficha" });
      }
    }

    if (req.scope.roleCode === "EMPLEADO" && req.scope.employeeId) {
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
    email: req.body.email?.trim().toLowerCase() || "",
    cargo: req.body.cargo.trim(),
    area: req.body.area?.trim() || "",
    tipoEmpleado: req.body.tipoEmpleado || "DOCENTE",
    fechaIngreso: req.body.fechaIngreso || null,
    activo: req.body.activo !== false,
  });

  await logAudit({
    companyId,
    schoolId: effectiveSchoolId,
    userId: req.user.userId,
    accion: "create",
    modulo: "employees",
    detalle: `Se creo el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  res.status(201).json({ mensaje: "Empleado creado", employee });
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

  res.json({ mensaje: "Empleado actualizado", employee });
});

export default router;
