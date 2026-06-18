import express from "express";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import EvaluationScore from "../models/EvaluationScore.js";
import Metric from "../models/Metric.js";
import Competency from "../models/Competency.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { runInBackground } from "../utils/background.js";
import { triggerSheetSync } from "../utils/sheetSync.js";
import { emitWebhook } from "../utils/webhookEmitter.js";
import { getScopedEmployeeIds, isEmployeeScope, isManagerScope } from "../utils/employeeScope.js";
import { invalidateReportCache } from "./reports.routes.js";
import { invalidateDashboardCache } from "./dashboard.routes.js";
import { dispatch as dispatchEmail } from "../utils/mailer.js";

const router = express.Router();

// When a company has no Metrics yet (only Competencies created via the Habilidades page),
// auto-create one Metric per active Competency so evaluations can be seeded.
async function ensureMetricsFromCompetencies(companyId, schoolId) {
  const schoolFilter = schoolId
    ? { $or: [{ schoolId }, { schoolId: null }] }
    : {};
  const competencies = await Competency.find({
    companyId,
    ...schoolFilter,
    activa: true,
  }).select("_id nombre descripcion schoolId").lean();

  if (!competencies.length) return [];

  const upserts = competencies.map((c) => ({
    updateOne: {
      filter: { companyId, competencyId: c._id },
      update: {
        $setOnInsert: {
          companyId,
          schoolId: c.schoolId ?? null,
          competencyId: c._id,
          nombre: c.nombre,
          descripcion: c.descripcion || "",
          cargoAplica: [],
          ponderacion: 1,
          activa: true,
        },
      },
      upsert: true,
    },
  }));
  await Metric.bulkWrite(upserts);

  return Metric.find({ companyId, ...schoolFilter, activa: true }).select("_id cargoAplica").lean();
}

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
    const isSelf = req.scope.employeeId && String(req.scope.employeeId) === String(employee._id);
    if (isSelf) {
      // Manager evaluating themselves → must be AUTOEVALUACION
      if (req.body.tipo !== "AUTOEVALUACION") {
        return { error: { status: 403, mensaje: "La autoevaluación debe ser de tipo AUTOEVALUACION" } };
      }
    } else {
      // Manager evaluating a team member → must be JEFATURA and employee must be in their team
      const teamIds = await getScopedEmployeeIds(req.scope);
      const allowed = teamIds.some((id) => String(id) === String(employee._id));
      if (!allowed || req.body.tipo !== "JEFATURA") {
        return { error: { status: 403, mensaje: "Solo puedes evaluar a tu equipo en modalidad jefatura" } };
      }
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
    const skip = Math.max(0, parseInt(req.query.skip) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));

    const [allEvaluations, total] = await Promise.all([
      Evaluation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("employeeId", "nombre apellido cargo area")
        .populate("cycleId", "anio periodo etapa estado")
        .lean(),
      Evaluation.countDocuments(filter),
    ]);

    const evaluations = filterEvaluationsForScope(req, allEvaluations);
    res.json({ data: evaluations, total, skip, limit });
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

    let scores = await EvaluationScore.find({ evaluationId: evaluation._id })
      .populate("metricId", "nombre descripcion ponderacion competencyId cargoAplica")
      .lean();

    // Auto-seed missing scores for metrics that now apply to this employee
    const emp = evaluation.employeeId;
    const empCargo = emp?.cargo || "";
    // Include company-wide metrics (schoolId: null) AND school-specific ones.
    // Metrics default to schoolId: null so a strict match on schoolId would miss them.
    const metricSchoolFilter = evaluation.schoolId
      ? { $or: [{ schoolId: evaluation.schoolId }, { schoolId: null }] }
      : {};
    let allActive = await Metric.find({
      companyId: evaluation.companyId,
      ...metricSchoolFilter,
      activa: true,
    }).select("_id cargoAplica").lean();

    if (!allActive.length) {
      allActive = await ensureMetricsFromCompetencies(evaluation.companyId, evaluation.schoolId);
    }

    if (!empCargo) {
      console.warn(`[evaluations] GET /:id auto-seed: employee ${emp?._id} has no cargo — cargo-specific metrics will not be seeded`);
    }
    const seededIds = new Set(scores.map((s) => String(s.metricId?._id || s.metricId)));
    const missing = allActive.filter((m) => {
      if (seededIds.has(String(m._id))) return false;
      const applies = !m.cargoAplica?.length || (typeof empCargo === 'string' && empCargo.length > 0 && m.cargoAplica.includes(empCargo));
      return applies;
    });

    if (missing.length) {
      await EvaluationScore.bulkWrite(
        missing.map((m) => ({
          updateOne: {
            filter: { evaluationId: evaluation._id, metricId: m._id },
            update: { $setOnInsert: { nivel: 0, comentario: "" } },
            upsert: true,
          },
        }))
      );
      // Re-fetch with new scores
      scores = await EvaluationScore.find({ evaluationId: evaluation._id })
        .populate("metricId", "nombre descripcion ponderacion competencyId cargoAplica")
        .lean();
    }

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

    let evaluation;
    try {
      evaluation = await Evaluation.create({
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
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ mensaje: "Ya existe una evaluacion de este tipo para el empleado y ciclo indicados" });
      }
      throw err;
    }

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
    } else {
      // Pre-populate empty scores for metrics that apply to this employee.
      // Include company-wide metrics (schoolId: null) AND school-specific ones.
      const seedSchoolFilter = employee.schoolId
        ? { $or: [{ schoolId: employee.schoolId }, { schoolId: null }] }
        : {};
      let activeMetrics = await Metric.find({
        companyId: employee.companyId,
        ...seedSchoolFilter,
        activa: true,
      }).select("_id cargoAplica").lean();

      if (!activeMetrics.length) {
        activeMetrics = await ensureMetricsFromCompetencies(employee.companyId, employee.schoolId);
      }
      if (!employee.cargo) {
        console.warn(`[evaluations] POST / seed: employee ${employee._id} has no cargo — cargo-specific metrics will not be seeded`);
      }
      const applicable = activeMetrics.filter((m) => {
        return !m.cargoAplica?.length || (typeof employee.cargo === 'string' && employee.cargo.length > 0 && m.cargoAplica.includes(employee.cargo));
      });
      if (applicable.length) {
        await EvaluationScore.bulkWrite(
          applicable.map((m) => ({
            updateOne: {
              filter: { evaluationId: evaluation._id, metricId: m._id },
              update: { $setOnInsert: { nivel: 0, comentario: "" } },
              upsert: true,
            },
          }))
        );
      }
    }

    runInBackground(() => logAudit({
      companyId: employee.companyId,
      schoolId: employee.schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "evaluations",
      detalle: `Se creo una evaluacion ${req.body.tipo} para ${employee.apellido}, ${employee.nombre}`,
    }), "audit-evaluation-create");

    emitWebhook(String(employee.companyId), "evaluation.created", {
      evaluationId: String(evaluation._id),
      employeeId: String(employee._id),
      tipo: evaluation.tipo,
      estado: evaluation.estado,
    });

    invalidateReportCache(String(employee.companyId));
    invalidateDashboardCache(String(employee.companyId));
    res.status(201).json({ mensaje: "Evaluacion creada", evaluation });
    runInBackground(() => triggerSheetSync({ companyId: String(employee.companyId), schoolId: employee.schoolId ? String(employee.schoolId) : undefined }), "sheet-sync-eval-create");
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

    const ALLOWED_TIPOS = ["AUTOEVALUACION", "JEFATURA", "EVALUACION_360"];
    ["estado", "comentariosGenerales", "acuerdoEmpleado", "evidenciaUrls"].forEach((field) => {
      if (field in req.body) {
        evaluation[field] = req.body[field];
      }
    });
    // `tipo` is intentionally excluded from the editable fields to prevent
    // unauthorised type escalation or retroactive audit-trail modification.
    // Only MANAGE_EVALUATIONS admins may change tipo, and only to a known value.
    if ("tipo" in req.body) {
      if (!req.user?.permissions?.includes(PERMISSIONS.MANAGE_EVALUATIONS)) {
        return res.status(403).json({ mensaje: "No tienes permiso para cambiar el tipo de evaluacion" });
      }
      if (!ALLOWED_TIPOS.includes(req.body.tipo)) {
        return res.status(400).json({ mensaje: "Tipo de evaluacion invalido" });
      }
      evaluation.tipo = req.body.tipo;
    }

    const scores = Array.isArray(req.body.scores) ? req.body.scores : null;
    if (scores) {
      evaluation.resultadoFinal = calculateResult(scores);
    }

    if (scores) {
      // Use a transaction so the delete + insert are atomic — a mid-flight
      // failure cannot leave the evaluation with no scores.
      const mongoose = (await import("mongoose")).default;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await evaluation.save({ session });
          await EvaluationScore.deleteMany({ evaluationId: evaluation._id }, { session });
          if (scores.length) {
            await EvaluationScore.insertMany(
              scores.map((score) => ({
                evaluationId: evaluation._id,
                metricId: score.metricId,
                nivel: score.nivel,
                comentario: score.comentario || "",
                evidenciaUrls: Array.isArray(score.evidenciaUrls) ? score.evidenciaUrls : [],
              })),
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      await evaluation.save();
    }

    runInBackground(() => logAudit({
      companyId: evaluation.companyId,
      schoolId: evaluation.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "evaluations",
      detalle: `Se actualizo la evaluacion ${evaluation._id}`,
    }), "audit-evaluation-update");

    invalidateReportCache(String(evaluation.companyId));
    invalidateDashboardCache(String(evaluation.companyId));
    res.json({ mensaje: "Evaluacion actualizada", evaluation });
    runInBackground(() => triggerSheetSync({ companyId: String(evaluation.companyId), schoolId: evaluation.schoolId ? String(evaluation.schoolId) : undefined }), "sheet-sync-eval-update");
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

    runInBackground(() => logAudit({
      companyId: evaluation.companyId,
      schoolId: evaluation.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "evaluations",
      detalle: `Se elimino la evaluacion ${evaluation._id}`,
    }), "audit-evaluation-delete");

    invalidateReportCache(String(evaluation.companyId));
    invalidateDashboardCache(String(evaluation.companyId));
    res.json({ mensaje: "Evaluacion eliminada" });
    runInBackground(() => triggerSheetSync({ companyId: String(evaluation.companyId), schoolId: evaluation.schoolId ? String(evaluation.schoolId) : undefined }), "sheet-sync-eval-delete");
  }
);

