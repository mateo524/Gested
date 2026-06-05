import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { canManageOnboardingUser } from "../lib/roleHelpers";
import { ErrorState, LoadingState } from "./AppStates";

const stepFallbackViews = {
  configure_organization: "settings",
  download_template: "carga-masiva",
  import_employees: "carga-masiva",
  review_roles: "roles",
  configure_kpis_okrs: "metricas",
  create_cycle: "ciclos",
  launch_evaluation: "evaluaciones",
  view_executive_report: "reporte-ejecutivo",
};

function GradientProgressBar({ completed, total }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">
          {completed} de {total} pasos
        </span>
        <span className="rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#14b8a6]">
          {pct}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#38bdf8] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepNumber({ index, completed, isNext }) {
  if (completed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-emerald-300">
          <path d="M3 8l3.5 3.5L13 5" />
        </svg>
      </span>
    );
  }
  if (isNext) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14b8a6]/20 border border-[#14b8a6]/40 text-xs font-bold text-[#14b8a6]">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-[#7a9aaa]">
      {index + 1}
    </span>
  );
}

export default function OnboardingChecklist() {
  const { token, user, activeCompanyId } = useAuth();
  const { setView } = useView();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [pendingStep, setPendingStep] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionRef = useRef(null);

  const canManageOnboarding = canManageOnboardingUser(user);

  const loadStatus = useCallback(async () => {
    if (!token || !canManageOnboarding) return;
    try {
      setLoading(true);
      const data = await apiFetch("/onboarding/status", { token, timeoutMs: 15000 });
      setStatus(data);
      setMessage({ type: "", text: "" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [canManageOnboarding, token]);

  useEffect(() => { loadStatus(); }, [activeCompanyId, loadStatus]);

  const incompleteSteps = useMemo(
    () => (status?.steps || []).filter((step) => !step.completed),
    [status?.steps]
  );

  async function updateStep(stepKey, mode) {
    try {
      setPendingStep(stepKey);
      const response = await apiFetch(`/onboarding/steps/${stepKey}/${mode}`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        timeoutMs: 15000,
      });
      setStatus(response);
      setMessage({
        type: "success",
        text: response.message || (mode === "complete" ? "Paso marcado como completado." : "Paso reabierto."),
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setPendingStep("");
    }
  }

  if (!canManageOnboarding) return null;

  if (loading) {
    return (
      <section ref={sectionRef} className="pf-surface pf-surface-pad">
        <LoadingState compact title="Cargando progreso de onboarding" description="Revisando los pasos completados de tu organización." />
      </section>
    );
  }

  if (message.type === "error" && !status) {
    return (
      <section className="pf-surface pf-surface-pad">
        <ErrorState compact title="No pudimos cargar el onboarding" description="Reintentá en unos segundos." actionLabel="Reintentar" onAction={loadStatus} />
      </section>
    );
  }

  if (!status) return null;

  if (status.completedAll && !isExpanded) {
    return (
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-emerald-300">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#7a9aaa]">Onboarding institucional</p>
              <h3 className="mt-0.5 text-lg font-semibold text-white">
                Configuración completa
                <span className="ml-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  {status.progress?.completed}/{status.progress?.total} pasos
                </span>
              </h3>
              <p className="mt-1 text-sm text-[#8fa9b7]">Tu organización está lista para operar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setIsExpanded(true); window.requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
            className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5"
          >
            Ver checklist
          </button>
        </div>
      </section>
    );
  }

  const nextStepKey = incompleteSteps[0]?.key;

  return (
    <section ref={sectionRef} className="pf-surface pf-surface-pad">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5">
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
        <div className="w-full max-w-xs">
          <GradientProgressBar completed={status.progress?.completed || 0} total={status.progress?.total || 0} />
        </div>
        {status.completedAll ? (
          <button type="button" onClick={() => setIsExpanded(false)} className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5">
            Ocultar
          </button>
        ) : null}
      </div>

      {message.text ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-rose-300/30 bg-rose-500/10 text-rose-200" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"}`}>
          {message.text}
        </div>
      ) : null}

      {/* Steps */}
      <div className="mt-5 space-y-3">
        {(status.steps || []).map((step, index) => {
          const targetView = stepFallbackViews[step.key] || "dashboard";
          const isPending = pendingStep === step.key;
          const isNext = step.key === nextStepKey;

          return (
            <article
              key={step.key}
              className={`rounded-2xl border p-4 transition ${
                step.completed
                  ? "border-white/8 bg-white/3 opacity-70"
                  : isNext
                    ? "border-[#14b8a6]/30 bg-[#14b8a6]/5"
                    : "border-white/10 bg-[#0c1e28]"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <StepNumber index={index} completed={step.completed} isNext={isNext} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold ${step.completed ? "text-[#8fa9b7] line-through decoration-white/20" : "text-white"}`}>
                      {step.label}
                    </p>
                    {isNext && !step.completed ? (
                      <span className="rounded-full border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#14b8a6]">
                        Siguiente
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[#8fa9b7]">{step.description}</p>
                  {step.completedAt ? (
                    <p className="mt-1.5 text-xs text-[#5e7d8c]">
                      Completado el {new Date(step.completedAt).toLocaleDateString("es-AR", { dateStyle: "medium" })}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView(targetView)}
                    className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-[#c5d5de] transition hover:bg-white/5"
                  >
                    Ir al módulo
                  </button>
                  {step.completed ? (
                    <button
                      type="button"
                      onClick={() => updateStep(step.key, "reopen")}
                      disabled={isPending}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[#7a9aaa] transition hover:text-[#c5d5de] disabled:opacity-50"
                    >
                      {isPending ? "Guardando..." : "Reabrir"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateStep(step.key, "complete")}
                      disabled={isPending}
                      className="rounded-xl bg-[#14b8a6] px-3 py-2 text-xs font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60"
                    >
                      {isPending ? "Guardando..." : "Marcar hecho"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {incompleteSteps.length ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-4 py-3">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#14b8a6]">
            <path d="M8 1v7l4 2" />
            <circle cx="8" cy="8" r="7" />
          </svg>
          <p className="text-sm text-[#8fa9b7]">
            Siguiente: <span className="font-semibold text-[#14b8a6]">{incompleteSteps[0].label}</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
