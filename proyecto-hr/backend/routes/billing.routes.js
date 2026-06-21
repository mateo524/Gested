/**
 * Billing routes — MercadoPago Preapproval (subscriptions)
 *
 * Required env vars:
 *   MP_ACCESS_TOKEN  — MercadoPago Access Token (from MP credentials page)
 *   MP_WEBHOOK_SECRET — random string used to validate webhook signatures (optional but recommended)
 *   FRONTEND_URL     — e.g. https://app.zentor.com.ar
 *
 * Plans:
 *   base — ARS $X/month, up to 50 employees
 *   pro  — ARS $Y/month, unlimited employees
 */

import { Router } from "express";
import Company      from "../models/Company.js";
import Subscription from "../models/Subscription.js";
import { auth, attachTenantScope } from "../middleware/auth.js";

const router = Router();

const MP_BASE = "https://api.mercadopago.com";

// Plan definitions — prices in ARS
const PLANS = {
  base: {
    label: "Zentor Base",
    description: "Hasta 50 empleados · Evaluaciones, reportes y planes",
    price: 29900,   // ARS 29.900/mes — ajustá según mercado
    currency: "ARS",
    frequency: 1,
    frequencyType: "months",
  },
  pro: {
    label: "Zentor Pro",
    description: "Empleados ilimitados · Todas las funciones",
    price: 69900,   // ARS 69.900/mes
    currency: "ARS",
    frequency: 1,
    frequencyType: "months",
  },
};

async function mpFetch(path, options = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN not configured");
  const res = await fetch(`${MP_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error || JSON.stringify(data);
    throw Object.assign(new Error(`MP ${res.status}: ${msg}`), { status: res.status, mpData: data });
  }
  return data;
}

// ─── GET /billing/plans ───────────────────────────────────────────────────────
// Returns available plan definitions (prices, features)
router.get("/plans", (req, res) => {
  res.json({
    ok: true,
    plans: Object.entries(PLANS).map(([key, p]) => ({ key, ...p })),
  });
});

// ─── GET /billing/status ──────────────────────────────────────────────────────
// Returns current subscription status for the authenticated company
router.get("/status", auth, attachTenantScope, async (req, res) => {
  try {
    const companyId = req.tenantCompanyId;
    const [company, sub] = await Promise.all([
      Company.findById(companyId).select("plan planExpiresAt").lean(),
      Subscription.findOne({ companyId, status: { $in: ["authorized", "pending"] } })
        .sort({ createdAt: -1 }).lean(),
    ]);

    const now = new Date();
    const expired = company?.planExpiresAt ? company.planExpiresAt < now : false;

    res.json({
      ok: true,
      plan: company?.plan ?? "pro",
      planExpiresAt: company?.planExpiresAt ?? null,
      expired,
      subscription: sub ? {
        id: sub._id,
        mpPreapprovalId: sub.mpPreapprovalId,
        status: sub.status,
        nextPaymentDate: sub.nextPaymentDate,
        lastPaymentDate: sub.lastPaymentDate,
        lastPaymentAmount: sub.lastPaymentAmount,
      } : null,
      planDef: PLANS[company?.plan ?? "pro"],
    });
  } catch (err) {
    console.error("[billing/status]", err);
    res.status(500).json({ ok: false, message: "Error al obtener estado de suscripción" });
  }
});

// ─── POST /billing/create-checkout ───────────────────────────────────────────
// Creates a MercadoPago preapproval (subscription) and returns the checkout URL
router.post("/create-checkout", auth, attachTenantScope, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ ok: false, message: "Plan inválido" });

    const companyId = req.tenantCompanyId;
    const frontendUrl = process.env.FRONTEND_URL || "https://app.zentor.com.ar";
    const planDef = PLANS[plan];

    const payload = {
      reason:           planDef.label,
      auto_recurring: {
        frequency:      planDef.frequency,
        frequency_type: planDef.frequencyType,
        transaction_amount: planDef.price / 100, // MP uses float ARS
        currency_id:    planDef.currency,
      },
      back_url:         `${frontendUrl}?billing_return=1`,
      external_reference: String(companyId),
      status:           "pending",
    };

    const data = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Upsert subscription record
    await Subscription.findOneAndUpdate(
      { companyId, mpPreapprovalId: data.id },
      { companyId, plan, status: "pending", mpPreapprovalId: data.id },
      { upsert: true, new: true }
    );

    res.json({ ok: true, checkoutUrl: data.init_point, preapprovalId: data.id });
  } catch (err) {
    console.error("[billing/create-checkout]", err);
    res.status(500).json({ ok: false, message: err.message || "Error al crear suscripción" });
  }
});

// ─── POST /billing/cancel ─────────────────────────────────────────────────────
// Cancels the active subscription in MP and locally
router.post("/cancel", auth, attachTenantScope, async (req, res) => {
  try {
    const companyId = req.tenantCompanyId;
    const sub = await Subscription.findOne({ companyId, status: "authorized" }).sort({ createdAt: -1 });
    if (!sub) return res.status(404).json({ ok: false, message: "No hay suscripción activa" });

    if (sub.mpPreapprovalId) {
      await mpFetch(`/preapproval/${sub.mpPreapprovalId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      }).catch(err => console.warn("[billing/cancel] MP cancel failed", err.message));
    }

    sub.status = "cancelled";
    sub.cancelledAt = new Date();
    sub.cancelReason = req.body.reason || "user_request";
    await sub.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[billing/cancel]", err);
    res.status(500).json({ ok: false, message: "Error al cancelar suscripción" });
  }
});

