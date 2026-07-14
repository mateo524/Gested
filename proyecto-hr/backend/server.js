import "dotenv/config";
import "./instrument.js";
import { Sentry } from "./instrument.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import { auth } from "./middleware/auth.js";
import { attachTenantScope } from "./middleware/tenantScope.js";
import { requirePlan } from "./middleware/requirePlan.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import companiesRoutes from "./routes/companies.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import exportRoutes from "./routes/export.routes.js";
import recordsRoutes from "./routes/records.routes.js";
import storageRoutes from "./routes/storage.routes.js";
import announcementsRoutes from "./routes/announcements.routes.js";
import searchRoutes from "./routes/search.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import competenciesRoutes from "./routes/competencies.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import schoolsRoutes from "./routes/schools.routes.js";
import evaluationCyclesRoutes from "./routes/evaluationCycles.routes.js";
import evaluationsRoutes from "./routes/evaluations.routes.js";
import educationExportsRoutes from "./routes/educationExports.routes.js";
import developmentPlansRoutes from "./routes/developmentPlans.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import supportRoutes from "./routes/support.routes.js";
import bulkImportRoutes from "./routes/bulkImport.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import linkedinRoutes from "./routes/linkedin.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import notificationsFeedRoutes from "./routes/notifications-feed.routes.js";
import calendlyRoutes from "./routes/calendly.routes.js";
import webhooksConfigRoutes from "./routes/webhooks-config.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import dripRoutes from "./routes/drip.routes.js";
import twoFactorRoutes from "./routes/twoFactor.routes.js";
import pdfExportRoutes from "./routes/pdfExport.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import excelSyncRoutes from "./routes/excelSync.routes.js";
import { startSyncPoller } from "./services/syncPoller.js";
import { ensureInitialAccess } from "./utils/bootstrap.js";
import { ensureIndexes } from "./utils/ensureIndexes.js";
import { buildHealthStatus } from "./utils/health.js";
import { logger } from "./utils/logger.js";

const app = express();
app.set("trust proxy", 1);

function buildAllowedOrigins() {
  const fromList = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fromCorsOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fromSingle = String(process.env.FRONTEND_URL || "").trim();
  const allowed = new Set([...fromList, ...fromCorsOrigins]);
  if (fromSingle) allowed.add(fromSingle);

  // Dominio de produccion conocido: siempre permitido, sin depender de que las
  // variables de entorno de Cloud Run esten replicadas en Vercel (la funcion
  // serverless de Vercel corre bajo el mismo dominio pero con su propio env).
  allowed.add("https://app.zentor.com.ar");

  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:5173");
    allowed.add("http://localhost:3000");
  }

  return allowed;
}

function buildCorsOptions() {
  const allowedOrigins = buildAllowedOrigins();
  const allowVercelPreview =
    process.env.NODE_ENV === "production" &&
    String(process.env.ALLOW_VERCEL_PREVIEWS || "false").toLowerCase() !== "false";

  function isAllowedOrigin(origin) {
    if (allowedOrigins.has(origin)) return true;
    if (!allowVercelPreview) return false;

    try {
      const parsed = new URL(origin);
      return parsed.hostname.endsWith(".vercel.app");
    } catch {
      return false;
    }
  }

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      // No permitido: se resuelve sin CORS headers (rechazo limpio en el
      // browser) en vez de lanzar un error que el handler global convierte
      // en 500 y tumba requests legitimos por un origen mal configurado.
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  };
}

function assertRuntimeConfig() {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Falta JWT_SECRET");
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres en todos los entornos.");
  }
}

// En Vercel el modulo se importa dentro de una funcion serverless: no hay
// proceso long-running que llame a start(), asi que la conexion a Mongo se
// abre (y cachea) en el primer request en vez de al levantar un servidor.
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    try {
      assertRuntimeConfig();
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGO_URI);
      }
      next();
    } catch (err) {
      console.error("Error de conexion a MongoDB (serverless):", err);
      res.status(503).json({ mensaje: "Servicio no disponible temporalmente" });
    }
  });
} else {
  // Cloud Run congela la instancia (y sus timers, incluido el heartbeat del
  // driver de Mongo) entre requests cuando no hay trafico. Al despertar, la
  // conexion abierta en start() puede seguir marcada como "connected"
  // (readyState 1) pero apuntar a topologia vieja (p.ej. una reeleccion del
  // replica set ocurrida mientras el proceso estaba pausado), lo que produce
  // errores "not primary" en el primer request. Un ping activo detecta esto
  // y fuerza una reconexion antes de servir el request.
  app.use(async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGO_URI);
      } else {
        try {
          await mongoose.connection.db.admin().command({ ping: 1 });
        } catch {
          await mongoose.connection.close().catch(() => {});
          await mongoose.connect(process.env.MONGO_URI);
        }
      }
      next();
    } catch (err) {
      console.error("Error de reconexion a MongoDB:", err);
      res.status(503).json({ mensaje: "Servicio no disponible temporalmente" });
    }
  });
}

app.use(cors(buildCorsOptions()));
app.use(cookieParser());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  compression({
    threshold: "1kb",
    level: 6,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Request timeout — prevents slow-loris and hung DB connections from tying up workers.
// Bulk import confirms process one DB round-trip per row sequentially, so a
// medium-sized spreadsheet can legitimately take longer than the default.
const LONG_RUNNING_PATHS = [
  /^\/bulk-import\/simple\/.+\/confirm$/,
  /^\/bulk-import\/simple\/.+\/analyze$/,
  /^\/bulk-import\/import$/,
];
app.use((req, res, next) => {
  const isLongRunning = LONG_RUNNING_PATHS.some((re) => re.test(req.path));
  const TIMEOUT_MS = isLongRunning ? 120_000 : 30_000;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ mensaje: "La solicitud tardó demasiado. Reintentá en un momento." });
    }
  }, TIMEOUT_MS);
  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: {
    mensaje: "Demasiadas solicitudes. Intenta nuevamente en unos minutos.",
  },
  skip: (req) => req.path === "/health" && req.method === "GET",
});

