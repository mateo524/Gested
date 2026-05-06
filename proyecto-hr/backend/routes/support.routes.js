import express from "express";
import { auth } from "../middleware/auth.js";

const router = express.Router();

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

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "performia-support",
    timestamp: new Date().toISOString(),
  });
});

router.post("/chat", async (req, res) => {
  const question = String(req.body?.message || "").trim();
  const context = req.body?.context || "public-web";

  if (!question) {
    return res.status(400).json({ mensaje: "Debes enviar message" });
  }

  const matched = classify(question);
  const baseResponse = matched
    ? matched.answer
    : "Te ayudo con eso. Si me decis el modulo (Gestion, Evaluacion, Cargas y descargas o Usuarios), te doy los pasos exactos.";

  res.json({
    ok: true,
    source: "performia-support-rules",
    context,
    answer: baseResponse,
    suggestions: [
      "Como recupero mi contrasena?",
      "Como importo un Excel?",
      "Que rol necesito para descargar reportes?",
    ],
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

export default router;
