import crypto from "crypto";
import WebhookConfig from "../models/WebhookConfig.js";

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isSafeWebhookUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) return false;
  }
  return true;
}

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
        if (!isSafeWebhookUrl(config.url)) {
          console.warn(`emitWebhook: skipping unsafe URL for config ${config._id}`);
          continue;
        }
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
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      } catch {
        // fire-and-forget, silent errors
      }
    }
  } catch {
    // silent
  }
}
