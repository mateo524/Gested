import express from "express";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationScore from "../models/EvaluationScore.js";
import Employee from "../models/Employee.js";
import Metric from "../models/Metric.js";
import Competency from "../models/Competency.js";
import Company from "../models/Company.js";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";
import { runInBackground } from "../utils/background.js";
import { triggerSheetSync } from "../utils/sheetSync.js";
import { emitWebhook } from "../utils/webhookEmitter.js";
import { slack } from "../utils/slackNotifier.js";
import { notifyClientSlack, clientSlack } from "../utils/clientSlack.js";

const router = express.Router();

export function resolveTenantIds(req) {
  const companyFromHeader = req.get("X-Company-Id");
  const companyId = req.scope.isSuperAdmin
    ? req.body.companyId || req.query.companyId || companyFromHeader
    : req.scope.companyId;

  let schoolId = req.scope.isSuperAdmin
    ? req.body.schoolId || req.query.schoolId
    : req.scope.schoolId;

  if (!schoolId && companyId) {
    schoolId = req.body.schoolId || req.query.schoolId || null;
  }

  return { companyId, schoolId };
}

async function assertSchoolInCompany(companyId, schoolId) {
  if (!companyId || !schoolId) return false;
  const school = await School.findOne({ _id: schoolId, companyId, activa: true }).select("_id").lean();
  return Boolean(school);
}

function validateCycleDates({ fechaInicio, fechaFin }) {
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, mensaje: "Las fechas del período no son válidas." };
  }

  if (start > end) {
    return { ok: false, mensaje: "La fecha de inicio no puede ser posterior a la fecha de fin." };
  }

  return { ok: true, start, end };
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES, PERMISSIONS.VIEW_REPORTS),
  async (req, res) => {
    const filter = buildScopedFilter(req, {});

    if (req.scope.isSuperAdmin && req.query.schoolId) {
      filter.schoolId = req.query.schoolId;
    }

    if (req.query.anio) {
      filter.anio = Number(req.query.anio);
    }

    if (req.query.estado) {
      filter.estado = req.query.estado;
    }

    const cycles = await EvaluationCycle.find(filter).sort({ anio: -1, fechaInicio: -1 }).lean();
    res.json(cycles);
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const { companyId, schoolId } = resolveTenantIds(req);

    if (!companyId) {
      return res.status(400).json({ mensaje: "No pudimos resolver la organización activa para crear el ciclo." });
    }

    if (!req.body.anio || !req.body.periodo || !req.body.etapa) {
      return res.status(400).json({ mensaje: "Debes indicar año, período y etapa." });
    }

    if (schoolId && !(await assertSchoolInCompany(companyId, schoolId))) {
      return res.status(400).json({ mensaje: "La institución activa no pertenece a tu organización." });
    }

    const dateValidation = validateCycleDates(req.body);
    if (!dateValidation.ok) {
      return res.status(400).json({ mensaje: dateValidation.mensaje });
    }

    const cycle = await EvaluationCycle.create({
      companyId,
      schoolId: schoolId || null,
      anio: Number(req.body.anio),
      periodo: req.body.periodo.trim(),
      etapa: req.body.etapa,
      estado: req.body.estado || "BORRADOR",
      fechaInicio: dateValidation.start,
      fechaFin: dateValidation.end,
    });

    runInBackground(() => logAudit({
      companyId,
      schoolId,
      userId: req.user.userId,
      accion: "create",
      modulo: "evaluation-cycles",
      detalle: `Se creo el ciclo ${cycle.periodo} ${cycle.anio}`,
    }), "audit-cycle-create");

    if (cycle.estado === "ABIERTO") {
      emitWebhook(String(companyId), "cycle.started", {
        cycleId: String(cycle._id),
        anio: cycle.anio,
        periodo: cycle.periodo,
        estado: cycle.estado,
      });
      Company.findById(companyId).lean().then((co) => {
        const companyName = co?.nombre || String(companyId);
        slack.cycleStarted(companyName, cycle.periodo).catch(() => {});
        notifyClientSlack(companyId, clientSlack.cycleStarted(companyName, cycle.periodo));
      }).catch(() => {});
    }

    if (cycle.estado === "CERRADO") {
      Company.findById(companyId).lean().then(async (co) => {
        const companyName = co?.nombre || String(companyId);
        const totalEvals = await Evaluation.countDocuments({ cycleId: cycle._id }).catch(() => 0);
        const closedEvals = await Evaluation.countDocuments({ cycleId: cycle._id, estado: "CERRADA" }).catch(() => 0);
        slack.cycleClosed(companyName, cycle.periodo, totalEvals).catch(() => {});
        notifyClientSlack(companyId, clientSlack.cycleClosed(companyName, cycle.periodo, totalEvals, closedEvals));
      }).catch(() => {});
    }

    res.status(201).json({ mensaje: "Ciclo creado", cycle });
    runInBackground(() => triggerSheetSync({ companyId: String(companyId), schoolId: schoolId ? String(schoolId) : undefined }), "sheet-sync-cycle-create");
  }
);

