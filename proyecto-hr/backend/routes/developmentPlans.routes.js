import express from "express";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import Employee from "../models/Employee.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

async function getTeamEmployeeIds(scope) {
  if (!scope.employeeId) return [];
  const employees = await Employee.find({
    companyId: scope.companyId,
    schoolId: scope.schoolId,
    managerId: scope.employeeId,
    activo: true,
  })
    .select("_id")
    .lean();

  return employees.map((item) => item._id);
}

async function buildPlansFilter(req) {
  const filter = buildScopedFilter(req, {});

  if (req.scope.roleCode === "JEFE") {
    const teamIds = await getTeamEmployeeIds(req.scope);
    filter.employeeId = { $in: teamIds };
  }

  if (req.scope.roleCode === "EMPLEADO") {
    filter.employeeId = req.scope.employeeId;
  }

  if (req.query.employeeId && req.scope.roleCode !== "EMPLEADO") {
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

  if (req.scope.roleCode === "JEFE") {
    const teamIds = await getTeamEmployeeIds(req.scope);
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
    const filter = await buildPlansFilter(req);
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

    if (req.scope.roleCode === "JEFE") {
      const teamIds = await getTeamEmployeeIds(req.scope);
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

export default router;
