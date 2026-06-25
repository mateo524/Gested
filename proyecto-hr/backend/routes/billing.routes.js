/**
 * Billing routes — MercadoPago Preapproval (subscriptions)
 *
 * Required env vars:
 *   MP_ACCESS_TOKEN  — MercadoPago Access Token (from MP credentials page)
 *   FRONTEND_URL     — e.g. https://app.zentor.com.ar
 *
 * Pricing model:
 *   Single plan. Price = employeeCount × PRICE_PER_EMPLOYEE_ARS (per month).
 *   Minimum: MIN_EMPLOYEES employees billed.
 *   Price is never shown in the app — only in MercadoPago checkout.
 */

import { Router } from "express";
import Company      from "../models/Company.js";
import Subscription from "../models/Subscription.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";

const router = Router();

const MP_BASE = "https://api.mercadopago.com";

// ~$3 USD/employee — adjust as ARS/USD rate changes
const PRICE_PER_EMPLOYEE_ARS = 3000;  // ARS per employee per month
const MIN_EMPLOYEES = 5;              // minimum billed employees

function calcPrice(employeeCount) {
  const billed = Math.max(employeeCount || 0, MIN_EMPLOYEES);
  return billed * PRICE_PER_EMPLOYEE_ARS;
}

async function mpFetch(path, options = {}) {
  const token = (process.env.MP_ACCESS_TOKEN || "").replace(/^﻿/, "").trim();
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

// ─── GET /billing/status ──────────────────────────────────────────────────────
router.get("/status", auth, attachTenantScope, async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const [company, sub] = await Promise.all([
      Company.findById(companyId).select("plan planExpiresAt nombre").lean(),
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
        status: sub.status,
        employeeCount: sub.employeeCount,
        nextPaymentDate: sub.nextPaymentDate,
        lastPaymentDate: sub.lastPaymentDate,
      } : null,
    });
  } catch (err) {
    console.error("[billing/status]", err);
    res.status(500).json({ ok: false, message: "Error al obtener estado de suscripción" });
  }
});

// ─── POST /billing/create-checkout ───────────────────────────────────────────
// Body: { employeeCount: number, contactName: string, contactEmail: string }
// Creates a MercadoPago preapproval and returns the checkout URL.
// Price is calculated server-side and NOT returned to the client.
router.post("/create-checkout", auth, attachTenantScope, async (req, res) => {
  try {
    const { employeeCount, contactName, contactEmail } = req.body;

    const count = parseInt(employeeCount, 10);
    if (!count || count < 1) return res.status(400).json({ ok: false, message: "Cantidad de empleados inválida" });

    const companyId = req.scope.companyId;
    const frontendUrl = process.env.FRONTEND_URL || "https://app.zentor.com.ar";
    const totalARS = calcPrice(count);

    // Cancel any existing authorized subscription before creating a new one
    const existingSub = await Subscription.findOne({ companyId, status: "authorized" }).sort({ createdAt: -1 });
    if (existingSub?.mpPreapprovalId) {
      await mpFetch(`/preapproval/${existingSub.mpPreapprovalId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      }).catch(err => console.warn("[billing/create-checkout] cancel old sub failed", err.message));
      existingSub.status = "cancelled";
      existingSub.cancelledAt = new Date();
      existingSub.cancelReason = "plan_upgrade";
      await existingSub.save();
    }

    const payload = {
      reason: "Zentor — Gestión de desempeño",
      auto_recurring: {
        frequency:          1,
        frequency_type:     "months",
        transaction_amount: totalARS,
        currency_id:        "ARS",
      },
      back_url:           `${frontendUrl}?billing_return=1`,
      external_reference: String(companyId),
      status:             "pending",
      payer_email:        contactEmail || undefined,
    };

    const data = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    await Subscription.findOneAndUpdate(
      { companyId, mpPreapprovalId: data.id },
      { companyId, plan: "pro", status: "pending", mpPreapprovalId: data.id, employeeCount: count },
      { upsert: true, new: true }
    );

    // Return ONLY the checkout URL — never the price
    res.json({ ok: true, checkoutUrl: data.init_point });
  } catch (err) {
    console.error("[billing/create-checkout]", err);
    res.status(500).json({ ok: false, message: err.message || "Error al crear suscripción" });
  }
});

// ─── POST /billing/cancel ─────────────────────────────────────────────────────
router.post("/cancel", auth, attachTenantScope, async (req, res) => {
  try {
    const companyId = req.scope.companyId;
    const sub = await Subscription.findOne({ companyId, status: "authorized" }).sort({ createdAt: -1 });

    if (sub) {
      // Cancel MercadoPago preapproval — stops future charges, current period remains paid
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
      // Keep planExpiresAt — access continues until end of paid period
      // The webhook or a scheduled job will downgrade when it lapses
    } else {
      // Manual plan — clear immediately (no billing period to respect)
      await Company.findByIdAndUpdate(companyId, { plan: "base", planExpiresAt: null });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[billing/cancel]", err);
    res.status(500).json({ ok: false, message: "Error al cancelar suscripción" });
  }
});

// ─── POST /billing/webhook ────────────────────────────────────────────────────
// Configure in MP: https://api.zentor.com.ar/billing/webhook
router.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;
    res.json({ ok: true }); // acknowledge immediately

    if (type !== "subscription_preapproval" && type !== "payment") return;
    const resourceId = data?.id;
    if (!resourceId) return;

    let preapprovalId, mpStatus, payerEmail, nextPaymentDate, transactionAmount;

    if (type === "subscription_preapproval") {
      const detail = await mpFetch(`/preapproval/${resourceId}`);
      preapprovalId     = detail.id;
      mpStatus          = detail.status;
      payerEmail        = detail.payer_email;
      nextPaymentDate   = detail.next_payment_date ? new Date(detail.next_payment_date) : null;
      transactionAmount = detail.auto_recurring?.transaction_amount;
    } else if (type === "payment") {
      const payment = await mpFetch(`/v1/payments/${resourceId}`);
      if (payment.payment_type_id !== "recurring") return;
      preapprovalId     = payment.preapproval_id;
      mpStatus          = payment.status === "approved" ? "authorized" : payment.status;
      payerEmail        = payment.payer?.email;
      transactionAmount = payment.transaction_amount;
      if (payment.status === "approved") nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    if (!preapprovalId) return;
    const sub = await Subscription.findOne({ mpPreapprovalId: preapprovalId });
    if (!sub) return;

    const statusMap = { authorized: "authorized", paused: "paused", cancelled: "cancelled", pending: "pending" };
    sub.status = statusMap[mpStatus] || sub.status;
    if (payerEmail) sub.mpPayerEmail = payerEmail;
    if (nextPaymentDate) sub.nextPaymentDate = nextPaymentDate;
    if (transactionAmount) {
      sub.lastPaymentAmount = transactionAmount;
      sub.lastPaymentDate   = new Date();
      sub.billingCycleStart = new Date();
      sub.billingCycleEnd   = nextPaymentDate;
    }
    await sub.save();

    if (sub.status === "authorized") {
      const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
      await Company.findByIdAndUpdate(sub.companyId, { plan: "pro", planExpiresAt: expiresAt });
    }
    if (sub.status === "cancelled") {
      await Company.findByIdAndUpdate(sub.companyId, { plan: "base", planExpiresAt: null });
    }
  } catch (err) {
    console.error("[billing/webhook]", err);
  }
});

export default router;
