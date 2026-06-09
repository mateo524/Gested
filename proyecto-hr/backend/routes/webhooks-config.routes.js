import express from "express";
import crypto from "crypto";
import WebhookConfig from "../models/WebhookConfig.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

export default router;
export { WebhookConfig };

// ─── Supported events ─────────────────────────────────────────────────────────

export const SUPPORTED_EVENTS = [
  "evaluation.created",
  "evaluation.closed",
  "employee.created",
  "cycle.started",
  "plan.created",
];

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const filter = buildScopedFilter(req, {});
    const webhooks = await WebhookConfig.find(filter).sort({ createdAt: -1 }).lean();
    res.json(webhooks);
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const { url, events } = req.body;
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ mensaje: "URL inválida. Debe comenzar con http o https." });
    }
    const validEvents = (Array.isArray(events) ? events : []).filter((e) =>
      SUPPORTED_EVENTS.includes(e)
    );
    if (!validEvents.length) {
      return res.status(400).json({ mensaje: "Seleccioná al menos un evento válido." });
    }

    const companyId = req.scope.companyId;
    if (!companyId) {
      return res.status(400).json({ mensaje: "No se pudo resolver la organización." });
    }

    const secret = crypto.randomBytes(32).toString("hex");

    const webhook = await WebhookConfig.create({
      companyId,
      url: url.trim(),
      events: validEvents,
      active: true,
      secret,
    });

    res.status(201).json({ mensaje: "Webhook creado", webhook });
  }
);

router.delete(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const webhook = await WebhookConfig.findOne(filter);
    if (!webhook) {
      return res.status(404).json({ mensaje: "Webhook no encontrado." });
    }
    await WebhookConfig.deleteOne({ _id: webhook._id });
    res.json({ mensaje: "Webhook eliminado." });
  }
);

router.post(
  "/:id/test",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const webhook = await WebhookConfig.findOne(filter).lean();
    if (!webhook) {
      return res.status(404).json({ mensaje: "Webhook no encontrado." });
    }

    const event = "test";
    const payload = { message: "Prueba de conexión desde Zentor RRHH" };
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(JSON.stringify({ event, payload, timestamp }))
      .digest("hex");

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Zentor-Signature": signature,
        },
        body: JSON.stringify({ event, payload, timestamp, signature }),
        signal: AbortSignal.timeout(8000),
      });
      res.json({ mensaje: "Test enviado.", status: response.status, ok: response.ok });
    } catch (error) {
      res.status(502).json({ mensaje: `No se pudo conectar con la URL: ${error.message}` });
    }
  }
);