router.put(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const cycle = await EvaluationCycle.findOne(filter);

    if (!cycle) {
      return res.status(404).json({ mensaje: "Ciclo no encontrado" });
    }

    ["anio", "periodo", "etapa", "estado", "fechaInicio", "fechaFin"].forEach((field) => {
      if (field in req.body) {
        cycle[field] = req.body[field];
      }
    });

    const dateValidation = validateCycleDates({
      fechaInicio: cycle.fechaInicio,
      fechaFin: cycle.fechaFin,
    });
    if (!dateValidation.ok) {
      return res.status(400).json({ mensaje: dateValidation.mensaje });
    }
    cycle.fechaInicio = dateValidation.start;
    cycle.fechaFin = dateValidation.end;

    await cycle.save();

    runInBackground(() => logAudit({
      companyId: cycle.companyId,
      schoolId: cycle.schoolId,
      userId: req.user.userId,
      accion: "update",
      modulo: "evaluation-cycles",
      detalle: `Se actualizo el ciclo ${cycle.periodo} ${cycle.anio}`,
    }), "audit-cycle-update");

    if (cycle.estado === "ABIERTO") {
      emitWebhook(String(cycle.companyId), "cycle.started", {
        cycleId: String(cycle._id),
        anio: cycle.anio,
        periodo: cycle.periodo,
        estado: cycle.estado,
      });
      Company.findById(cycle.companyId).lean().then((co) => {
        const companyName = co?.nombre || String(cycle.companyId);
        slack.cycleStarted(companyName, cycle.periodo).catch(() => {});
        notifyClientSlack(cycle.companyId, clientSlack.cycleStarted(companyName, cycle.periodo));
      }).catch(() => {});
    }

    if (cycle.estado === "CERRADO") {
      Company.findById(cycle.companyId).lean().then(async (co) => {
        const companyName = co?.nombre || String(cycle.companyId);
        const totalEvals = await Evaluation.countDocuments({ cycleId: cycle._id }).catch(() => 0);
        const closedEvals = await Evaluation.countDocuments({ cycleId: cycle._id, estado: "CERRADA" }).catch(() => 0);
        slack.cycleClosed(companyName, cycle.periodo, totalEvals).catch(() => {});
        notifyClientSlack(cycle.companyId, clientSlack.cycleClosed(companyName, cycle.periodo, totalEvals, closedEvals));
      }).catch(() => {});
    }

    res.json({ mensaje: "Ciclo actualizado", cycle });
    runInBackground(() => triggerSheetSync({ companyId: String(cycle.companyId), schoolId: cycle.schoolId ? String(cycle.schoolId) : undefined }), "sheet-sync-cycle-update");
  }
);

router.delete(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const cycle = await EvaluationCycle.findOne(filter);
    if (!cycle) {
      return res.status(404).json({ mensaje: "Ciclo no encontrado" });
    }

    // Cascade delete: remove child evaluations and their scores first
    const evaluations = await Evaluation.find({ cycleId: cycle._id }).select("_id").lean();
    if (evaluations.length > 0) {
      const evalIds = evaluations.map((e) => e._id);
      await EvaluationScore.deleteMany({ evaluationId: { $in: evalIds } });
      await Evaluation.deleteMany({ _id: { $in: evalIds } });
    }

    await EvaluationCycle.deleteOne({ _id: cycle._id });

    runInBackground(() => logAudit({
      companyId: cycle.companyId,
      schoolId: cycle.schoolId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "evaluation-cycles",
      detalle: `Se elimino el ciclo ${cycle.periodo} ${cycle.anio}`,
    }), "audit-cycle-delete");

    res.json({ mensaje: "Ciclo eliminado" });
    runInBackground(() => triggerSheetSync({ companyId: String(cycle.companyId), schoolId: cycle.schoolId ? String(cycle.schoolId) : undefined }), "sheet-sync-cycle-delete");
  }
);

