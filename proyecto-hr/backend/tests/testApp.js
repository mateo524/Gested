/**
 * testApp.js — Builds the Express app for testing without starting the HTTP
 * server or connecting to MongoDB.  All middleware and routes mirror server.js
 * exactly; the only things omitted are `mongoose.connect()` and `app.listen()`.
 *
 * Usage:
 *   import { app } from "./testApp.js";
 *   import request from "supertest";
 *   const res = await request(app).get("/health");
 */

// Load env so JWT_SECRET, etc. are available (won't throw if .env is absent)
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "../routes/auth.routes.js";
import dashboardRoutes from "../routes/dashboard.routes.js";
import companiesRoutes from "../routes/companies.routes.js";
import usersRoutes from "../routes/users.routes.js";
import rolesRoutes from "../routes/roles.routes.js";
import auditRoutes from "../routes/audit.routes.js";
import settingsRoutes from "../routes/settings.routes.js";
import exportRoutes from "../routes/export.routes.js";
import recordsRoutes from "../routes/records.routes.js";
import storageRoutes from "../routes/storage.routes.js";
import announcementsRoutes from "../routes/announcements.routes.js";
import searchRoutes from "../routes/search.routes.js";
import employeesRoutes from "../routes/employees.routes.js";
import competenciesRoutes from "../routes/competencies.routes.js";
import metricsRoutes from "../routes/metrics.routes.js";
import schoolsRoutes from "../routes/schools.routes.js";
import evaluationCyclesRoutes from "../routes/evaluationCycles.routes.js";
import evaluationsRoutes from "../routes/evaluations.routes.js";
import educationExportsRoutes from "../routes/educationExports.routes.js";
import developmentPlansRoutes from "../routes/developmentPlans.routes.js";
import automationRoutes from "../routes/automation.routes.js";
import supportRoutes from "../routes/support.routes.js";
import bulkImportRoutes from "../routes/bulkImport.routes.js";
import reportsRoutes from "../routes/reports.routes.js";
import onboardingRoutes from "../routes/onboarding.routes.js";
import linkedinRoutes from "../routes/linkedin.routes.js";
import notificationsRoutes from "../routes/notifications.routes.js";
import notificationsFeedRoutes from "../routes/notifications-feed.routes.js";
import calendlyRoutes from "../routes/calendly.routes.js";
import webhooksConfigRoutes from "../routes/webhooks-config.routes.js";
import analyticsRoutes from "../routes/analytics.routes.js";
import dripRoutes from "../routes/drip.routes.js";
import { buildHealthStatus } from "../utils/health.js";
import { logger } from "../utils/logger.js";

// Provide a fallback JWT_SECRET so jwt.verify doesn't throw on startup
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-for-vitest-do-not-use-in-prod";
}

const app = express();
app.set("trust proxy", 1);

// ── CORS (permissive in test) ────────────────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ── Security / compression / body parsing ───────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression({ threshold: "1kb", level: 6 }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── General rate-limiter (same as server.js) ────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    mensaje: "Demasiadas solicitudes. Intenta nuevamente en unos minutos.",
  },
  skip: (req) => req.path === "/health" && req.method === "GET",
});
app.use(generalLimiter);

// ── NoSQL-injection sanitizer ────────────────────────────────────────────────
function isObject(val) {
  return typeof val === "object" && val !== null;
}
function sanitizeObject(obj) {
  if (!isObject(obj)) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const clean = key.replace(/^\$/, "").replace(/\./g, "");
    sanitized[clean !== key ? clean : key] = sanitizeObject(obj[key]);
  }
  return sanitized;
}
function safeAssign(obj, prop, value) {
  try {
    obj[prop] = value;
  } catch {
    Object.defineProperty(obj, prop, { value, writable: true, configurable: true });
  }
}
app.use((req, _res, next) => {
  if (req.body && isObject(req.body)) safeAssign(req, "body", sanitizeObject(req.body));
  if (req.params && isObject(req.params)) safeAssign(req, "params", sanitizeObject(req.params));
  if (req.query && isObject(req.query)) safeAssign(req, "query", sanitizeObject(req.query));
  next();
});

// ── Cache-control headers ────────────────────────────────────────────────────
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();
  if (req.path.startsWith("/auth")) {
    res.setHeader("Cache-Control", "no-store");
    return next();
  }
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("Vary", "Authorization, X-Company-Id");
  return next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/companies", companiesRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/audit", auditRoutes);
app.use("/settings", settingsRoutes);
app.use("/export", exportRoutes);
app.use("/records", recordsRoutes);
app.use("/storage", storageRoutes);
app.use("/announcements", announcementsRoutes);
app.use("/search", searchRoutes);
app.use("/employees", employeesRoutes);
app.use("/competencies", competenciesRoutes);
app.use("/metrics", metricsRoutes);
app.use("/schools", schoolsRoutes);
app.use("/evaluation-cycles", evaluationCyclesRoutes);
app.use("/evaluations", evaluationsRoutes);
app.use("/education-exports", educationExportsRoutes);
app.use("/development-plans", developmentPlansRoutes);
app.use("/automation", automationRoutes);
app.use("/support", supportRoutes);
app.use("/bulk-import", bulkImportRoutes);
app.use("/reports", reportsRoutes);
app.use("/onboarding", onboardingRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/notifications-feed", notificationsFeedRoutes);
app.use("/webhooks", calendlyRoutes);
app.use("/webhooks-config", webhooksConfigRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/drip", dripRoutes);

// ── Request logger (skip /health) ───────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

// ── Health endpoint ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  const payload = buildHealthStatus("zentor-backend", {
    databaseReadyState: mongoose.connection?.readyState,
    nodeEnv: process.env.NODE_ENV || "development",
  });
  res.status(payload.ok ? 200 : 503).json(payload);
});

app.get("/", (_req, res) => {
  res.send("API RRHH PRO funcionando");
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error("Unhandled error", { message: err.message, stack: err.stack, status });
  }
  if (status >= 500 && process.env.NODE_ENV === "production") {
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
  res.status(status).json({
    mensaje: err.mensaje || err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export { app };
