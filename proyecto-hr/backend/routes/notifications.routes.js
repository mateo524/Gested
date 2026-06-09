import express from "express";
import { auth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/rbac.js";
import User from "../models/User.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Company from "../models/Company.js";
import { sendEvaluationReminderEmail } from "../utils/mailer.js";
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
        evaluadorId: user._id,
        estado: { $in: ["Borrador", "Pendiente"] },
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

export default router;
