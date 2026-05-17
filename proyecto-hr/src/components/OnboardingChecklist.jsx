import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { canManageOnboardingUser } from "../lib/roleHelpers";

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

function ProgressBar({ completed, total }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          {completed} de {total} pasos completados
        </p>
        <span className="text-xs text-[#8FA9B7]">{pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#0F1A21]">
        <div
          className="h-2 rounded-full bg-[#28964D] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingChecklist() {
  const { token, user, activeCompanyId } = useAuth();
  const { setView } = useView();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [pendingStep, setPendingStep] = useState("");

  const canManageOnboarding = canManageOnboardingUser(user);

  const loadStatus = useCallback(async () => {
    if (!token || !canManageOnboarding) return;
    try {
      setLoading(true);
      const data = await apiFetch("/onboarding/status", {
        token,
        timeoutMs: 15000,
      });
      setStatus(data);
      setMessage({ type: "", text: "" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [canManageOnboarding, token]);

  useEffect(() => {
    loadStatus();
  }, [activeCompanyId, loadStatus]);

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
        text: response.message || (mode === "complete" ? "Paso completado." : "Paso reabierto."),
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
      <section className="pf-surface pf-surface-pad">
        <p className="text-sm text-[#9fb6c4]">Cargando onboarding institucional...</p>
      </section>
    );
  }

  if (!status || status.completedAll) return null;

  return (
    <section className="pf-surface pf-surface-pad">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Onboarding institucional</p>
          <h3 className="pf-title-lg mt-2">Primeros pasos recomendados</h3>
          <p className="mt-2 max-w-3xl text-sm text-[#A9BFCA]">
            Te guiamos para dejar la organizacion lista con personas, roles, ciclo y reporte ejecutivo.
          </p>
        </div>
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F1A21] px-4 py-3">
          <ProgressBar completed={status.progress?.completed || 0} total={status.progress?.total || 0} />
        </div>
      </div>

      {message.text ? (
        <div className={message.type === "error" ? "pf-alert-error mt-4" : "pf-alert-success mt-4"}>
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {(status.steps || []).map((step) => {
          const targetView = stepFallbackViews[step.key] || "dashboard";
          const isPending = pendingStep === step.key;
          return (
            <article key={step.key} className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        step.completed
                          ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                          : "border-amber-300/30 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      {step.completed ? "Completado" : "Pendiente"}
                    </span>
                    <p className="font-semibold text-white">{step.label}</p>
                  </div>
                  <p className="mt-2 text-sm text-[#A9BFCA]">{step.description}</p>
                  {step.completedAt ? (
                    <p className="mt-2 text-xs text-[#7A9AAA]">
                      Completado el {new Date(step.completedAt).toLocaleDateString("es-AR")}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView(targetView)}
                    className="rounded-xl border border-white/15 bg-[#142028] px-3 py-2 text-sm text-white"
                  >
                    Ir al paso
                  </button>
                  {step.completed ? (
                    <button
                      type="button"
                      onClick={() => updateStep(step.key, "reopen")}
                      disabled={isPending}
                      className="rounded-xl border border-white/15 px-3 py-2 text-sm text-[#c5d5de] disabled:opacity-60"
                    >
                      {isPending ? "Guardando..." : "Reabrir"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateStep(step.key, "complete")}
                      disabled={isPending}
                      className="rounded-xl bg-[#28964D] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isPending ? "Guardando..." : "Marcar como hecho"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {incompleteSteps.length ? (
        <p className="mt-4 text-sm text-[#8FA9B7]">
          Siguiente sugerido: <span className="font-semibold text-white">{incompleteSteps[0].label}</span>
        </p>
      ) : null}
    </section>
  );
}
