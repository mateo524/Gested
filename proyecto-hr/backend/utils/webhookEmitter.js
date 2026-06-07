import crypto from "crypto";
import WebhookConfig from "../models/WebhookConfig.js";

export async function emitWebhook(companyId, event, payload) {
  try {
    const configs = await WebhookConfig.find({
      companyId,
      active: true,
      events: event,
    }).lean();

    if (!configs.length) return;

    const timestamp = new Date().toISOString();

    for (const config of configs) {
      try {
        const body = { event, payload, timestamp };
        const signature = crypto
          .createHmac("sha256", config.secret)
          .update(JSON.stringify({ event, payload, timestamp }))
          .digest("hex");

        fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Zentor-Signature": signature,
          },
          body: JSON.stringify({ ...body, signature }),
        }).catch(() => {});
      } catch {
        // fire-and-forget, silent errors
      }
    }
  } catch {
    // silent
  }
}
