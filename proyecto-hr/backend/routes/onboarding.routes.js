import express from "express";
import CompanySetting from "../models/CompanySetting.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

export const ONBOARDING_STEPS = [
  {
    key: "configure_organization",
    label: "Configurar organizacion",
    description: "Define datos basicos, identidad y parametros generales.",
    actionKey: "settings",
  },
  {
    key: "download_template",
    label: "Descargar plantilla",
    description: "Descarga la plantilla oficial para preparar la carga inicial.",
    actionKey: "carga-masiva",
  },
  {
    key: "import_employees",
    label: "Cargar empleados",
    description: "Sube y confirma la plantilla con las personas de la organizacion.",
    actionKey: "carga-masiva",
  },
  {
    key: "review_roles",
    label: "Revisar roles",
    description: "Asegura que cada perfil tenga el alcance correcto.",
    actionKey: "roles",
  },
  {
    key: "configure_kpis_okrs",
    label: "Configurar KPIs/OKRs",
    description: "Prepara indicadores y objetivos visibles en la operacion.",
    actionKey: "metricas",
  },
  {
    key: "create_cycle",
    label: "Crear ciclo",
    description: "Abre el primer periodo de evaluacion para la organizacion.",
    actionKey: "ciclos",
  },
  {
    key: "launch_evaluation",
    label: "Lanzar evaluacion",
    description: "Pon en marcha evaluaciones y seguimiento del equipo.",
    actionKey: "evaluaciones",
  },
  {
    key: "view_executive_report",
    label: "Ver reporte ejecutivo",
    description: "Revisa el estado del ciclo, personas y planes en una sola vista.",
    actionKey: "reporte-ejecutivo",
  },
];

const ONBOARDING_WRITE_PERMISSIONS = [
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_EMPLOYEES,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_SCHOOL_USERS,
];

function sanitizeSteps(rawSteps = {}) {
  const source = rawSteps && typeof rawSteps === "object" ? rawSteps : {};
  const normalized = {};

  for (const step of ONBOARDING_STEPS) {
    const current = source[step.key] || {};
    normalized[step.key] = {
      completedAt: current.completedAt || null,
      updatedAt: current.updatedAt || null,
      updatedBy: current.updatedBy || null,
    };
  }

  return normalized;
}

export function buildOnboardingStatusPayload(setting) {
  const onboarding = setting?.onboarding || {};
  const stepsState = sanitizeSteps(onboarding.steps);

  const steps = ONBOARDING_STEPS.map((step) => {
    const current = stepsState[step.key] || {};
    return {
      key: step.key,
      label: step.label,
      description: step.description,
      actionKey: step.actionKey,
      completed: Boolean(current.completedAt),
      completedAt: current.completedAt || null,
      updatedAt: current.updatedAt || null,
      updatedBy: current.updatedBy || null,
    };
  });

  const completedCount = steps.filter((step) => step.completed).length;

  return {
    steps,
    progress: {
      completed: completedCount,
      total: steps.length,
      pending: steps.length - completedCount,
    },
    completedAll: completedCount === steps.length,
    updatedAt: onboarding.updatedAt || null,
    schoolId: onboarding.schoolId || null,
  };
}

export function applyOnboardingStepTransition({ currentSteps = {}, stepKey, mode, userId }) {
  const steps = sanitizeSteps(currentSteps);
  const now = new Date();

  if (!ONBOARDING_STEPS.some((step) => step.key === stepKey)) {
    const error = new Error("Paso de onboarding invalido");
    error.status = 400;
    throw error;
  }

  if (mode === "complete") {
    steps[stepKey] = {
      completedAt: now,
      updatedAt: now,
      updatedBy: userId || null,
    };
    return steps;
  }

  if (mode === "reopen") {
    steps[stepKey] = {
      completedAt: null,
      updatedAt: now,
      updatedBy: userId || null,
    };
    return steps;
  }

  const error = new Error("Transicion de onboarding invalida");
  error.status = 400;
  throw error;
}

async function resolveOnboardingSetting(req) {
  const { companyId } = await resolveCompanyScope(req);
  const setting = await CompanySetting.findOne({ companyId });
  return {
    companyId,
    setting,
  };
}

router.get(
  "/status",
  auth,
  attachTenantScope,
  requireAnyPermission(...ONBOARDING_WRITE_PERMISSIONS),
  async (req, res) => {
    const { companyId, setting } = await resolveOnboardingSetting(req);
    const payload = buildOnboardingStatusPayload(setting);

    res.json({
      ok: true,
      companyId,
      ...payload,
    });
  }
);

router.post(
  "/steps/:stepKey/complete",
  auth,
  attachTenantScope,
  requireAnyPermission(...ONBOARDING_WRITE_PERMISSIONS),
  async (req, res) => {
    const { companyId, setting } = await resolveOnboardingSetting(req);
    const steps = applyOnboardingStepTransition({
      currentSteps: setting?.onboarding?.steps,
      stepKey: req.params.stepKey,
      mode: "complete",
      userId: req.user.userId || req.user._id || null,
    });

    const updated = await CompanySetting.findOneAndUpdate(
      { companyId },
      {
        $set: {
          companyId,
          "onboarding.schoolId": req.scope.schoolId || null,
          "onboarding.steps": steps,
          "onboarding.updatedBy": req.user.userId || req.user._id || null,
          "onboarding.updatedAt": new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await logAudit({
      companyId,
      schoolId: req.scope.schoolId || null,
      userId: req.user.userId || req.user._id || null,
      accion: "update",
      modulo: "onboarding",
      detalle: `Se completo el paso ${req.params.stepKey}`,
    });

    res.json({
      ok: true,
      message: "Paso marcado como completado.",
      ...buildOnboardingStatusPayload(updated),
    });
  }
);

router.post(
  "/steps/:stepKey/reopen",
  auth,
  attachTenantScope,
  requireAnyPermission(...ONBOARDING_WRITE_PERMISSIONS),
  async (req, res) => {
    const { companyId, setting } = await resolveOnboardingSetting(req);
    const steps = applyOnboardingStepTransition({
      currentSteps: setting?.onboarding?.steps,
      stepKey: req.params.stepKey,
      mode: "reopen",
      userId: req.user.userId || req.user._id || null,
    });

    const updated = await CompanySetting.findOneAndUpdate(
      { companyId },
      {
        $set: {
          companyId,
          "onboarding.schoolId": req.scope.schoolId || null,
          "onboarding.steps": steps,
          "onboarding.updatedBy": req.user.userId || req.user._id || null,
          "onboarding.updatedAt": new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await logAudit({
      companyId,
      schoolId: req.scope.schoolId || null,
      userId: req.user.userId || req.user._id || null,
      accion: "update",
      modulo: "onboarding",
      detalle: `Se reabrio el paso ${req.params.stepKey}`,
    });

    res.json({
      ok: true,
      message: "Paso reabierto.",
      ...buildOnboardingStatusPayload(updated),
    });
  }
);

export default router;
