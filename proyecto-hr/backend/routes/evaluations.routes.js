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
import { getScopedEmployeeIds, isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";

const router = express.Router();

export async function buildEvaluationFilter(req) {
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
        const error = new Error("No puedes consultar evaluaciones de empleados fuera de tu equipo");
        error.status = 403;
        throw error;
      }
    }
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

function getEvaluationEmployeeId(evaluation) {
  return String(evaluation?.employeeId?._id || evaluation?.employeeId || "");
}

export function canEmployeeViewEvaluation(req, evaluation) {
  if (!isEmployeeScope(req?.scope)) return true;
  if (!evaluation) return false;
  if (getEvaluationEmployeeId(evaluation) !== String(req.scope.employeeId || "")) return false;
  if (evaluation.tipo === "AUTOEVALUACION") return true;
  return evaluation.estado === "CERRADA" || evaluation.estado === "PUBLICADA";
}

export function filterEvaluationsForScope(req, evaluations = []) {
  if (!isEmployeeScope(req?.scope)) return evaluations;
  return evaluations.filter((evaluation) => canEmployeeViewEvaluation(req, evaluation));
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
    buildScopedFilter(req, { _id: req.body.cycleId })
  ).lean();
  if (!cycle) {
    return { error: { status: 404, mensaje: "Ciclo no encontrado dentro de tu alcance" } };
  }

  if (isManagerScope(req.scope)) {
    const teamIds = await getScopedEmployeeIds(req.scope);
    const allowed = teamIds.some((id) => String(id) === String(employee._id));
    if (!allowed || req.body.tipo !== "JEFATURA") {
      return { error: { status: 403, mensaje: "Solo puedes evaluar a tu equipo en modalidad jefatura" } };
    }
  }

  if (isEmployeeScope(req.scope)) {
    if (req.body.tipo === "AUTOEVALUACION") {
      if (String(employee._id) !== String(req.scope.employeeId)) {
        return { error: { status: 403, mensaje: "Solo puedes crear tu propia autoevaluacion" } };
      }
    } else if (req.body.tipo === "EVALUACION_360") {
      // The employee is evaluating their own manager — verify the target is their manager
      const self = await Employee.findOne(
        buildScopedFilter(req, { _id: req.scope.employeeId })
      ).lean();
      if (!self || !self.managerId || String(self.managerId) !== String(employee._id)) {
        return { error: { status: 403, mensaje: "Solo puedes evaluar 360 a tu jefe directo" } };
      }
    } else {
      return { error: { status: 403, mensaje: "Solo puedes crear tu propia autoevaluacion o una evaluacion 360 a tu jefe" } };
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
    let filter;
    try {
      filter = await buildEvaluationFilter(req);
    } catch (error) {
      return res.status(error.status || 400).json({ mensaje: error.message });
    }
    const evaluations = await Evaluation.find(filter)
      .sort({ createdAt: -1 })
      .populate("employeeId", "nombre apellido cargo area")
      .populate("cycleId", "anio periodo etapa estado")
      .lean();

    res.json(filterEvaluationsForScope(req, evaluations));
  }
);

router.get(
  "/my-managers",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE
  ),
  async (req, res) => {
    if (!isEmployeeScope(req.scope) || !req.scope.employeeId) {
      return res.json([]);
    }
    const self = await Employee.findOne(
      buildScopedFilter(req, { _id: req.scope.employeeId })
    ).lean();
    if (!self || !self.managerId) {
      return res.json([]);
    }
    const manager = await Employee.findOne(
      buildScopedFilter(req, { _id: self.managerId })
    )
      .select("nombre apellido cargo area")
      .lean();
    return res.json(manager ? [manager] : []);
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
    let filter;
    try {
      filter = await buildEvaluationFilter(req);
    } catch (error) {
      return res.status(error.status || 400).json({ mensaje: error.message });
    }
    filter._id = req.params.id;

    const evaluation = await Evaluation.findOne(filter)
      .populate("employeeId", "nombre apellido cargo area")
      .populate("cycleId", "anio periodo etapa estado")
      .lean();

    if (!evaluation || !canEmployeeViewEvaluation(req, evaluation)) {
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
    let filter;
    try {
      filter = await buildEvaluationFilter(req);
    } catch (error) {
      return res.status(error.status || 400).json({ mensaje: error.message });
    }
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

router.delete(
  "/:id",
  auth,
  attachTenantScope,
  requireAnyPermission(
    PERMISSIONS.MANAGE_EVALUATIONS,
    PERMISSIONS.EVALUATE_TEAM,
    PERMISSIONS.SELF_EVALUATE
  ),
  async (req, res) => {
    let filter;
    try {
      filter = await buildEvaluationFilter(req);
    } catch (error) {
      return res.status(error.status || 400).json({ mensaje: error.message });
    }
    filter._id = req.params.id;

    const evaluation = await Evaluation.findOne(filter);
    if (!evaluation) {
      return res.status(404).json({ mensaje: "Evaluacion no encontrada" });
    }

    await EvaluationScore.deleteMany({ evaluationId: evaluation._id });
    await Evaluation.deleteOne({ _id: evaluation._id });

    await logAudit({
      companyId: evaluation.companyId,
      schoolId: evaluation.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "evaluations",
      detalle: `Se elimino la evaluacion ${evaluation._id}`,
    });

    res.json({ mensaje: "Evaluacion eliminada" });
  }
);

export default router;
