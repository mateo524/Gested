import express from "express";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import EvaluationScore from "../models/EvaluationScore.js";
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

async function buildEvaluationFilter(req) {
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

  if (req.query.cycleId) {
    filter.cycleId = req.query.cycleId;
  }

  if (req.query.tipo) {
    filter.tipo = req.query.tipo;
  }

  if (req.query.estado) {
    filter.estado = req.query.estado;
  }

  return filter;
}

function calculateResult(scores) {
  if (!scores.length) return 0;
  const total = scores.reduce((sum, item) => sum + Number(item.nivel || 0), 0);
  return Number((total / scores.length).toFixed(2));
}

async function validateEvaluationCreation(req) {
  const filter = buildScopedFilter(req, { _id: req.body.employeeId });
  const employee = await Employee.findOne(filter).lean();
  if (!employee) {
    return { error: { status: 404, mensaje: "Empleado no encontrado dentro de tu alcance" } };
  }

  const cycle = await EvaluationCycle.findOne(
    buildScopedFilter(req, { _id: req.body.cycleId, schoolId: employee.schoolId })
  ).lean();
  if (!cycle) {
    return { error: { status: 404, mensaje: "Ciclo no encontrado para este colegio" } };
  }

  if (req.scope.roleCode === "JEFE") {
    const teamIds = await getTeamEmployeeIds(req.scope);
    const allowed = teamIds.some((id) => String(id) === String(employee._id));
    if (!allowed || req.body.tipo !== "JEFATURA") {
      return { error: { status: 403, mensaje: "Solo puedes evaluar a tu equipo en modalidad jefatura" } };
    }
  }

  if (req.scope.roleCode === "EMPLEADO") {
    if (String(employee._id) !== String(req.scope.employeeId) || req.body.tipo !== "AUTOEVALUACION") {
      return { error: { status: 403, mensaje: "Solo puedes crear tu propia autoevaluacion" } };
    }
  }

  return { employee, cycle };
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE,
    PERMISSIONS.VIEW_REPORTS
  ),
  async (req, res) => {
    const filter = await buildEvaluationFilter(req);
    const evaluations = await Evaluation.find(filter)
      .sort({ createdAt: -1 })
      .populate("employeeId", "nombre apellido cargo area")
      .populate("cycleId", "anio periodo etapa estado")
      .lean();

    res.json(evaluations);
  }
);

router.get(
  "/:id",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE,
    PERMISSIONS.VIEW_REPORTS
  ),
  async (req, res) => {
    const filter = await buildEvaluationFilter(req);
    filter._id = req.params.id;

    const evaluation = await Evaluation.findOne(filter)
      .populate("employeeId", "nombre apellido cargo area")
      .populate("cycleId", "anio periodo etapa estado")
      .lean();

    if (!evaluation) {
      return res.status(404).json({ mensaje: "Evaluacion no encontrada" });
    }

    const scores = await EvaluationScore.find({ evaluationId: evaluation._id })
      .populate("metricId", "nombre ponderacion competencyId")
      .lean();

    res.json({ evaluation, scores });
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE
  ),
  async (req, res) => {
    if (!req.body.employeeId || !req.body.cycleId || !req.body.tipo) {
      return res.status(400).json({ mensaje: "Debes indicar empleado, ciclo y tipo de evaluacion" });
    }

    const validation = await validateEvaluationCreation(req);
    if (validation.error) {
      return res.status(validation.error.status).json({ mensaje: validation.error.mensaje });
    }

    const { employee, cycle } = validation;
    const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
    const result = calculateResult(scores);

    const evaluation = await Evaluation.create({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      employeeId: employee._id,
      evaluatorUserId: req.user.userId,
      cycleId: cycle._id,
      tipo: req.body.tipo,
      estado: req.body.estado || "BORRADOR",
      comentariosGenerales: req.body.comentariosGenerales || "",
      acuerdoEmpleado: req.body.acuerdoEmpleado || "PENDIENTE",
      resultadoFinal: result,
      evidenciaUrls: Array.isArray(req.body.evidenciaUrls) ? req.body.evidenciaUrls : [],
    });

    if (scores.length) {
      await EvaluationScore.insertMany(
        scores.map((score) => ({
          evaluationId: evaluation._id,
          metricId: score.metricId,
          nivel: score.nivel,
          comentario: score.comentario || "",
          evidenciaUrls: Array.isArray(score.evidenciaUrls) ? score.evidenciaUrls : [],
        }))
      );
    }

    await logAudit({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "evaluations",
      detalle: `Se creo una evaluacion ${req.body.tipo} para ${employee.apellido}, ${employee.nombre}`,
    });

    res.status(201).json({ mensaje: "Evaluacion creada", evaluation });
  }
);

router.put(
  "/:id",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE
  ),
  async (req, res) => {
    const filter = await buildEvaluationFilter(req);
    filter._id = req.params.id;

    const evaluation = await Evaluation.findOne(filter);
    if (!evaluation) {
      return res.status(404).json({ mensaje: "Evaluacion no encontrada" });
    }

    ["tipo", "estado", "comentariosGenerales", "acuerdoEmpleado", "evidenciaUrls"].forEach((field) => {
      if (field in req.body) {
        evaluation[field] = req.body[field];
      }
    });

    const scores = Array.isArray(req.body.scores) ? req.body.scores : null;
    if (scores) {
      evaluation.resultadoFinal = calculateResult(scores);
    }

    await evaluation.save();

    if (scores) {
      await EvaluationScore.deleteMany({ evaluationId: evaluation._id });
      if (scores.length) {
        await EvaluationScore.insertMany(
          scores.map((score) => ({
            evaluationId: evaluation._id,
            metricId: score.metricId,
            nivel: score.nivel,
            comentario: score.comentario || "",
            evidenciaUrls: Array.isArray(score.evidenciaUrls) ? score.evidenciaUrls : [],
          }))
        );
      }
    }

    await logAudit({
      companyId: evaluation.companyId,
      schoolId: evaluation.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "evaluations",
      detalle: `Se actualizo la evaluacion ${evaluation._id}`,
    });

    res.json({ mensaje: "Evaluacion actualizada", evaluation });
  }
);

export default router;
