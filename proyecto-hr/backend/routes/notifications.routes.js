import express from "express";
import { auth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import User from "../models/User.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Company from "../models/Company.js";
import { sendEvaluationReminderEmail, dispatch } from "../utils/mailer.js";
import { slack } from "../utils/slackNotifier.js";
import { notifyClientSlack, clientSlack } from "../utils/clientSlack.js";

const router = express.Router();

// POST /notifications/remind-pending
// Sends reminder emails to all users with pending evaluations in the active cycle.
// Only callable by superAdmin or triggered via cron.
router.post("/remind-pending", auth, requireSuperAdmin, async (req, res) => {
  const { companyId } = req.body;

  const cycleQuery = companyId
    ? { companyId, estado: "Inicio" }
    : { estado: "Inicio" };

  const activeCycles = await EvaluationCycle.find(cycleQuery).lean();
  if (!activeCycles.length) {
    return res.json({ sent: 0, message: "No hay ciclos activos" });
  }

  let sent = 0;
  let errors = 0;

  for (const cycle of activeCycles) {
    const usersInCompany = await User.find({
      companyId: cycle.companyId,
      activo: true,
      email: { $exists: true, $ne: "" },
      isSuperAdmin: false,
    }).lean();

    let sentForCycle = 0;

    for (const user of usersInCompany) {
      const pending = await Evaluation.countDocuments({
        companyId: cycle.companyId,
        cycleId: cycle._id,
        evaluatorUserId: user._id,
        estado: { $in: ["BORRADOR", "ENVIADA"] },
      });

      if (pending > 0) {
        const result = await sendEvaluationReminderEmail({
          to: user.email,
          nombre: user.nombre,
          pendingCount: pending,
          cycleEndDate: cycle.fechaCierre,
        }).catch(() => ({ sent: false }));

        if (result.sent) {
          sent++;
          sentForCycle++;
        } else {
          errors++;
        }
      }
    }

    if (sentForCycle > 0) {
      Company.findById(cycle.companyId).lean().then((co) => {
        const companyName = co?.nombre || String(cycle.companyId);
        slack.overdueEvaluations(companyName, sentForCycle).catch(() => {});
        const closingDate = cycle.fechaCierre
          ? new Date(cycle.fechaCierre).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
          : null;
        notifyClientSlack(
          cycle.companyId,
          clientSlack.evaluationsOverdue(companyName, sentForCycle, closingDate)
        );
      }).catch(() => {});
    }
  }

  res.json({ sent, errors, cycles: activeCycles.length });
});

// POST /notifications/digest-biweekly
// Sends a biweekly digest to all active users summarizing pending evaluations,
// cycle status, and open development plans. Callable by superAdmin or cron.
router.post("/digest-biweekly", auth, requireSuperAdmin, async (req, res) => {
  const { companyId } = req.body;
  const tenantFilter = companyId ? { companyId } : {};

  const [activeCycles, allUsers] = await Promise.all([
    EvaluationCycle.find({ ...tenantFilter, estado: "Inicio" }).lean(),
    User.find({ ...tenantFilter, activo: true, email: { $exists: true, $ne: "" }, isSuperAdmin: false }).lean(),
  ]);

  let sent = 0;
  let errors = 0;
  const DevelopmentPlan = (await import("../models/DevelopmentPlan.js")).default;

  for (const user of allUsers) {
    try {
      const userCompanyId = user.companyId;
      const cyclesForUser = activeCycles.filter((c) => String(c.companyId) === String(userCompanyId));

      const [pendingEvals, openPlans] = await Promise.all([
        Evaluation.countDocuments({
          companyId: userCompanyId,
          cycleId: { $in: cyclesForUser.map((c) => c._id) },
          evaluatorUserId: user._id,
          estado: { $in: ["BORRADOR", "ENVIADA"] },
        }),
        DevelopmentPlan.countDocuments({ companyId: userCompanyId, employeeId: user.employeeId, estado: { $ne: "CERRADO" } }),
      ]);

      if (pendingEvals === 0 && openPlans === 0) continue;

      const lines = [];
      if (pendingEvals > 0) lines.push(`• ${pendingEvals} evaluación(es) pendiente(s) de completar.`);
      if (openPlans > 0) lines.push(`• ${openPlans} plan(es) de desarrollo activo(s).`);

      const result = await dispatch({
        to: user.email,
        subject: "📋 Tu resumen quincenal — Zentor",
        html: `<p>Hola ${user.nombre || ""},</p>
<p>Este es tu resumen quincenal de Zentor:</p>
<ul>${lines.map((l) => `<li>${l.replace("• ", "")}</li>`).join("")}</ul>
<p>Ingresá a <a href="https://app.zentor.com.ar">app.zentor.com.ar</a> para ponerte al día.</p>`,
        text: `Hola ${user.nombre || ""},\n\nTu resumen quincenal:\n${lines.join("\n")}\n\napp.zentor.com.ar`,
      }).catch(() => ({ sent: false }));

      if (result?.sent !== false) sent++;
    } catch {
      errors++;
    }
  }

  res.json({ ok: true, sent, errors, usersChecked: allUsers.length });
});

export default router;
