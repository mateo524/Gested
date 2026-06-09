import { Router } from "express";
import LeadDrip from "../models/LeadDrip.js";
import { DRIP_STEPS } from "../utils/nurturingSequence.js";
import { enrollLead } from "../utils/nurturingHelpers.js";
import { dispatch } from "../utils/mailer.js";
import { auth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/rbac.js";

const router = Router();

// ── POST /drip/enroll ──────────────────────────────────────────────────────
// Public (called from landing or other internal flows)
router.post("/enroll", async (req, res) => {
  try {
    const { email, name, company, source } = req.body ?? {};
    if (!email) return res.status(400).json({ mensaje: "El campo email es obligatorio" });

    const lead = await enrollLead({ email, name, company, source: source || "manual" });
    return res.status(200).json({ ok: true, leadId: lead._id });
  } catch (err) {
    console.error("[drip/enroll]", err.message);
    return res.status(500).json({ mensaje: "Error al enrolar el lead" });
  }
});

// ── POST /drip/process ─────────────────────────────────────────────────────
// SuperAdmin only — processes pending drip sends (run daily via cron or manual trigger)
router.post("/process", auth, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const leads = await LeadDrip.find({ completed: false, unsubscribed: false });

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const lead of leads) {
      // currentStep is the index of the next step to send (0-based after enrollment sends step 0)
      // After enrollLead, currentStep is already 1, so we start from step 1 here
      const stepIndex = lead.currentStep;
      if (stepIndex >= DRIP_STEPS.length) {
        // Mark completed if not already
        if (!lead.completed) {
          lead.completed = true;
          await lead.save();
        }
        skipped++;
        continue;
      }

      const step = DRIP_STEPS[stepIndex];
      const prevStep = stepIndex > 0 ? DRIP_STEPS[stepIndex - 1] : null;

      // Days that should have elapsed since lastSentAt (or enrollment for step 0)
      const referenceDate = lead.lastSentAt || lead.enrolled;
      const daysSinceRef = (now - referenceDate) / (1000 * 60 * 60 * 24);

      // dayOffset difference between current step and previous step
      const prevDayOffset = prevStep ? prevStep.dayOffset : 0;
      const requiredDays = step.dayOffset - prevDayOffset;

      if (daysSinceRef < requiredDays) {
        skipped++;
        continue;
      }

      try {
        const html = step.buildHtml(lead);
        const result = await dispatch({ to: lead.email, subject: step.subject, html });

        if (result.sent) {
          lead.lastSentAt = now;
          lead.currentStep = stepIndex + 1;
          if (lead.currentStep >= DRIP_STEPS.length) lead.completed = true;
          await lead.save();
          sent++;
        } else {
          errors.push({ email: lead.email, reason: result.reason });
        }
      } catch (err) {
        errors.push({ email: lead.email, reason: err.message });
      }
    }

    return res.status(200).json({ ok: true, sent, skipped, errors });
  } catch (err) {
    console.error("[drip/process]", err.message);
    return res.status(500).json({ mensaje: "Error al procesar el drip" });
  }
});

// ── GET /drip/leads ────────────────────────────────────────────────────────
router.get("/leads", auth, requireSuperAdmin, async (_req, res) => {
  try {
    const leads = await LeadDrip.find().sort({ enrolled: -1 }).lean();
    return res.status(200).json({ ok: true, leads });
  } catch (err) {
    console.error("[drip/leads]", err.message);
    return res.status(500).json({ mensaje: "Error al obtener los leads" });
  }
});

// ── POST /drip/unsubscribe ─────────────────────────────────────────────────
// Public — called from email footer link
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    // Also support GET-style query param for one-click links
    const target = email || req.query?.email;
    if (!target) return res.status(400).json({ mensaje: "Email requerido" });

    await LeadDrip.updateOne(
      { email: target.toLowerCase().trim() },
      { $set: { unsubscribed: true } }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[drip/unsubscribe]", err.message);
    return res.status(500).json({ mensaje: "Error al desuscribir" });
  }
});

// Also support GET for one-click unsubscribe links in emails
router.get("/unsubscribe", async (req, res) => {
  try {
    const email = req.query?.email;
    if (!email) return res.status(400).send("Email requerido");

    await LeadDrip.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { unsubscribed: true } }
    );

    return res.status(200).send(
      `<html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;color:#0f172a">
        <h2>Desuscripto correctamente</h2>
        <p style="color:#64748b">No recibirás más emails de esta secuencia.</p>
      </body></html>`
    );
  } catch (err) {
    console.error("[drip/unsubscribe GET]", err.message);
    return res.status(500).send("Error al desuscribir");
  }
});

export default router;
