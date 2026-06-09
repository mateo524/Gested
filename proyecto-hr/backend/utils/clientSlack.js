// Sends Slack notifications to a client org's own Slack workspace.
// Uses the webhook URL stored in their CompanySetting.

import CompanySetting from "../models/CompanySetting.js";

async function getWebhookUrl(companyId) {
  const settings = await CompanySetting.findOne({ companyId }).select("slackWebhookUrl").lean();
  return settings?.slackWebhookUrl || null;
}

async function sendClientSlack(companyId, text) {
  const url = await getWebhookUrl(companyId);
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export const clientSlack = {
  evaluationsOverdue: (companyName, count, closingDate) =>
    // called with companyId as first arg — wrap in helper below
    `⚠️ *${companyName}* — ${count} evaluacion${count > 1 ? "es" : ""} pendiente${count > 1 ? "s" : ""} de completar${closingDate ? ` (cierra ${closingDate})` : ""}.`,

  cycleStarted: (companyName, periodo) =>
    `🔄 *Nuevo ciclo iniciado* — ${periodo} en *${companyName}*. Podés acceder a las evaluaciones en ZENTOR.`,

  cycleClosed: (companyName, periodo, total, closed) =>
    `✅ *Ciclo cerrado* — ${periodo} en *${companyName}*. ${closed}/${total} evaluaciones completadas.`,
};

export async function notifyClientSlack(companyId, text) {
  return sendClientSlack(companyId, text);
}
