import express from "express";
import { auth } from "../middleware/auth.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import SupportQueryLog from "../models/SupportQueryLog.js";
import ContactRequest from "../models/ContactRequest.js";
import { sendContactRequestNotification } from "../utils/mailer.js";

const router = express.Router();
const cache = new Map();
const rateStore = new Map();
const CACHE_TTL_MS = Number(process.env.SUPPORT_CACHE_TTL_MS || 1000 * 60 * 2);
const RATE_WINDOW_MS = Number(process.env.SUPPORT_RATE_WINDOW_MS || 1000 * 60);
const RATE_MAX_REQUESTS = Number(process.env.SUPPORT_RATE_MAX_REQUESTS || 20);
export const CONTACT_MESSAGE_MAX_LENGTH = 2000;
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const intents = [
  {
    keywords: ["reset", "contrasena", "password", "olvide", "olvid"],
    answer:
      "Para recuperar acceso: en login toca 'Olvide mi contrasena', coloca tu email y usa el enlace/token recibido. Si no llega correo, contacta al administrador de tu colegio.",
  },
  {
    keywords: ["import", "subir", "excel", "csv", "archivo", "carga"],
    answer:
      "Para importar datos usa Cargas y descargas: Paso 1 Subir archivo, Paso 2 Validar filas, Paso 3 Confirmar importacion. Si hay errores, corrige filas antes de confirmar.",
  },
  {
    keywords: ["rol", "permiso", "acceso", "usuario"],
    answer:
      "Los accesos dependen del rol (Superadmin, Director/Admin Colegio, RRHH, Jefe, Empleado, Lector). Si no ves un modulo, tu rol no tiene ese permiso.",
  },
  {
    keywords: ["descarga", "export", "reporte"],
    answer:
      "Las descargas se habilitan por rol. Si el boton esta deshabilitado, tu perfil no tiene permiso para ese dataset o alcance.",
  },
];

function classify(text) {
  const clean = String(text || "").toLowerCase();
  if (!clean.trim()) return null;
  return intents.find((intent) => intent.keywords.some((word) => clean.includes(word))) || null;
}

function buildContextHint(context) {
  const page = typeof context === "object" ? String(context.page || "") : String(context || "");
  if (page.includes("contacto")) {
    return "Si necesitas implementacion o soporte comercial, usa el formulario de contacto y te respondemos por correo.";
  }
  if (page.includes("demo")) {
    return "En la demo te conviene revisar: roles, importacion guiada y panel de decisiones para ver el flujo completo.";
  }
  return "Si quieres, te guio paso a paso segun la pantalla en la que estas ahora.";
}

function getRateKey(req) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return String(ip);
}

function checkRateLimit(req) {
  const key = getRateKey(req);
  const now = Date.now();
  const hits = (rateStore.get(key) || []).filter((ts) => now - ts <= RATE_WINDOW_MS);
  hits.push(now);
  rateStore.set(key, hits);
  return hits.length <= RATE_MAX_REQUESTS;
}

function getCachedAnswer(question) {
  const key = question.toLowerCase().trim();
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCachedAnswer(question, value) {
  const key = question.toLowerCase().trim();
  cache.set(key, { createdAt: Date.now(), value });
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function sanitizeMetadata(req) {
  return {
    userAgent: String(req.get?.("user-agent") || "").slice(0, 300),
    referer: String(req.get?.("referer") || "").slice(0, 300),
  };
}

export function normalizeContactPayload(body = {}) {
  return {
    name: pickString(body.name, body.nombre),
    email: pickString(body.email).toLowerCase(),
    institution: pickString(body.institution, body.institucion, body.organization),
    role: pickString(body.role, body.rol),
    size: pickString(body.size, body.tamanio),
    message: pickString(body.message, body.mensaje),
    source: pickString(body.source) ? pickString(body.source).toLowerCase() : "landing",
  };
}

export function validateContactPayload(payload) {
  const fieldErrors = {};

  if (!payload.name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }
  if (!payload.email) {
    fieldErrors.email = "El email es obligatorio.";
  } else if (!BASIC_EMAIL_REGEX.test(payload.email)) {
    fieldErrors.email = "Ingresa un email valido.";
  }
  if (payload.message && payload.message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    fieldErrors.message = `El mensaje no puede superar ${CONTACT_MESSAGE_MAX_LENGTH} caracteres.`;
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "performia-support",
    timestamp: new Date().toISOString(),
  });
});

