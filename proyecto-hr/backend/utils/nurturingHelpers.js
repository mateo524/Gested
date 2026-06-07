import LeadDrip from "../models/LeadDrip.js";
import { DRIP_STEPS } from "./nurturingSequence.js";
import { dispatch } from "./mailer.js";

/**
 * Enroll a lead in the nurturing sequence.
 * - If already enrolled, silently returns the existing doc.
 * - Creates the LeadDrip document and sends step 0 immediately.
 */
export async function enrollLead({ email, name, company, source = "manual" }) {
  if (!email) throw new Error("enrollLead: email is required");

  const normalized = email.toLowerCase().trim();

  // Idempotent: skip if already enrolled
  const existing = await LeadDrip.findOne({ email: normalized });
  if (existing) return existing;

  const lead = await LeadDrip.create({
    email: normalized,
    name,
    company,
    source,
    currentStep: 0,
    enrolled: new Date(),
  });

  // Send step 0 immediately
  const step = DRIP_STEPS[0];
  if (step) {
    const html = step.buildHtml(lead);
    await dispatch({ to: lead.email, subject: step.subject, html });
    lead.lastSentAt = new Date();
    lead.currentStep = 1; // next step to send
    await lead.save();
  }

  return lead;
}
