import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
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
  const { addToast } = useToast();
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
        cache: "no-cache",
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
        apiFetch("/employees", { token, signal, timeoutMs: 20000, cache: "no-cache" }),
        apiFetch("/evaluations", { token, signal, timeoutMs: 20000, cache: "no-cache" }),
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
        cache: "no-cache",
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
      addToast({ message: editingPlanId ? "Plan actualizado." : "Plan creado.", type: "success" });
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
      addToast({ message: "Plan eliminado.", type: "success" });
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Seguimiento profesional</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Planes de desarrollo</h2>
        </div>
        <button
          type="button"
          onClick={() =>
            loadPlans().catch((error) => {
              setMessageType("error");
              setMessage(error.message);
            })
          }
          className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2 text-sm font-medium text-white"
        >
          Actualizar
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
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
                          ? "bg-[#14b8a6] text-[#0f172a]"
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
                          ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
                          : suggestion.severity === "medium"
                            ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
                            : "border-white/10 bg-[#122530] text-[#d6e2e8]"
                      }`}>
                        {severityBadge(suggestion.severity)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Motivo</p>
                        <p className="mt-2 text-sm leading-relaxed text-[#d6e1e7]">{suggestion.reason}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Acción sugerida</p>
                        <div className="mt-2 rounded-2xl border border-[#14b8a6]/35 bg-[#0c2826] px-4 py-3 text-sm font-medium text-[#dbe7ff]">
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
                        className="rounded-2xl bg-[#14b8a6] px-4 py-2 text-sm font-medium text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-50"
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
                  title={hasSuggestions ? "Sin sugerencias para este filtro" : "Todavía no hay sugerencias"}
                  description={
                    hasSuggestions
                      ? "Cambiá el filtro o limpiá la búsqueda para ver otras sugerencias disponibles."
                      : "Aparecerán automáticamente cuando haya evaluaciones, KPIs/OKRs o planes con señales para revisar."
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
            <div className="mt-4 rounded-2xl border border-[#14b8a6]/35 bg-[#0c2826] px-4 py-3 text-sm text-[#ccfbf1]">
              Revisá y ajustá el plan antes de guardarlo.
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Relación base</p>
            <select className={`w-full rounded-2xl border px-4 py-3 text-white ${prefilledFromSuggestion && form.employeeId ? "border-[#14b8a6] bg-[#0d2826]" : "border-white/15 bg-[#0f1f28]"}`} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
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
            <textarea className={`min-h-24 max-h-48 w-full resize-y rounded-2xl border px-4 py-3 text-white ${prefilledFromSuggestion && form.aspectoDesarrollar ? "border-[#14b8a6] bg-[#0d2826]" : "border-white/15 bg-[#0f1f28]"}`} placeholder="Aspecto a desarrollar" value={form.aspectoDesarrollar} onChange={(event) => setForm({ ...form, aspectoDesarrollar: event.target.value })} />
            <textarea className="min-h-20 max-h-36 w-full resize-y rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Cómo se va a medir" value={form.medicion} onChange={(event) => setForm({ ...form, medicion: event.target.value })} />

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">3. Seguimiento</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaSeguimiento} onChange={(event) => setForm({ ...form, fechaSeguimiento: event.target.value })} />
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#14b8a6] py-3 font-semibold text-[#0f172a]">
              {isSubmitting ? "Guardando..." : editingPlanId ? "Guardar cambios" : "Crear plan"}
            </button>
          </form>
        </section>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7f99a8]">
                <circle cx="6.5" cy="6.5" r="4.5" /><path d="M11 11l3 3" />
              </svg>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] py-3 pl-8 pr-4 text-sm text-white outline-none transition focus:border-[#14b8a6] placeholder:text-[#7f99a8]"
                placeholder="Buscar plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
                renderItem={(plan) => {
                  const now = new Date();
                  const dueDate = plan.fechaSeguimiento ? new Date(plan.fechaSeguimiento) : null;
                  const isOverdue = dueDate && dueDate < now && plan.estado !== "CERRADO";
                  const daysLeft = dueDate ? Math.ceil((dueDate - now) / 86400000) : null;

                  const statusLabel = plan.estado === "CERRADO" ? "Completado"
                    : isOverdue ? "Vencido"
                    : plan.estado === "EN_CURSO" ? "Activo"
                    : "Pendiente";
                  const statusCls = plan.estado === "CERRADO"
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : isOverdue
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                      : plan.estado === "EN_CURSO"
                        ? "border-[#14b8a6]/30 bg-[#14b8a6]/10 text-[#14b8a6]"
                        : "border-amber-300/25 bg-amber-500/8 text-amber-300";
                  const cardBorder = plan.estado === "CERRADO"
                    ? "border-emerald-400/15 bg-[#0d2320]"
                    : isOverdue
                      ? "border-rose-400/15 bg-[#1f0e10]"
                      : plan.estado === "EN_CURSO"
                        ? "border-[#14b8a6]/15 bg-[#0d1e22]"
                        : "border-white/10 bg-[#0f1f28]";

                  const dateLine = !dueDate ? null
                    : isOverdue ? `Venció el ${dueDate.toLocaleDateString("es-AR", { dateStyle: "medium" })}`
                    : daysLeft <= 7 ? `Vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                    : dueDate.toLocaleDateString("es-AR", { dateStyle: "medium" });
                  const dateCls = !dueDate ? ""
                    : isOverdue ? "text-rose-300"
                    : daysLeft <= 7 ? "text-amber-300"
                    : "text-[#14b8a6]";

                  return (
                  <article key={plan._id} className={`lift-item rounded-2xl border p-5 ${cardBorder}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{plan.employeeId?.apellido}, {plan.employeeId?.nombre}</p>
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusCls}`}>{statusLabel}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#c5d5de] leading-snug">{plan.aspectoDesarrollar}</p>
                      </div>
                      {dateLine ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-3.5 w-3.5 ${dateCls}`}>
                            <circle cx="8" cy="8" r="7" /><path d="M8 5v3l2 2" />
                          </svg>
                          <span className={`text-xs font-semibold ${dateCls}`}>{dateLine}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {plan.medicion ? (
                        <div className="flex items-start gap-2 text-xs text-[#8fa9b7]">
                          <span className="mt-0.5 shrink-0 text-[#14b8a6]">▸</span>
                          <span>{plan.medicion}</span>
                        </div>
                      ) : null}
                      {plan.fortalezas ? (
                        <div className="flex items-start gap-2 text-xs text-[#7a9aaa]">
                          <span className="mt-0.5 shrink-0">✦</span>
                          <span className="line-clamp-2">{plan.fortalezas}</span>
                        </div>
                      ) : null}
                    </div>

                    {canManagePlans ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleEditPlan(plan)} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-[#c5d5de] transition hover:bg-white/5">
                          Editar
                        </button>
                        <button type="button" onClick={() => setConfirmState({ open: true, plan })} className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20">
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </article>
                  );
                }}
              />
            ) : (
              !isLoadingBase && !isLoadingPlans && messageType !== "error" ? (
                <EmptyState
                  compact
                  title={user?.roleCode === "EMPLEADO" ? "Todavía no tenés planes asociados" : "No hay planes todavía"}
                  description={
                    user?.roleCode === "EMPLEADO"
                      ? "Cuando te asignen un plan, lo vas a ver acá con su próximo seguimiento."
                      : searchQuery
                        ? "No encontramos planes para la búsqueda actual."
                        : "Podés crear uno desde una evaluación o cargarlo manualmente."
                  }
                  actionLabel={user?.roleCode !== "EMPLEADO" && !searchQuery ? "Crear plan" : undefined}
                  onAction={user?.roleCode !== "EMPLEADO" && !searchQuery ? () => planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
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

