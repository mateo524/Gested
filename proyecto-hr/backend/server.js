import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

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
import { ensureInitialAccess } from "./utils/bootstrap.js";
import { buildHealthStatus } from "./utils/health.js";

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
    String(process.env.ALLOW_VERCEL_PREVIEWS || "true").toLowerCase() !== "false";

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
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("CORS: origen no permitido"));
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

  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres en producción.");
  }
}

app.use(cors(buildCorsOptions()));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  compression({
    threshold: "1kb",
    level: 6,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

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

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error("Unhandled error:", err);
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

    const { credentials } = await ensureInitialAccess();
    if (credentials?.email) {
      console.log(`Admin inicial listo: ${credentials.email}`);
    } else {
      console.log("Admin inicial no auto-creado (seed deshabilitado o no configurado)");
    }

    app.listen(process.env.PORT || 3000, () => {
      console.log(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
    });
  } catch (err) {
    console.log("Error MongoDB:", err);
    process.exit(1);
  }
}

start();