router.post(
  "/send-reminders",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATIONS),
  async (req, res) => {
    const { cycleId, message: customMessage } = req.body || {};
    const scopeFilter = buildScopedFilter(req, {});

    const evalFilter = { ...scopeFilter, estado: "BORRADOR" };
    if (cycleId) evalFilter.cycleId = cycleId;

    const evaluations = await Evaluation.find(evalFilter).lean();

    // Group by employeeId to avoid duplicate emails
    const byEmployee = new Map();
    for (const ev of evaluations) {
      const key = String(ev.employeeId);
      if (!byEmployee.has(key)) {
        byEmployee.set(key, { employeeId: ev.employeeId, cycleId: ev.cycleId, count: 0 });
      }
      byEmployee.get(key).count += 1;
    }

    // Load cycle info (use first cycleId if not specified)
    let cycleName = "";
    let cycleEndDate = null;
    const firstCycleId = cycleId || (evaluations[0]?.cycleId);
    if (firstCycleId) {
      const cycle = await EvaluationCycle.findById(firstCycleId).lean();
      if (cycle) {
        cycleName = `${cycle.periodo}${cycle.anio ? ` ${cycle.anio}` : ""}`;
        cycleEndDate = cycle.fechaFin || null;
      }
    }

    // Batch-fetch all employees in a single query to avoid N+1 round-trips.
    const employeeIds = [...byEmployee.keys()];
    const employeeList = await Employee.find({ _id: { $in: employeeIds } }).lean();
    const employeeMap = new Map(employeeList.map((e) => [String(e._id), e]));

    let sent = 0;
    let failed = 0;
    const recipients = [];

    for (const { employeeId, count } of byEmployee.values()) {
      const employee = employeeMap.get(String(employeeId));
      if (!employee?.email) { failed++; continue; }

      const nombre = `${employee.nombre || ""} ${employee.apellido || ""}`.trim();
      const subject = `Recordatorio: Tenés una evaluación pendiente${cycleName ? ` — ${cycleName}` : ""}`;

      const extraHtml = customMessage
        ? `<p style="color:#475569;margin:16px 0 0">${customMessage}</p>`
        : "";

      const url = process.env.FRONTEND_URL || "https://gested-l6ej.vercel.app";
      const dateStr = cycleEndDate
        ? new Date(cycleEndDate).toLocaleDateString("es-AR", { day: "numeric", month: "long" })
        : "";

      const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;background:#fff;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#0f172a">ZENTOR</span><span style="color:#14b8a6;font-weight:700">.</span>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px">Tenés ${count} evaluación${count > 1 ? "es" : ""} pendiente${count > 1 ? "s" : ""}</h1>
  <p style="color:#475569;margin:0 0 8px">Hola <strong>${nombre}</strong>${cycleName ? `, te recordamos que el ciclo <strong>${cycleName}</strong>` : ""}${dateStr ? ` cierra el <strong>${dateStr}</strong>` : " tiene evaluaciones pendientes"}.</p>
  <p style="color:#475569;margin:0 0 24px">Completá tus evaluaciones para que el reporte ejecutivo quede completo.</p>
  ${extraHtml}
  <a href="${url}?view=evaluaciones" style="display:inline-block;background:#14b8a6;color:#0f172a;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;font-size:15px;margin-top:${extraHtml ? "16px" : "0"}">
    Completar evaluaciones →
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">¿Necesitás ayuda? <a href="mailto:zentorhq@gmail.com" style="color:#14b8a6">zentorhq@gmail.com</a></p>
</div>`;

      try {
        const result = await dispatchEmail({ to: employee.email, subject, html });
        if (result?.sent) {
          sent++;
          recipients.push(employee.email);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    runInBackground(() => logAudit({
      companyId: req.scope?.companyId,
      schoolId: req.scope?.schoolId,
      userId: req.user.userId,
      accion: "send_reminders",
      modulo: "evaluations",
      detalle: `Recordatorios enviados: ${sent}, fallidos: ${failed}${cycleId ? `, ciclo: ${cycleId}` : ""}`,
    }), "audit-send-reminders");

    res.json({ sent, failed, recipients });
  }
);

// POST /evaluations/bulk — create one JEFATURA evaluation per employeeId in a single request.
// Skips duplicates (same employee+cycle+tipo) instead of failing the whole batch.
router.post(
  "/bulk",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATIONS, PERMISSIONS.EVALUATE_TEAM),
  async (req, res, next) => {
    try {
    const { cycleId, tipo, employeeIds } = req.body || {};

    if (!cycleId || !tipo || !Array.isArray(employeeIds) || !employeeIds.length) {
      return res.status(400).json({ mensaje: "Debes indicar cycleId, tipo y al menos un employeeId." });
    }

    const { Types: MongooseTypes } = (await import("mongoose")).default;

    if (!MongooseTypes.ObjectId.isValid(cycleId)) {
      return res.status(400).json({ mensaje: "cycleId no es un ObjectId válido." });
    }
    const validEmployeeIds = employeeIds.filter((id) => MongooseTypes.ObjectId.isValid(id));
    if (!validEmployeeIds.length) {
      return res.status(400).json({ mensaje: "Ningún employeeId es un ObjectId válido." });
    }

    const scopeFilter = buildScopedFilter(req, {});
    const cycle = await EvaluationCycle.findOne({ ...scopeFilter, _id: cycleId }).lean();
    if (!cycle) return res.status(404).json({ mensaje: "Ciclo no encontrado dentro de tu alcance." });

    if (!req.scope?.isSuperAdmin && String(cycle.companyId) !== String(req.scope?.companyId)) {
      return res.status(403).json({ mensaje: "El ciclo no pertenece a tu empresa." });
    }

    const employees = await Employee.find({
      ...scopeFilter,
      _id: { $in: validEmployeeIds },
      activo: true,
    }).lean();

    if (!employees.length) {
      return res.status(404).json({ mensaje: "No se encontraron empleados activos con los IDs indicados." });
    }

    const seedSchoolFilter = cycle.schoolId
      ? { $or: [{ schoolId: cycle.schoolId }, { schoolId: null }] }
      : {};
    let activeMetrics = await Metric.find({
      companyId: cycle.companyId,
      ...seedSchoolFilter,
      activa: true,
    }).select("_id cargoAplica").lean();

    if (!activeMetrics.length) {
      activeMetrics = await ensureMetricsFromCompetencies(cycle.companyId, cycle.schoolId);
    }

    let created = 0;
    let skipped = 0;
    const allScoreOps = [];

    for (const employee of employees) {
      let evaluation;
      try {
        evaluation = await Evaluation.create({
          companyId: employee.companyId,
          schoolId: employee.schoolId ?? null,
          employeeId: employee._id,
          evaluatorUserId: req.user.userId,
          cycleId: cycle._id,
          tipo,
          estado: "BORRADOR",
          comentariosGenerales: "",
          acuerdoEmpleado: "PENDIENTE",
          resultadoFinal: 0,
          evidenciaUrls: [],
        });
        created++;
      } catch (err) {
        if (err.code === 11000) { skipped++; continue; }
        return next(err);
      }

      const applicable = activeMetrics.filter((m) => {
        return !m.cargoAplica?.length ||
          (typeof employee.cargo === "string" && employee.cargo.length > 0 && m.cargoAplica.includes(employee.cargo));
      });
      for (const m of applicable) {
        allScoreOps.push({
          updateOne: {
            filter: { evaluationId: evaluation._id, metricId: m._id },
            update: { $setOnInsert: { companyId: employee.companyId, schoolId: employee.schoolId ?? null, nivel: 0, comentario: "" } },
            upsert: true,
          },
        });
      }
    }

    if (allScoreOps.length) {
      await EvaluationScore.bulkWrite(allScoreOps);
    }

    runInBackground(() => logAudit({
      companyId: cycle.companyId,
      schoolId: cycle.schoolId,
      userId: req.user.userId,
      accion: "bulk_create",
      modulo: "evaluations",
      detalle: `Creación masiva: ${created} evaluaciones ${tipo}, ciclo ${cycle.periodo} ${cycle.anio}. Omitidas: ${skipped}`,
    }), "audit-bulk-eval-create");

    invalidateReportCache(String(cycle.companyId));
    invalidateDashboardCache(String(cycle.companyId));
    res.status(201).json({ mensaje: `${created} evaluación(es) creada(s), ${skipped} omitida(s).`, created, skipped });
    runInBackground(() => triggerSheetSync({ companyId: String(cycle.companyId), schoolId: cycle.schoolId ? String(cycle.schoolId) : undefined }), "sheet-sync-bulk-eval-create");
    } catch (err) {
      next(err);
    }
  }
);

export default router;