app.use(generalLimiter);

// Per-user rate limiter — applied only to authenticated routes
// Stricter than IP limiter: prevents a single account from hammering the API
const perUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 150,                  // 150 req per user per 15min (vs 300 by IP)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?._id || req.user?.userId;
    return userId ? `user:${userId}` : ipKeyGenerator(req);
  },
  message: { mensaje: "Demasiadas solicitudes desde esta cuenta. Intentá en unos minutos." },
  skip: (req) => {
    // Skip for unauthenticated routes and health check
    if (req.path === "/health") return true;
    if (req.path.startsWith("/auth/login")) return false; // apply to login (brute force)
    return false;
  },
});

app.use(perUserLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { mensaje: "Demasiados intentos de login. Esperá 15 minutos." },
});
app.use("/auth/login", authLimiter);

// Heavy endpoints limiter — bulk imports and report generation are CPU/DB intensive
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?._id || req.user?.userId;
    return userId ? `user:${userId}` : ipKeyGenerator(req);
  },
  message: { mensaje: "Demasiadas operaciones pesadas. Esperá un minuto antes de continuar." },
});
app.use("/bulk-import", heavyLimiter);
app.use("/reports/export-excel", heavyLimiter);
app.use("/education-exports", heavyLimiter);

function isObject(val) {
  return typeof val === "object" && val !== null;
}

function sanitizeObject(obj) {
  if (!isObject(obj)) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const clean = key.replace(/^\$/, "").replace(/\./g, "");
    if (clean !== key) {
      sanitized[clean] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

function safeAssign(obj, prop, value) {
  try {
    obj[prop] = value;
  } catch {
    Object.defineProperty(obj, prop, {
      value,
      writable: true,
      configurable: true,
    });
  }
}

app.use((req, _res, next) => {
  if (req.body && isObject(req.body)) {
    safeAssign(req, "body", sanitizeObject(req.body));
  }
  if (req.params && isObject(req.params)) {
    safeAssign(req, "params", sanitizeObject(req.params));
  }
  if (req.query && isObject(req.query)) {
    safeAssign(req, "query", sanitizeObject(req.query));
  }
  next();
});

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

app.use("/auth", authRoutes);
app.use("/auth/2fa", twoFactorRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/companies", companiesRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/audit", auditRoutes);
app.use("/settings", settingsRoutes);
app.use("/export", exportRoutes);
const proPlan = [auth, attachTenantScope, requirePlan("pro")];
app.use("/pdf-export", proPlan, pdfExportRoutes);
app.use("/records", recordsRoutes);
app.use("/storage", storageRoutes);
app.use("/announcements", announcementsRoutes);
app.use("/search", searchRoutes);
app.use("/employees", employeesRoutes);
app.use("/competencies", competenciesRoutes);
app.use("/metrics", proPlan, metricsRoutes);
app.use("/schools", schoolsRoutes);
app.use("/evaluation-cycles", evaluationCyclesRoutes);
app.use("/evaluations", evaluationsRoutes);
app.use("/education-exports", educationExportsRoutes);
app.use("/development-plans", proPlan, developmentPlansRoutes);
app.use("/automation", automationRoutes);
app.use("/support", supportRoutes);
app.use("/bulk-import", bulkImportRoutes);
app.use("/reports", proPlan, reportsRoutes);
app.use("/onboarding", onboardingRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/notifications-feed", notificationsFeedRoutes);
app.use("/webhooks", calendlyRoutes);
app.use("/webhooks-config", webhooksConfigRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/drip", dripRoutes);
app.use("/billing", billingRoutes);
app.use("/excel-sync", excelSyncRoutes);

// Request logging — emits one structured log line per completed request.
// Skips /health to avoid noise in Cloud Logging dashboards.
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

app.get("/health", (_req, res) => {
  const payload = buildHealthStatus("zentor-backend", {
    databaseReadyState: mongoose.connection?.readyState,
    nodeEnv: process.env.NODE_ENV || "development",
  });

  res.status(payload.ok ? 200 : 503).json(payload);
});

app.get("/", (req, res) => {
  res.send("API RRHH PRO funcionando");
});

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error("Unhandled error", { message: err.message, stack: err.stack, status });
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { status, path: req.path, method: req.method } });
    }
  }

  if (status >= 500 && process.env.NODE_ENV === "production") {
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }

  res.status(status).json({
    mensaje: err.mensaje || err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

async function start() {
  try {
    assertRuntimeConfig();
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectado");
    await ensureIndexes();

    const { credentials } = await ensureInitialAccess();
    if (credentials?.email) {
      console.log(`Admin inicial listo: ${credentials.email}`);
    } else {
      console.log("Admin inicial no auto-creado (seed deshabilitado o no configurado)");
    }

    app.listen(process.env.PORT || 3000, () => {
      console.log(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
    });

    startSyncPoller();
  } catch (err) {
    console.log("Error MongoDB:", err);
    process.exit(1);
  }
}

// En Vercel no hay proceso long-running: app.listen()/startSyncPoller() no
// tienen sentido ahi y assertRuntimeConfig() ya se resuelve por request arriba.
if (!process.env.VERCEL) {
  start();
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

export { app };