// ─── POST /billing/webhook ────────────────────────────────────────────────────
// Receives MercadoPago payment notifications (IPN / webhooks)
// Configure this URL in MP: https://api.zentor.com.ar/billing/webhook
router.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    // Acknowledge immediately to avoid MP retries
    res.json({ ok: true });

    if (type !== "subscription_preapproval" && type !== "payment") return;

    const resourceId = data?.id;
    if (!resourceId) return;

    let preapprovalId, mpStatus, payerId, payerEmail, nextPaymentDate, transactionAmount;

    if (type === "subscription_preapproval") {
      const detail = await mpFetch(`/preapproval/${resourceId}`);
      preapprovalId   = detail.id;
      mpStatus        = detail.status;
      payerId         = detail.payer_id;
      payerEmail      = detail.payer_email;
      nextPaymentDate = detail.next_payment_date ? new Date(detail.next_payment_date) : null;
      transactionAmount = detail.auto_recurring?.transaction_amount;
    } else if (type === "payment") {
      const payment = await mpFetch(`/v1/payments/${resourceId}`);
      if (payment.payment_type_id !== "recurring") return;
      preapprovalId   = payment.preapproval_id;
      mpStatus        = payment.status === "approved" ? "authorized" : payment.status;
      payerEmail      = payment.payer?.email;
      transactionAmount = payment.transaction_amount;
      if (payment.status === "approved") {
        nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (!preapprovalId) return;

    const sub = await Subscription.findOne({ mpPreapprovalId: preapprovalId });
    if (!sub) return;

    const statusMap = { authorized: "authorized", paused: "paused", cancelled: "cancelled", pending: "pending" };
    sub.status = statusMap[mpStatus] || sub.status;
    if (payerId) sub.mpPayerId = payerId;
    if (payerEmail) sub.mpPayerEmail = payerEmail;
    if (nextPaymentDate) sub.nextPaymentDate = nextPaymentDate;
    if (transactionAmount) {
      sub.lastPaymentAmount = transactionAmount;
      sub.lastPaymentDate   = new Date();
      sub.billingCycleStart = new Date();
      sub.billingCycleEnd   = nextPaymentDate;
    }
    await sub.save();

    // Update company plan when payment confirmed
    if (sub.status === "authorized") {
      const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000); // +32 days buffer
      await Company.findByIdAndUpdate(sub.companyId, {
        plan: sub.plan,
        planExpiresAt: expiresAt,
      });
    }

    // Cancel = revert to base
    if (sub.status === "cancelled") {
      await Company.findByIdAndUpdate(sub.companyId, { plan: "base", planExpiresAt: null });
    }
  } catch (err) {
    console.error("[billing/webhook]", err);
  }
});

export default router;
