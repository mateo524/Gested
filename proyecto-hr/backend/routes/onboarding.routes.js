import express from "express";
import CompanySetting from "../models/CompanySetting.js";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
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

const DEMO_EMPLOYEES = [
  { nombre: "Laura", apellido: "Gomez", cargo: "Docente", area: "Primaria", tipoEmpleado: "DOCENTE" },
  { nombre: "Martin", apellido: "Perez", cargo: "Coordinador", area: "Secundaria", tipoEmpleado: "DIRECTIVO" },
  { nombre: "Sofia", apellido: "Lopez", cargo: "Profesora", area: "Matematica", tipoEmpleado: "DOCENTE" },
  { nombre: "Carlos", apellido: "Rodriguez", cargo: "Jefe de Area", area: "Ciencias", tipoEmpleado: "DIRECTIVO" },
  { nombre: "Ana", apellido: "Martinez", cargo: "Administrativa", area: "Gestion", tipoEmpleado: "NO_DOCENTE" },
];

const DEMO_COMPETENCIES = [
  { nombre: "Comunicacion efectiva", descripcion: "Capacidad para transmitir ideas con claridad.", tipo: "TRANSVERSAL", componente: "H" },
  { nombre: "Trabajo en equipo", descripcion: "Colaboracion y apoyo mutuo entre colegas.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Planificacion pedagogica", descripcion: "Diseno de clases y contenidos con objetivos claros.", tipo: "DOCENTE", componente: "C" },
  { nombre: "Liderazgo institucional", descripcion: "Capacidad para guiar equipos hacia metas comunes.", tipo: "LIDERAZGO", componente: "A" },
];

router.post(
  "/seed-demo",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_EMPLOYEES, PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    const schoolId = req.scope.schoolId || null;

    const existingCount = await Employee.countDocuments({ companyId });
    if (existingCount > 0) {
      const error = new Error("La organizacion ya tiene empleados cargados. Los datos de demo solo se cargan en organizaciones vacias.");
      error.status = 409;
      throw error;
    }

    const employees = await Employee.insertMany(
      DEMO_EMPLOYEES.map((emp) => ({ ...emp, companyId, schoolId: schoolId || undefined }))
    );

    const competencies = await Competency.insertMany(
      DEMO_COMPETENCIES.map((comp) => ({ ...comp, companyId, schoolId, activa: true }))
    );

    const now = new Date();
    const cycle = await EvaluationCycle.create({
      companyId,
      schoolId,
      anio: now.getFullYear(),
      periodo: "Demo",
      etapa: "INICIO",
      estado: "BORRADOR",
      fechaInicio: now,
      fechaFin: new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()),
    });

    await logAudit({
      companyId,
      schoolId,
      userId: req.user.userId || req.user._id || null,
      accion: "create",
      modulo: "onboarding",
      detalle: `Datos de demo sembrados: ${employees.length} empleados, ${competencies.length} competencias, 1 ciclo`,
    });

    res.status(201).json({
      ok: true,
      message: "Datos de demo cargados correctamente.",
      seeded: {
        employees: employees.length,
        competencies: competencies.length,
        cycles: 1,
      },
    });
  }
);

export default router;
