import express from "express";
import PulseCheck from "../models/PulseCheck.js";
import PulseResponse from "../models/PulseResponse.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

// GET /pulse — list active pulse checks for the company (all authenticated users)
router.get("/", auth, attachTenantScope, async (req, res) => {
  const companyId = req.scope.companyId;
  if (!companyId) return res.status(400).json({ mensaje: "Organización no resuelta." });

  const filter = { companyId, active: true };
  if (req.query.all === "true" && req.scope.isSuperAdmin) {
    delete filter.active;
  }

  const checks = await PulseCheck.find(filter).sort({ createdAt: -1 }).lean();

  // For each check, also include whether the current user has already responded
  const userId = req.user.userId;
  const checkIds = checks.map((c) => c._id);
  const existingResponses = await PulseResponse.find({
    pulseCheckId: { $in: checkIds },
    userId,
  })
    .select("pulseCheckId")
    .lean();

  const respondedSet = new Set(existingResponses.map((r) => String(r.pulseCheckId)));

  const result = checks.map((c) => ({
    ...c,
    hasResponded: respondedSet.has(String(c._id)),
  }));

  res.json(result);
});

// POST /pulse — create a new pulse check (requires manage_settings)
router.post(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const companyId = req.scope.companyId;
    if (!companyId) return res.status(400).json({ mensaje: "Organización no resuelta." });

    const { title, questions, closesAt } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ mensaje: "El título es requerido." });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ mensaje: "Debes agregar al menos una pregunta." });
    }
    for (const q of questions) {
      if (!q.text || !q.type || !["scale", "text"].includes(q.type)) {
        return res.status(400).json({ mensaje: "Cada pregunta debe tener texto y tipo (scale o text)." });
      }
    }

    const check = await PulseCheck.create({
      companyId,
      title: title.trim(),
      questions,
      active: true,
      closesAt: closesAt ? new Date(closesAt) : null,
    });

    res.status(201).json({ mensaje: "Encuesta creada", check });
  }
);

// POST /pulse/:id/respond — submit answers (any authenticated user, once per check)
router.post("/:id/respond", auth, attachTenantScope, async (req, res) => {
  const companyId = req.scope.companyId;
  if (!companyId) return res.status(400).json({ mensaje: "Organización no resuelta." });

  const check = await PulseCheck.findOne({ _id: req.params.id, companyId, active: true }).lean();
  if (!check) return res.status(404).json({ mensaje: "Encuesta no encontrada o inactiva." });

  const userId = req.user.userId;
  const existing = await PulseResponse.findOne({ pulseCheckId: check._id, userId }).lean();
  if (existing) return res.status(409).json({ mensaje: "Ya respondiste esta encuesta." });

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ mensaje: "Las respuestas deben ser un arreglo." });
  }

  // Validate answers match questions
  const validated = check.questions.map((q, idx) => {
    const ans = (answers || []).find((a) => a.questionIndex === idx) || {};
    if (q.type === "scale") {
      const val = Number(ans.scaleValue);
      if (!val || val < 1 || val > 5) {
        return null; // will be filtered as invalid
      }
      return { questionIndex: idx, scaleValue: val, textValue: null };
    }
    return { questionIndex: idx, scaleValue: null, textValue: String(ans.textValue || "").trim() };
  });

  const hasInvalidScale = validated.some((a, idx) => a === null && check.questions[idx].type === "scale");
  if (hasInvalidScale) {
    return res.status(400).json({ mensaje: "Las preguntas de escala requieren un valor entre 1 y 5." });
  }

  const response = await PulseResponse.create({
    pulseCheckId: check._id,
    userId,
    companyId,
    answers: validated.filter(Boolean),
    submittedAt: new Date(),
  });

  res.status(201).json({ mensaje: "Respuesta enviada", response });
});

// GET /pulse/:id/results — aggregated results (requires view_reports)
router.get(
  "/:id/results",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.VIEW_REPORTS),
  async (req, res) => {
    const companyId = req.scope.companyId;
    if (!companyId) return res.status(400).json({ mensaje: "Organización no resuelta." });

    const check = await PulseCheck.findOne({ _id: req.params.id, companyId }).lean();
    if (!check) return res.status(404).json({ mensaje: "Encuesta no encontrada." });

    const responses = await PulseResponse.find({ pulseCheckId: check._id, companyId }).lean();

    const questionResults = check.questions.map((q, idx) => {
      const relevantAnswers = responses
        .flatMap((r) => r.answers)
        .filter((a) => a.questionIndex === idx);

      if (q.type === "scale") {
        const values = relevantAnswers.map((a) => a.scaleValue).filter(Boolean);
        const total = values.length;
        const avg = total ? Math.round((values.reduce((a, b) => a + b, 0) / total) * 10) / 10 : null;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const v of values) {
          if (distribution[v] !== undefined) distribution[v]++;
        }
        return {
          questionIndex: idx,
          text: q.text,
          type: "scale",
          average: avg,
          total,
          distribution,
        };
      }

      const textAnswers = relevantAnswers.map((a) => a.textValue).filter(Boolean);
      return {
        questionIndex: idx,
        text: q.text,
        type: "text",
        total: textAnswers.length,
        textAnswers,
      };
    });

    res.json({
      check: {
        _id: check._id,
        title: check.title,
        active: check.active,
        closesAt: check.closesAt,
        createdAt: check.createdAt,
      },
      responseCount: responses.length,
      questions: questionResults,
    });
  }
);

// DELETE /pulse/:id — delete a pulse check (requires manage_settings)
router.delete(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const companyId = req.scope.companyId;
    if (!companyId) return res.status(400).json({ mensaje: "Organización no resuelta." });

    const check = await PulseCheck.findOne({ _id: req.params.id, companyId });
    if (!check) return res.status(404).json({ mensaje: "Encuesta no encontrada." });

    await PulseCheck.deleteOne({ _id: check._id });
    await PulseResponse.deleteMany({ pulseCheckId: check._id });

    res.json({ mensaje: "Encuesta eliminada" });
  }
);

export default router;