// GET /evaluation-cycles/:id/progress — completion stats for a cycle
router.get(
  "/:id/progress",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATION_CYCLES, PERMISSIONS.MANAGE_EVALUATIONS, PERMISSIONS.VIEW_REPORTS),
  async (req, res) => {
    const scopedFilter = buildScopedFilter(req, { _id: req.params.id });
    const cycle = await EvaluationCycle.findOne(scopedFilter).lean();
    if (!cycle) return res.status(404).json({ mensaje: "Ciclo no encontrado" });

    const companyFilter = buildScopedFilter(req, {});
    const [employees, evaluations] = await Promise.all([
      Employee.find({ ...companyFilter, activo: true }).select("_id nombre apellido cargo area").lean(),
      Evaluation.find({ ...companyFilter, cycleId: cycle._id })
        .select("employeeId tipo estado resultadoFinal")
        .populate("employeeId", "nombre apellido")
        .lean(),
    ]);

    const evalByEmployee = new Map();
    evaluations.forEach((ev) => {
      const key = String(ev.employeeId?._id || ev.employeeId);
      if (!evalByEmployee.has(key)) evalByEmployee.set(key, []);
      evalByEmployee.get(key).push(ev);
    });

    const rows = employees.map((emp) => {
      const evs = evalByEmployee.get(String(emp._id)) || [];
      const closed = evs.filter((e) => ["CERRADA", "REVISADA"].includes(e.estado));
      const pending = evs.filter((e) => ["BORRADOR", "ENVIADA"].includes(e.estado));
      const avgScore = closed.length
        ? Number((closed.reduce((s, e) => s + Number(e.resultadoFinal || 0), 0) / closed.length).toFixed(2))
        : null;
      return {
        employeeId: String(emp._id),
        nombre: `${emp.apellido}, ${emp.nombre}`,
        cargo: emp.cargo || "",
        area: emp.area || "",
        total: evs.length,
        closed: closed.length,
        pending: pending.length,
        avgScore,
        done: evs.length > 0 && pending.length === 0,
      };
    });

    const total = rows.length;
    const withEvals = rows.filter((r) => r.total > 0).length;
    const allDone = rows.filter((r) => r.done).length;
    const pct = total > 0 ? Math.round((allDone / total) * 100) : 0;

    res.json({
      cycleId: String(cycle._id),
      periodo: cycle.periodo,
      estado: cycle.estado,
      summary: { total, withEvals, allDone, pct },
      rows: rows.sort((a, b) => Number(a.done) - Number(b.done)),
    });
  }
);

