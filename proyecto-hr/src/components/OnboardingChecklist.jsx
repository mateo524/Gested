import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { isAdminOrgUser } from "../lib/roleHelpers";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS_CONFIG = [
  {
    key: "employees",
    icon: "👥",
    title: "Cargá a tu equipo",
    desc: "Agregá los empleados de tu organización. Podés importarlos desde Excel.",
    actionLabel: "Ir a Personas",
    targetView: "empleados",
  },
  {
    key: "competencies",
    icon: "🎯",
    title: "Definí las competencias",
    desc: "Creá las competencias o indicadores que vas a evaluar en tu equipo.",
    actionLabel: "Ir a Competencias",
    targetView: "competencias",
  },
  {
    key: "cycles",
    icon: "🔄",
    title: "Creá un ciclo de evaluación",
    desc: "Configurá el período de evaluación: fechas de inicio y cierre.",
    actionLabel: "Crear ciclo",
    targetView: "ciclos",
  },
  {
    key: "evaluations",
    icon: "📝",
    title: "Asigná las primeras evaluaciones",
    desc: "Iniciá el proceso de evaluación asignando a los responsables.",
    actionLabel: "Ir a Evaluaciones",
    targetView: "evaluaciones",
  },
  {
    key: "report",
    icon: "📊",
    title: "Revisá el reporte ejecutivo",
    desc: "Cuando haya datos, el reporte ejecutivo te muestra el estado de todo el equipo.",
    actionLabel: "Ver reporte",
    targetView: "reporte-ejecutivo",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(companyId) {
  return `zentor_onboarding_v2_${companyId || "default"}`;
}

function loadStoredState(companyId) {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredState(companyId, state) {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function buildInitialSteps() {
  return STEPS_CONFIG.map((s) => ({ key: s.key, done: false }));
}

function computeDone(key, data) {
  const { employees, competencies, cycles, evaluations } = data;
  switch (key) {
    case "employees":
      return employees.length > 0;
    case "competencies":
      return competencies.length > 0;
    case "cycles":
      return cycles.length > 0;
    case "evaluations":
      return evaluations.length > 0;
    case "report":
      return evaluations.filter((e) => e.estado === "CERRADA").length > 0;
    default:
      return false;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ completed, total }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">
          {completed} de {total} completados
        </span>
        <span className="rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#14b8a6]">
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#38bdf8] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepCheckbox({ done, isActive }) {
  if (done) {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 transition-all duration-300"
        aria-label="Completado"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5 text-emerald-300">
          <path d="M3 8l3.5 3.5L13 5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
        isActive ? "border-[#14b8a6]/60 bg-[#14b8a6]/10" : "border-white/15 bg-white/3"
      }`}
      aria-label="Pendiente"
    />
  );
}

function SkeletonStep() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-start gap-3">
        <div className="skeleton h-7 w-7 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-64 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingChecklist() {
  const { token, user, activeCompanyId } = useAuth();
  const { setView } = useView();

  // Only show for org-admin users
  const isOrgAdmin = isAdminOrgUser(user) && !user?.isSuperAdmin;
  if (!isOrgAdmin) return null;

  return <OnboardingChecklistInner token={token} user={user} activeCompanyId={activeCompanyId} setView={setView} />;
}

function OnboardingChecklistInner({ token, user, activeCompanyId, setView }) {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [steps, setSteps] = useState(() => {
    const stored = loadStoredState(activeCompanyId);
    return stored?.steps || buildInitialSteps();
  });

  // Check dismissed flag from storage on mount / company change
  useEffect(() => {
    const stored = loadStoredState(activeCompanyId);
    if (stored) {
      setSteps(stored.steps || buildInitialSteps());
      setDismissed(stored.dismissed || false);
    } else {
      setSteps(buildInitialSteps());
      setDismissed(false);
    }
  }, [activeCompanyId]);

  // Fetch data in parallel and compute done flags
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const [employeesRes, competencies, cycles, evaluationsRes] = await Promise.all([
          apiFetch("/employees", { token }).catch(() => ({})),
          apiFetch("/competencies", { token }).catch(() => []),
          apiFetch("/evaluation-cycles", { token }).catch(() => []),
          apiFetch("/evaluations", { token }).catch(() => ({})),
        ]);

        if (cancelled) return;

        const employees = employeesRes?.data ?? employeesRes ?? [];
        const evaluations = evaluationsRes?.data ?? evaluationsRes ?? [];

        const data = {
          employees: Array.isArray(employees) ? employees : [],
          competencies: Array.isArray(competencies) ? competencies : [],
          cycles: Array.isArray(cycles) ? cycles : [],
          evaluations: Array.isArray(evaluations) ? evaluations : [],
        };

        setSteps((prev) => {
          const updated = prev.map((s) => ({
            ...s,
            done: computeDone(s.key, data),
          }));

          // Persist to localStorage (keep existing dismissed flag)
          const stored = loadStoredState(activeCompanyId);
          saveStoredState(activeCompanyId, {
            steps: updated,
            dismissed: stored?.dismissed || false,
          });

          return updated;
        });
      } catch {
        // If all fetches fail, leave steps as-is (already loaded from storage)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [token, activeCompanyId]);

  const completedCount = useMemo(() => steps.filter((s) => s.done).length, [steps]);
  const allDone = completedCount === STEPS_CONFIG.length;
  const firstIncompleteIndex = steps.findIndex((s) => !s.done);

  function handleDismiss() {
    const stored = loadStoredState(activeCompanyId);
    saveStoredState(activeCompanyId, { steps: stored?.steps || steps, dismissed: true });
    setDismissed(true);
  }

  if (dismissed) return null;

  // ── Celebration state ────────────────────────────────────────────────────
  if (allDone && !loading) {
    return (
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15 text-2xl">
              🎉
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#7a9aaa]">Configuración inicial</p>
              <h3 className="mt-0.5 text-base font-semibold text-white">
                ¡Configuración completa! Tu equipo está listo para evaluar.
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  // ── Main checklist ───────────────────────────────────────────────────────
  return (
    <section className="pf-surface pf-surface-pad">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#14b8a6]">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7a9aaa]">Primeros pasos</p>
            <h3 className="mt-0.5 text-lg font-semibold text-white">Configuración de la organización</h3>
            <p className="mt-1 text-sm text-[#8fa9b7]">Completá estos pasos para dejar ZENTOR listo para tu equipo.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-48 md:w-64">
            <ProgressBar completed={loading ? 0 : completedCount} total={STEPS_CONFIG.length} />
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar checklist"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#7a9aaa] transition hover:bg-white/5 hover:text-white"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-5 space-y-2.5">
        {loading
          ? STEPS_CONFIG.map((s) => <SkeletonStep key={s.key} />)
          : STEPS_CONFIG.map((stepCfg, index) => {
              const stepState = steps[index] || { done: false };
              const isActive = index === firstIncompleteIndex;
              const isDone = stepState.done;

              return (
                <article
                  key={stepCfg.key}
                  className={`rounded-2xl border p-4 transition-colors duration-200 ${
                    isDone
                      ? "border-white/8 bg-white/3 opacity-70"
                      : isActive
                        ? "border-[#14b8a6]/35 bg-[#14b8a6]/6"
                        : "border-white/8 bg-[#0c1e28]"
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <StepCheckbox done={isDone} isActive={isActive} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg leading-none">{stepCfg.icon}</span>
                        <p className={`font-semibold ${isDone ? "text-[#8fa9b7] line-through decoration-white/20" : "text-white"}`}>
                          {stepCfg.title}
                        </p>
                        {isActive && !isDone ? (
                          <span className="rounded-full border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#14b8a6]">
                            Siguiente
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[#8fa9b7]">{stepCfg.desc}</p>
                    </div>

                    {/* Action button — only on the current active step */}
                    {isActive && !isDone ? (
                      <button
                        type="button"
                        onClick={() => setView(stepCfg.targetView)}
                        className="shrink-0 rounded-xl bg-[#14b8a6] px-4 py-2 text-xs font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
                      >
                        {stepCfg.actionLabel}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
      </div>
    </section>
  );
}
