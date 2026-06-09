// Fire-and-forget Slack webhook notifier.
// Set SLACK_WEBHOOK_URL env var to enable. If not set, silently no-ops.

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;

export async function sendSlack(text, blocks = null) {
  if (!WEBHOOK) return;
  const body = blocks ? { text, blocks } : { text };
  fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// Pre-built message builders
export const slack = {
  newOrg: (companyName, adminEmail) =>
    sendSlack(`🏢 *Nueva organización creada*\n*Empresa:* ${companyName}\n*Admin:* ${adminEmail}`),

  demoBooked: (name, email, eventTime) =>
    sendSlack(`📅 *Demo agendada*\n*Nombre:* ${name}\n*Email:* ${email}\n*Fecha:* ${eventTime}`),

  cycleStarted: (companyName, periodo) =>
    sendSlack(`🔄 *Ciclo iniciado*\n*Empresa:* ${companyName}\n*Período:* ${periodo}`),

  cycleClosed: (companyName, periodo, totalEvals) =>
    sendSlack(`✅ *Ciclo cerrado*\n*Empresa:* ${companyName}\n*Período:* ${periodo}\n*Evaluaciones:* ${totalEvals}`),

  overdueEvaluations: (companyName, count) =>
    sendSlack(`⚠️ *Evaluaciones vencidas*\n*Empresa:* ${companyName}\n*Cantidad:* ${count} evaluaciones sin completar`),

  newDeal: (name, email) =>
    sendSlack(`💰 *Nuevo deal en HubSpot*\n*Nombre:* ${name}\n*Email:* ${email}`),
};