// GET /evaluation-cycles/:id/calibration — calibration matrix for a cycle
router.get(
  "/:id/calibration",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EVALUATIONS, PERMISSIONS.VIEW_REPORTS),
  async (req, res) => {
    const scopedFilter = buildScopedFilter(req, { _id: req.params.id });
    const cycle = await EvaluationCycle.findOne(scopedFilter).lean();
    if (!cycle) {
      return res.status(404).json({ mensaje: "Ciclo no encontrado" });
    }

    // Find all evaluations for this cycle (prefer JEFATURA, fall back to any type)
    const evalFilter = buildScopedFilter(req, { cycleId: cycle._id });
    const evaluations = await Evaluation.find(evalFilter).lean();

    if (!evaluations.length) {
      return res.json({
        cycle: { periodo: cycle.periodo, estado: cycle.estado },
        competencies: [],
        rows: [],
        areaAverages: {},
      });
    }

    // Collect all evaluation IDs and employee IDs
    const evalIds = evaluations.map((e) => e._id);
    const employeeIds = [...new Set(evaluations.map((e) => String(e.employeeId)))];

    // Fetch scores, employees, metrics and competencies in parallel
    const [scores, employees, metrics] = await Promise.all([
      EvaluationScore.find({ evaluationId: { $in: evalIds } }).lean(),
      Employee.find({ _id: { $in: employeeIds } }).lean(),
      Metric.find(buildScopedFilter(req, { activa: true })).lean(),
    ]);

    // Collect competency IDs from the metrics used in scores
    const metricById = new Map(metrics.map((m) => [String(m._id), m]));
    const competencyIds = [...new Set(metrics.map((m) => String(m.competencyId)).filter(Boolean))];
    const competencies = await Competency.find({ _id: { $in: competencyIds } }).lean();
    const competencyById = new Map(competencies.map((c) => [String(c._id), c]));

    // Build: employeeId → best evaluation (prefer REVISADA > ENVIADA > BORRADOR, prefer JEFATURA)
    const typeRank = { JEFATURA: 0, FINAL: 1, AUTOEVALUACION: 2, EVALUACION_360: 3 };
    const stateRank = { REVISADA: 0, CERRADA: 1, ENVIADA: 2, BORRADOR: 3 };
    const bestEvalByEmployee = new Map();
    for (const ev of evaluations) {
      const key = String(ev.employeeId);
      const existing = bestEvalByEmployee.get(key);
      if (!existing) {
        bestEvalByEmployee.set(key, ev);
      } else {
        const newTypeRank = typeRank[ev.tipo] ?? 99;
        const existTypeRank = typeRank[existing.tipo] ?? 99;
        const newStateRank = stateRank[ev.estado] ?? 99;
        const existStateRank = stateRank[existing.estado] ?? 99;
        if (newTypeRank < existTypeRank || (newTypeRank === existTypeRank && newStateRank < existStateRank)) {
          bestEvalByEmployee.set(key, ev);
        }
      }
    }

    // Map scores by evaluationId
    const scoresByEval = new Map();
    for (const score of scores) {
      const key = String(score.evaluationId);
      if (!scoresByEval.has(key)) scoresByEval.set(key, []);
      scoresByEval.get(key).push(score);
    }

    // Build competency name list (only those referenced by scores in this cycle)
    const usedCompetencyIds = new Set();
    for (const [, evalScores] of scoresByEval) {
      for (const s of evalScores) {
        const metric = metricById.get(String(s.metricId));
        if (metric?.competencyId) usedCompetencyIds.add(String(metric.competencyId));
      }
    }
    const competencyNames = [...usedCompetencyIds].map((id) => competencyById.get(id)?.nombre).filter(Boolean);

    // Build rows
    const employeeById = new Map(employees.map((e) => [String(e._id), e]));
    const rows = [];

    for (const [empIdStr, evaluation] of bestEvalByEmployee) {
      const employee = employeeById.get(empIdStr);
      if (!employee) continue;

      const evalScores = scoresByEval.get(String(evaluation._id)) || [];

      // Aggregate scores per competency (average of metrics within a competency)
      const competencyScores = {};
      const metricsByCompetency = new Map();
      for (const s of evalScores) {
        const metric = metricById.get(String(s.metricId));
        if (!metric?.competencyId) continue;
        const compId = String(metric.competencyId);
        const compName = competencyById.get(compId)?.nombre;
        if (!compName) continue;
        if (!metricsByCompetency.has(compName)) metricsByCompetency.set(compName, []);
        metricsByCompetency.get(compName).push(s.nivel);
      }
      for (const [compName, levels] of metricsByCompetency) {
        competencyScores[compName] = Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10;
      }

      const scoreValues = Object.values(competencyScores);
      const average = scoreValues.length
        ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10) / 10
        : null;

      rows.push({
        employee: {
          _id: employee._id,
          nombre: `${employee.nombre} ${employee.apellido}`.trim(),
          area: employee.area || "",
          cargo: employee.cargo || "",
        },
        scores: competencyScores,
        average,
        evaluationType: evaluation.tipo,
        evaluationState: evaluation.estado,
      });
    }

    // Sort: by area asc, then by average desc
    rows.sort((a, b) => {
      const areaCompare = (a.employee.area || "").localeCompare(b.employee.area || "", "es");
      if (areaCompare !== 0) return areaCompare;
      return (b.average ?? -1) - (a.average ?? -1);
    });

    // Area averages
    const areaGroups = {};
    for (const row of rows) {
      const area = row.employee.area || "Sin área";
      if (!areaGroups[area]) areaGroups[area] = [];
      if (row.average !== null) areaGroups[area].push(row.average);
    }
    const areaAverages = {};
    for (const [area, avgs] of Object.entries(areaGroups)) {
      areaAverages[area] = avgs.length
        ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10
        : null;
    }

    res.json({
      cycle: { periodo: cycle.periodo, estado: cycle.estado },
      competencies: competencyNames,
      rows,
      areaAverages,
    });
  }
);

export default router;