router.post("/contact", async (req, res) => {
  if (!checkRateLimit(req)) {
    return res.status(429).json({
      ok: false,
      message: "Demasiadas solicitudes seguidas. Intenta nuevamente en unos segundos.",
      fieldErrors: {},
    });
  }

  const payload = normalizeContactPayload(req.body || {});
  const validation = validateContactPayload(payload);

  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      message: "Revisa los campos obligatorios antes de enviar la solicitud.",
      fieldErrors: validation.fieldErrors,
    });
  }

  try {
    const contactRequest = await ContactRequest.create({
      ...payload,
      status: "new",
      metadata: sanitizeMetadata(req),
    });

    try {
      await sendContactRequestNotification(contactRequest);
    } catch (_mailError) {
      // La notificacion por mail es opcional; no bloquea la recepcion de la solicitud.
    }

    return res.status(201).json({
      ok: true,
      message: "Solicitud recibida",
    });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      message: "No pudimos registrar la solicitud en este momento.",
      fieldErrors: {},
    });
  }
});

router.post("/chat", async (req, res) => {
  if (!checkRateLimit(req)) {
    return res.status(429).json({
      ok: false,
      mensaje: "Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.",
    });
  }

  const question = String(req.body?.message || "").trim();
  const context = req.body?.context || "public-web";

  if (!question) {
    return res.status(400).json({ mensaje: "Debes enviar message" });
  }

  const cached = getCachedAnswer(question);
  if (cached) {
    return res.json({
      ok: true,
      source: "performia-support-cache",
      context,
      answer: cached.answer,
      suggestions: cached.suggestions,
    });
  }

  const matched = classify(question);
  const baseResponse =
    matched?.answer ||
    "Te ayudo con eso. Si me decis el modulo (Gestion, Evaluacion, Cargas y descargas o Usuarios), te doy los pasos exactos.";
  const intent = matched
    ? matched.keywords[0] || "matched"
    : "unknown";
  const payload = {
    answer: `${baseResponse} ${buildContextHint(context)}`.trim(),
    suggestions: [
      "Como recupero mi contrasena?",
      "Como importo un Excel?",
      "Que rol necesito para descargar reportes?",
    ],
  };
  setCachedAnswer(question, payload);

  await SupportQueryLog.create({
    channel: "web",
    context,
    question,
    answer: baseResponse,
    intent,
    ip: String(req.ip || req.headers["x-forwarded-for"] || ""),
  });

  res.json({
    ok: true,
    source: "performia-support-rules",
    context,
    answer: payload.answer,
    suggestions: payload.suggestions,
  });
});

router.post("/chat/secure", auth, async (req, res) => {
  const question = String(req.body?.message || "").trim();
  if (!question) {
    return res.status(400).json({ mensaje: "Debes enviar message" });
  }
  const matched = classify(question);
  res.json({
    ok: true,
    source: "performia-support-rules-secure",
    user: {
      email: req.user?.email || null,
      roleCode: req.user?.roleCode || null,
      companyId: req.user?.companyId || null,
    },
    answer:
      matched?.answer ||
      "Puedo ayudarte sobre accesos, cargas, evaluaciones y reportes. Decime en que pantalla estas y te guio paso a paso.",
  });
});

router.get(
  "/stats",
  auth,
  requireAnyPermission(PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.VIEW_AUDIT, PERMISSIONS.VIEW_GLOBAL_REPORTS),
  async (req, res) => {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ mensaje: "Solo superadmin puede ver metricas globales de soporte" });
    }

    const days = Math.min(Math.max(Number(req.query.days || 7), 1), 90);
    const from = new Date();
    from.setDate(from.getDate() - days);

    const [total, topIntents, latest] = await Promise.all([
      SupportQueryLog.countDocuments({ createdAt: { $gte: from } }),
      SupportQueryLog.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: "$intent", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      SupportQueryLog.find({ createdAt: { $gte: from } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("question intent context createdAt")
        .lean(),
    ]);

    res.json({
      days,
      total,
      topIntents: topIntents.map((item) => ({ intent: item._id || "unknown", count: item.count })),
      latest,
      cacheSize: cache.size,
      rateLimit: { windowMs: RATE_WINDOW_MS, maxRequests: RATE_MAX_REQUESTS },
    });
  }
);

export default router;
