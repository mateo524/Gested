import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import CollapsibleList from "../components/CollapsibleList";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  employeeId: "",
  evaluationId: "",
  fortalezas: "",
  aspectoDesarrollar: "",
  medicion: "",
  fechaSeguimiento: "",
  estado: "PENDIENTE",
};

const suggestionFilters = [
  { key: "all", label: "Todas" },
  { key: "high", label: "Alta prioridad" },
  { key: "medium", label: "Media" },
  { key: "low", label: "Baja" },
  { key: "kpi", label: "KPI" },
  { key: "okr", label: "OKR" },
  { key: "evaluation", label: "Evaluación" },
  { key: "plan", label: "Plan vencido" },
];

export default function DevelopmentPlansPage() {
  const { token, user, hasPermission } = useAuth();
  const { searchQuery } = useView();
  const [plans, setPlans] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ employeeId: "", estado: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState([]);
  const [suggestionFilter, setSuggestionFilter] = useState("all");
  const [prefilledFromSuggestion, setPrefilledFromSuggestion] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState("");
  const [confirmState, setConfirmState] = useState({ open: false, plan: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const planFormRef = useRef(null);
  const roleScope = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
  const baseCacheKey = `pf_plans_base_${roleScope}`;
  const plansCacheKey = `pf_plans_list_${roleScope}_${filters.employeeId || "all"}_${filters.estado || "all"}`;
  const visiblePlans = plans.filter((plan) => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return true;
    return [
      plan.employeeId?.nombre,
      plan.employeeId?.apellido,
      plan.aspectoDesarrollar,
      plan.medicion,
      plan.estado,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });
  const visibleSuggestions = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    return suggestions.filter((suggestion) => {
      if (dismissedSuggestionIds.includes(suggestion.id)) return false;
      if (suggestionFilter !== "all") {
        if (["high", "medium", "low"].includes(suggestionFilter) && suggestion.severity !== suggestionFilter) {
          return false;
        }
        if (["kpi", "okr", "evaluation", "plan"].includes(suggestionFilter) && suggestion.sourceType !== suggestionFilter) {
          return false;
        }
      }
      if (!term) return true;
      return [
        suggestion.employeeName,
        suggestion.title,
        suggestion.reason,
        suggestion.suggestedAction,
        ...(suggestion.evidence || []).map((item) => `${item.label} ${item.value}`),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [dismissedSuggestionIds, searchQuery, suggestionFilter, suggestions]);
  const hasSuggestions = suggestions.some((suggestion) => !dismissedSuggestionIds.includes(suggestion.id));
  const canManagePlans = Boolean(
    hasPermission("manage_development_plans") || hasPermission("evaluate_team")
  );

  const loadPlans = useCallback(async (signal) => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.estado) params.set("estado", filters.estado);
    const query = params.toString() ? `?${params.toString()}` : "";
    setIsLoadingPlans(true);
    try {
      const plansData = await apiFetch(`/development-plans${query}`, {
        token,
        signal,
        timeoutMs: 20000,
      });
      setPlans(plansData);
      sessionStorage.setItem(plansCacheKey, JSON.stringify(plansData));
    } finally {
      setIsLoadingPlans(false);
    }
  }, [filters.employeeId, filters.estado, token, plansCacheKey]);

  const loadBaseData = useCallback(async (signal) => {
    setIsLoadingBase(true);
    try {
      const [employeesData, evaluationsData] = await Promise.all([
        apiFetch("/employees", { token, signal, timeoutMs: 20000 }),
        apiFetch("/evaluations", { token, signal, timeoutMs: 20000 }),
      ]);
      setEmployees(employeesData);
      setEvaluations(evaluationsData);
      sessionStorage.setItem(
        baseCacheKey,
        JSON.stringify({ employees: employeesData, evaluations: evaluationsData })
      );
    } finally {
      setIsLoadingBase(false);
    }
  }, [baseCacheKey, token]);

  const loadSuggestions = useCallback(async (signal) => {
    setIsLoadingSuggestions(true);
    try {
      const data = await apiFetch("/development-plans/suggestions", {
        token,
        signal,
        timeoutMs: 20000,
      });
      setSuggestions(data.suggestions || []);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [token]);

  useEffect(() => {
    const cachedBase = sessionStorage.getItem(baseCacheKey);
    if (cachedBase) {
      try {
        const parsed = JSON.parse(cachedBase);
        setEmployees(parsed.employees || []);
        setEvaluations(parsed.evaluations || []);
      } catch {
        sessionStorage.removeItem(baseCacheKey);
      }
    }

    const controller = new AbortController();
    loadBaseData(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setMessageType("error");
        setMessage(error.message);
      }
    });
    return () => controller.abort();
  }, [baseCacheKey, loadBaseData]);

  useEffect(() => {
    const controller = new AbortController();
    loadSuggestions(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setMessageType("error");
        setMessage(error.message);
      }
    });
    return () => controller.abort();
  }, [loadSuggestions]);

  useEffect(() => {
    const cachedPlans = sessionStorage.getItem(plansCacheKey);
    if (cachedPlans) {
      try {
        setPlans(JSON.parse(cachedPlans) || []);
      } catch {
        sessionStorage.removeItem(plansCacheKey);
      }
    }

    const controller = new AbortController();
    loadPlans(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setMessageType("error");
        setMessage(error.message);
      }
    });
    return () => controller.abort();
  }, [loadPlans, plansCacheKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.employeeId || !form.aspectoDesarrollar) {
      setMessageType("warning");
      setMessage("Selecciona empleado y define el aspecto a desarrollar.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      await apiFetch(editingPlanId ? `/development-plans/${editingPlanId}` : "/development-plans", {
        method: editingPlanId ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fortalezas: form.fortalezas.split(",").map((item) => item.trim()).filter(Boolean),
          evaluationId: form.evaluationId || null,
          fechaSeguimiento: form.fechaSeguimiento || null,
        }),
      });
      setForm(emptyForm);
      setPrefilledFromSuggestion(false);
      setEditingPlanId("");
      setMessageType("success");
      setMessage(editingPlanId ? "Plan de desarrollo actualizado." : "Plan de desarrollo creado.");
      await Promise.all([loadPlans(), loadSuggestions()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSuggestionCreate(suggestion) {
    const employee = employees.find((item) => String(item._id) === String(suggestion.employeeId));
    if (!employee) {
      setMessageType("warning");
      setMessage("No encontramos a la persona dentro de tu alcance actual para crear el plan.");
      return;
    }

    setForm({
      employeeId: String(suggestion.employeeId),
      evaluationId: "",
      fortalezas: "",
      aspectoDesarrollar: suggestion.recommendedPlanTitle || suggestion.title,
      medicion: suggestion.recommendedPlanDescription || suggestion.suggestedAction || "",
      fechaSeguimiento: "",
      estado: "PENDIENTE",
    });
    setPrefilledFromSuggestion(true);
    setMessageType("info");
    setMessage("Revisá y ajustá el plan antes de guardarlo.");
    requestAnimationFrame(() => {
      planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleEditPlan(plan) {
    setEditingPlanId(plan._id);
    setPrefilledFromSuggestion(false);
    setForm({
      employeeId: String(plan.employeeId?._id || plan.employeeId || ""),
      evaluationId: String(plan.evaluationId?._id || plan.evaluationId || ""),
      fortalezas: Array.isArray(plan.fortalezas) ? plan.fortalezas.join(", ") : "",
      aspectoDesarrollar: plan.aspectoDesarrollar || "",
      medicion: plan.medicion || "",
      fechaSeguimiento: plan.fechaSeguimiento
        ? new Date(plan.fechaSeguimiento).toISOString().slice(0, 10)
        : "",
      estado: plan.estado || "PENDIENTE",
    });
    setMessageType("info");
    setMessage("Revisá y ajustá el plan antes de guardarlo.");
    requestAnimationFrame(() => {
      planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function confirmDeletePlan() {
    const plan = confirmState.plan;
    if (!plan) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/development-plans/${plan._id}`, {
        method: "DELETE",
        token,
      });
      setConfirmState({ open: false, plan: null });
      if (editingPlanId === plan._id) {
        setEditingPlanId("");
        setForm(emptyForm);
        setPrefilledFromSuggestion(false);
      }
      setMessageType("success");
      setMessage("Plan de desarrollo eliminado.");
      await Promise.all([loadPlans(), loadSuggestions()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDismissSuggestion(suggestionId) {
    setDismissedSuggestionIds((current) =>
      current.includes(suggestionId) ? current : [...current, suggestionId]
    );
  }

  function severityBadge(severity) {
    if (severity === "high") return "Alta";
    if (severity === "medium") return "Media";
    return "Baja";
  }

  function suggestionFilterCount(filterKey) {
    return suggestions.filter((suggestion) => {
      if (dismissedSuggestionIds.includes(suggestion.id)) return false;
      if (filterKey === "all") return true;
      if (["high", "medium", "low"].includes(filterKey)) return suggestion.severity === filterKey;
      return suggestion.sourceType === filterKey;
    }).length;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Seguimiento profesional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Desarrollo</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Desarrollo es el seguimiento de las acciones de mejora de las personas y equipos. Acá ves qué planes están activos,
          vencidos o completados.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">
            Seguimiento por persona y estado
          </span>
          <button
            type="button"
            onClick={() =>
              loadPlans().catch((error) => {
                setMessageType("error");
                setMessage(error.message);
              })
            }
            className="rounded-full border border-white/15 bg-[#122530] px-3 py-1 text-xs font-medium text-white"
          >
            Actualizar planes
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-[#7f99a8]">Para que sirven los planes</p>
            <h4 className="mt-2 text-xl font-semibold text-white">Convertir una necesidad detectada en acciones concretas</h4>
            <p className="mt-3 text-sm leading-relaxed text-[#9fb6c4]">
              Los planes de desarrollo convierten una evaluacion o necesidad detectada en acciones concretas de mejora, con
              responsable, fecha objetivo y seguimiento.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Plan", "La mejora o brecha a trabajar."],
              ["Responsable", "Quien acompana o hace seguimiento."],
              ["Acción", "La acción concreta de mejora."],
              ["Próximo paso", "La fecha y el estado del siguiente seguimiento."],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-sm text-[#9fb6c4]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-[#7f99a8]">Sugerencias de desarrollo</p>
                <h4 className="mt-2 text-xl font-semibold text-white">Qué acción conviene revisar ahora</h4>
                <p className="mt-3 text-sm leading-relaxed text-[#9fb6c4]">
                  Estas sugerencias se generan a partir de evaluaciones, KPIs, OKRs y planes existentes. Revisalas antes de crear un plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  loadSuggestions().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
                className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2 text-sm font-medium text-white"
              >
                {isLoadingSuggestions ? "Actualizando..." : "Actualizar sugerencias"}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {suggestionFilters.map((item) => {
                  const active = suggestionFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSuggestionFilter(item.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "bg-[#1e3a8a] text-white"
                          : "border border-white/15 bg-[#122530] text-[#c5d5de]"
                      }`}
                    >
                      {item.label} ({suggestionFilterCount(item.key)})
                    </button>
                  );
                })}
              </div>

              {isLoadingSuggestions ? (
                <LoadingState
                  compact
                  title="Buscando oportunidades de seguimiento"
                  description="Estamos cruzando evaluaciones, KPI, OKR y planes vigentes."
                />
              ) : visibleSuggestions.length ? (
                <CollapsibleList
                  items={visibleSuggestions}
                  initialCount={3}
                  className="space-y-4"
                  renderItem={(suggestion) => (
                    <article key={suggestion.id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{suggestion.employeeName}</p>
                        <p className="mt-1 text-sm text-[#c5d5de]">{suggestion.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestion.departmentCode ? (
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                              Área {suggestion.departmentCode}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
                            {suggestion.sourceType === "evaluation"
                              ? "Evaluación"
                              : suggestion.sourceType === "plan"
                                ? "Plan vencido"
                                : suggestion.sourceType.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        suggestion.severity === "high"
                          ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
                          : suggestion.severity === "medium"
                            ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
                            : "border-slate-400/20 bg-[#1e293b] text-[#d2dbe2]"
                      }`}>
                        Prioridad {severityBadge(suggestion.severity)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Motivo</p>
                        <p className="mt-2 text-sm leading-relaxed text-[#d6e1e7]">{suggestion.reason}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Acción sugerida</p>
                        <div className="mt-2 rounded-2xl border border-[#1e3a8a]/35 bg-[#132847] px-4 py-3 text-sm font-medium text-[#dbe7ff]">
                          {suggestion.suggestedAction}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Evidencia</p>
                        <div className="mt-2 grid gap-2">
                          {(suggestion.evidence || []).map((item) => (
                            <div key={`${suggestion.id}-${item.label}`} className="rounded-2xl border border-white/10 bg-[#122530] px-3 py-2 text-xs text-[#c5d5de]">
                              <strong className="text-white">{item.label}:</strong> {item.value}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleSuggestionCreate(suggestion)}
                        disabled={!suggestion.canCreatePlan}
                        className="rounded-2xl bg-[#1e3a8a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Crear plan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(suggestion.id)}
                        className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-[#c5d5de]"
                      >
                        Descartar
                      </button>
                    </div>
                    </article>
                  )}
                />
              ) : (
                <EmptyState
                  compact
                  title={hasSuggestions ? "No hay sugerencias para este filtro" : "No hay sugerencias por ahora"}
                  description={
                    hasSuggestions
                      ? "Cambiá el filtro o limpiá la búsqueda para ver otras sugerencias disponibles."
                      : "No hay sugerencias por ahora. Aparecerán cuando existan evaluaciones, KPIs/OKRs o planes con señales para revisar."
                  }
                />
              )}
            </div>
          </section>

        <section ref={planFormRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingPlanId ? "Editar plan de desarrollo" : "Nuevo plan de desarrollo"}</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Empleado</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Objetivo</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Seguimiento</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setPrefilledFromSuggestion(false);
                setEditingPlanId("");
                planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-full border border-white/15 bg-[#122530] px-3 py-1 text-xs font-medium text-white"
            >
              {editingPlanId ? "Crear plan manual" : "Limpiar formulario"}
            </button>
          </div>
          {prefilledFromSuggestion ? (
            <div className="mt-4 rounded-2xl border border-[#1e3a8a]/35 bg-[#132847] px-4 py-3 text-sm text-[#dce7ff]">
              Revisá y ajustá el plan antes de guardarlo.
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Relación base</p>
            <select className={`w-full rounded-2xl border px-4 py-3 text-white ${prefilledFromSuggestion && form.employeeId ? "border-[#4f7cff] bg-[#10233A]" : "border-white/15 bg-[#0f1f28]"}`} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
              <option value="">Selecciona empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>

            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.evaluationId} onChange={(event) => setForm({ ...form, evaluationId: event.target.value })}>
              <option value="">Sin evaluación base</option>
              {evaluations.map((evaluation) => (
                <option key={evaluation._id} value={evaluation._id}>
                  {evaluation.tipo} - {evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}
                </option>
              ))}
            </select>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">2. Definición del plan</p>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Fortalezas (separadas por coma)" value={form.fortalezas} onChange={(event) => setForm({ ...form, fortalezas: event.target.value })} />
            <textarea className={`min-h-24 w-full rounded-2xl border px-4 py-3 text-white ${prefilledFromSuggestion && form.aspectoDesarrollar ? "border-[#4f7cff] bg-[#10233A]" : "border-white/15 bg-[#0f1f28]"}`} placeholder="Aspecto a desarrollar" value={form.aspectoDesarrollar} onChange={(event) => setForm({ ...form, aspectoDesarrollar: event.target.value })} />
            <textarea className="min-h-20 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Cómo se va a medir" value={form.medicion} onChange={(event) => setForm({ ...form, medicion: event.target.value })} />

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">3. Seguimiento</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaSeguimiento} onChange={(event) => setForm({ ...form, fechaSeguimiento: event.target.value })} />
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingPlanId ? "Guardar cambios" : "Crear plan"}
            </button>
          </form>
        </section>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap gap-3">
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.employeeId} onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}>
              <option value="">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value })}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {isLoadingBase || isLoadingPlans ? (
              <LoadingState
                compact
                title="Actualizando planes"
                description="Estamos trayendo evaluaciones base, personas y seguimientos."
              />
            ) : null}
            {!isLoadingBase && !isLoadingPlans && messageType === "error" && !plans.length ? (
              <ErrorState
                compact
                title="No pudimos cargar los planes"
                description="Reintenta para recuperar el seguimiento actual."
                actionLabel="Reintentar"
                onAction={() =>
                  loadPlans().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
              />
            ) : null}
            {!isLoadingBase && !isLoadingPlans && visiblePlans.length ? (
              <CollapsibleList
                items={visiblePlans}
                initialCount={3}
                className="space-y-4"
                renderItem={(plan) => (
                  <article key={plan._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{plan.employeeId?.apellido}, {plan.employeeId?.nombre}</p>
                    <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">
                      {plan.estado === "CERRADO"
                        ? "Completado"
                        : plan.fechaSeguimiento && new Date(plan.fechaSeguimiento) < new Date()
                          ? "Vencido"
                          : plan.estado === "EN_CURSO"
                            ? "Activo"
                            : "Sin seguimiento"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#c5d5de]">{plan.aspectoDesarrollar}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">Responsable: {plan.employeeId?.apellido}, {plan.employeeId?.nombre}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">Acción / métrica: {plan.medicion || "-"}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">Próximo paso: {plan.fechaSeguimiento ? new Date(plan.fechaSeguimiento).toLocaleDateString("es-AR") : "-"}</p>
                  {canManagePlans ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditPlan(plan)}
                        className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmState({ open: true, plan })}
                        className="rounded-2xl border border-rose-300/30 px-4 py-2 text-sm font-medium text-rose-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                  </article>
                )}
              />
            ) : (
              !isLoadingBase && !isLoadingPlans && messageType !== "error" ? (
                <EmptyState
                  compact
                  title={user?.roleCode === "EMPLEADO" ? "Todavía no tienes planes asociados" : "No hay planes todavía"}
                  description={
                    user?.roleCode === "EMPLEADO"
                      ? "Cuando te asignen un plan, lo vas a ver acá con su próximo seguimiento."
                      : searchQuery
                        ? "No encontramos planes para la búsqueda actual."
                        : "Podés crear uno desde una evaluación o cargarlo manualmente."
                  }
                />
              ) : null
            )}
          </div>
        </section>
      </div>

      {message ? (
        <p
          className={
            messageType === "error"
              ? "pf-alert-error"
              : messageType === "success"
                ? "pf-alert-success"
                : messageType === "warning"
                  ? "pf-alert-warning"
                  : "pf-alert-info"
          }
        >
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        title="Eliminar plan de desarrollo"
        message={
          confirmState.plan
            ? `Vas a eliminar el plan sobre "${confirmState.plan.aspectoDesarrollar}". Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, plan: null })}
        onConfirm={confirmDeletePlan}
      />
    </div>
  );
}

