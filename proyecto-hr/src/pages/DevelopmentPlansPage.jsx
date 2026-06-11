import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import ConfirmDialog from "../components/ConfirmDialog";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";

const ESTADO_LABELS_ES = { PENDIENTE: "Pendiente", EN_CURSO: "En curso", EN_SEGUIMIENTO: "En seguimiento", COMPLETADO: "Completado", VENCIDO: "Vencido" };
const ESTADO_LABELS_EN = { PENDIENTE: "Pending", EN_CURSO: "In progress", EN_SEGUIMIENTO: "In tracking", COMPLETADO: "Completed", VENCIDO: "Overdue" };

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
      <p className="text-xs text-[#7f99a8]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-[#14b8a6]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ estado, language }) {
  const labels = language === "en" ? ESTADO_LABELS_EN : ESTADO_LABELS_ES;
  const label = labels[estado] || estado;
  const cls = estado === "COMPLETADO" ? "bg-emerald-500/15 text-emerald-200"
    : estado === "EN_CURSO" ? "bg-sky-500/15 text-sky-200"
    : estado === "EN_SEGUIMIENTO" ? "bg-violet-500/15 text-violet-200"
    : estado === "VENCIDO" ? "bg-rose-500/15 text-rose-200"
    : "bg-white/10 text-[#c7d5dc]";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div className="h-1.5 rounded-full bg-[#14b8a6] transition-all" style={{ width: `${pct}%` }}/>
      </div>
      <span className="text-xs text-[#9fb6c4] w-8 text-right">{pct}%</span>
    </div>
  );
}

const emptyForm = { employeeId: "", evaluationId: "", fortalezas: "", aspectoDesarrollar: "", medicion: "", fechaSeguimiento: "", estado: "PENDIENTE", progreso: 0 };

export default function DevelopmentPlansPage() {
  const { token, user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const { language, searchQuery } = useView();
  const L = (es, en) => language === "en" ? en : es;

  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployeeOnly = isEmployee && !isManager && !isSuperAdmin;
  const canManage = Boolean(hasPermission("manage_development_plans") || hasPermission("evaluate_team")) && !isEmployeeOnly;

  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ employeeId: "", estado: "", prioridad: "" });
  const [modal, setModal] = useState({ open: false, editId: "" });
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, plan: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Suggestion-from-evaluation state
  const [closedEvals, setClosedEvals] = useState([]);
  const [selectedEvalForSuggestion, setSelectedEvalForSuggestion] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const estadoLabels = language === "en" ? ESTADO_LABELS_EN : ESTADO_LABELS_ES;
  const roleScope = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
  const plansCacheKey = `pf_plans_list_${roleScope}_${filters.employeeId || "all"}_${filters.estado || "all"}`;

  const loadPlans = useCallback(async (signal) => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.estado) params.set("estado", filters.estado);
    const q = params.toString() ? `?${params.toString()}` : "";
    try {
      const data = await apiFetch(`/development-plans${q}`, { token, signal });
      const plans = Array.isArray(data) ? data : (data?.data ?? []);
      setPlans(plans);
      sessionStorage.setItem(plansCacheKey, JSON.stringify(plans));
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    }
  }, [filters.employeeId, filters.estado, token, plansCacheKey]);

  useEffect(() => {
    const cached = sessionStorage.getItem(plansCacheKey);
    if (cached) { try { setPlans(JSON.parse(cached) || []); } catch { sessionStorage.removeItem(plansCacheKey); } }

    const ctrl = new AbortController();
    (async () => {
      try {
        setIsLoading(true); setError("");
        const [emp, evals] = await Promise.all([
          apiFetch("/employees", { token, signal: ctrl.signal }).catch(() => ({})),
          apiFetch("/evaluations", { token, signal: ctrl.signal }).catch(() => ({})),
        ]);
        setEmployees(emp?.data ?? emp ?? []);
        setEvaluations(evals?.data ?? evals ?? []);
        await loadPlans(ctrl.signal);
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [filters.employeeId, filters.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    return plans.filter(p => {
      if (term) {
        const match = [p.employeeId?.nombre, p.employeeId?.apellido, p.aspectoDesarrollar, p.medicion, p.estado]
          .filter(Boolean).some(v => String(v).toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [plans, searchQuery]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now); weekAhead.setDate(now.getDate() + 7);
    return {
      active: plans.filter(p => p.estado !== "COMPLETADO" && p.estado !== "VENCIDO").length,
      tracking: plans.filter(p => p.estado === "EN_SEGUIMIENTO").length,
      completed: plans.filter(p => p.estado === "COMPLETADO").length,
      dueSoon: plans.filter(p => {
        if (!p.fechaSeguimiento) return false;
        const d = new Date(p.fechaSeguimiento);
        return d >= now && d <= weekAhead;
      }).length,
    };
  }, [plans]);

  const areaOptions = useMemo(() => [...new Set(employees.map(e => e.area).filter(Boolean))].sort(), [employees]);

  function openNew() {
    setForm(emptyForm);
    setClosedEvals([]);
    setSelectedEvalForSuggestion("");
    setSuggestions([]);
    setModal({ open: true, editId: "" });
  }

  function openEdit(plan) {
    setForm({
      employeeId: String(plan.employeeId?._id || plan.employeeId || ""),
      evaluationId: String(plan.evaluationId?._id || plan.evaluationId || ""),
      fortalezas: Array.isArray(plan.fortalezas) ? plan.fortalezas.join(", ") : (plan.fortalezas || ""),
      aspectoDesarrollar: plan.aspectoDesarrollar || "",
      medicion: plan.medicion || "",
      fechaSeguimiento: plan.fechaSeguimiento ? plan.fechaSeguimiento.slice(0, 10) : "",
      estado: plan.estado || "PENDIENTE",
      progreso: plan.progreso || 0,
    });
    setModal({ open: true, editId: plan._id });
  }

  // Load closed evaluations when a new plan's employeeId changes
  useEffect(() => {
    if (!modal.open || modal.editId) return; // only for new plans
    if (!form.employeeId) { setClosedEvals([]); setSelectedEvalForSuggestion(""); setSuggestions([]); return; }
    const ctrl = new AbortController();
    apiFetch(`/evaluations?estado=CERRADA&employeeId=${form.employeeId}`, { token, signal: ctrl.signal })
      .then(data => setClosedEvals(Array.isArray(data) ? data : []))
      .catch(() => setClosedEvals([]));
    return () => ctrl.abort();
  }, [form.employeeId, modal.open, modal.editId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadSuggestions() {
    if (!selectedEvalForSuggestion) return;
    try {
      setIsFetchingSuggestions(true);
      setSuggestions([]);
      const data = await apiFetch(`/development-plans/from-evaluation/${selectedEvalForSuggestion}`, { token });
      if (!data.suggestions?.length) {
        addToast({ message: L("No hay métricas débiles en esa evaluación.", "No weak metrics found in that evaluation."), type: "info" });
        return;
      }
      setSuggestions(data.suggestions);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsFetchingSuggestions(false);
    }
  }

  function applySuggestion(suggestion) {
    setForm(f => ({
      ...f,
      evaluationId: selectedEvalForSuggestion,
      aspectoDesarrollar: suggestion.aspectoDesarrollar,
      medicion: suggestion.medicion,
    }));
    setSuggestions([]);
    addToast({ message: L("Campos precargados desde la evaluación.", "Fields pre-filled from evaluation."), type: "success" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.aspectoDesarrollar.trim()) {
      addToast({ message: L("Definí el aspecto a desarrollar.", "Define the aspect to develop."), type: "warning" });
      return;
    }
    try {
      setIsSubmitting(true);
      const body = { ...form, fortalezas: form.fortalezas.split(",").map(s => s.trim()).filter(Boolean), evaluationId: form.evaluationId || null, fechaSeguimiento: form.fechaSeguimiento || null };
      await apiFetch(modal.editId ? `/development-plans/${modal.editId}` : "/development-plans", {
        method: modal.editId ? "PUT" : "POST", token,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setModal({ open: false, editId: "" });
      addToast({ message: modal.editId ? L("Plan actualizado.", "Plan updated.") : L("Plan creado.", "Plan created."), type: "success" });
      const ctrl = new AbortController();
      await loadPlans(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    const plan = confirmState.plan;
    if (!plan) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/development-plans/${plan._id}`, { method: "DELETE", token });
      setConfirmState({ open: false, plan: null });
      addToast({ message: L("Plan eliminado.", "Plan deleted."), type: "success" });
      const ctrl = new AbortController();
      await loadPlans(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Seguimiento de mejora", "Improvement tracking")}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Planes de acción", "Action Plans")}</h2>
          <p className="mt-1 text-sm text-[#7f99a8]">{L("Definí y hacé seguimiento de las acciones de mejora.", "Define and track improvement actions.")}</p>
        </div>
        {canManage ? (
          <button type="button" onClick={openNew}
            className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
            + {L("Nuevo plan", "New plan")}
          </button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={L("Planes activos", "Active plans")} value={stats.active}/>
        <StatCard label={L("En seguimiento", "In tracking")} value={stats.tracking}/>
        <StatCard label={L("Completados", "Completed")} value={stats.completed} accent/>
        <StatCard label={L("Vencen esta semana", "Due this week")} value={stats.dueSoon}/>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {!isEmployeeOnly && (
          <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
            value={filters.employeeId} onChange={e => setFilters(f => ({ ...f, employeeId: e.target.value }))}>
            <option value="">{L("Todos los responsables", "All responsible")}</option>
            {employees.map(e => <option key={e._id} value={e._id}>{e.apellido}, {e.nombre}</option>)}
          </select>
        )}
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
          <option value="">{L("Todos los estados", "All statuses")}</option>
          {Object.entries(estadoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filters.employeeId || filters.estado) ? (
          <button type="button" onClick={() => setFilters({ employeeId: "", estado: "", prioridad: "" })}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/5">
            {L("Limpiar", "Clear")}
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-x-auto">
        {isLoading ? (
          <LoadingState compact title={L("Cargando planes…", "Loading plans…")} description=""/>
        ) : error ? (
          <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error} actionLabel={L("Reintentar", "Retry")} onAction={() => { const ctrl = new AbortController(); loadPlans(ctrl.signal); }}/>
        ) : filtered.length === 0 ? (
          <EmptyState compact
            title={plans.length === 0 ? L("Sin planes aún", "No plans yet") : L("Sin resultados", "No results")}
            description={plans.length === 0 ? L("Creá el primer plan de acción.", "Create the first action plan.") : L("Ajustá los filtros.", "Adjust the filters.")}
            actionLabel={canManage && plans.length === 0 ? L("+ Nuevo plan", "+ New plan") : ""}
            onAction={canManage && plans.length === 0 ? openNew : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {[L("Plan", "Plan"), !isEmployeeOnly && L("Colaborador", "Collaborator"), L("Habilidad / acción", "Skill / action"), L("Fecha objetivo", "Target date"), L("Progreso", "Progress"), L("Estado", "Status"), canManage && L("Acciones", "Actions")].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(plan => {
                  const emp = plan.employeeId;
                  const empName = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : "—";
                  const dueDate = plan.fechaSeguimiento ? new Date(plan.fechaSeguimiento).toLocaleDateString(language === "en" ? "en-US" : "es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  return (
                    <tr key={plan._id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-medium text-white truncate">{plan.aspectoDesarrollar || "—"}</p>
                        {plan.medicion ? <p className="mt-0.5 text-xs text-[#7f99a8] truncate">{plan.medicion}</p> : null}
                      </td>
                      {!isEmployeeOnly ? (
                        <td className="px-4 py-3">
                          <p className="text-[#c7d5dc]">{empName}</p>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-[#9fb6c4] truncate text-xs">{plan.medicion || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-[#9fb6c4] text-xs whitespace-nowrap">{dueDate}</td>
                      <td className="px-4 py-3 min-w-[120px]"><ProgressBar value={plan.progreso}/></td>
                      <td className="px-4 py-3"><StatusBadge estado={plan.estado} language={language}/></td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openEdit(plan)}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#c7d5dc] transition hover:bg-white/5">
                              {L("Editar", "Edit")}
                            </button>
                            <button type="button" onClick={() => setConfirmState({ open: true, plan })}
                              className="rounded-lg border border-rose-300/30 px-2.5 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10">
                              {L("Eliminar", "Delete")}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{modal.editId ? L("Editar plan", "Edit plan") : L("Nuevo plan de acción", "New action plan")}</h3>
              <button type="button" onClick={() => setModal({ open: false, editId: "" })}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Colaborador", "Collaborator")}</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                  value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{L("Seleccioná un empleado", "Select an employee")}</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.apellido}, {e.nombre}</option>)}
                </select>
              </div>
              {/* Suggest from evaluation — only visible when creating a new plan for a specific employee */}
              {!modal.editId && form.employeeId && closedEvals.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#091319] p-3 space-y-2">
                  <p className="text-xs font-semibold text-[#14b8a6]">{L("Sugerir plan desde evaluación", "Suggest plan from evaluation")}</p>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 rounded-xl border border-white/10 bg-[#12222d] px-3 py-2 text-sm text-white outline-none"
                      value={selectedEvalForSuggestion}
                      onChange={e => { setSelectedEvalForSuggestion(e.target.value); setSuggestions([]); }}>
                      <option value="">{L("Elegí una evaluación cerrada", "Select a closed evaluation")}</option>
                      {closedEvals.map(ev => (
                        <option key={ev._id} value={ev._id}>
                          {ev.tipo || "Evaluación"} — {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString(language === "en" ? "en-US" : "es-AR", { day: "2-digit", month: "short", year: "numeric" }) : ev._id}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={!selectedEvalForSuggestion || isFetchingSuggestions}
                      onClick={handleLoadSuggestions}
                      className="rounded-xl bg-[#14b8a6] px-3 py-2 text-xs font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-50 whitespace-nowrap">
                      {isFetchingSuggestions ? L("Cargando…", "Loading…") : L("Cargar", "Load")}
                    </button>
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#7f99a8]">{L("Métricas débiles — elegí una para precargar:", "Weak metrics — pick one to pre-fill:")}</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map(s => (
                          <button key={s.metricId} type="button" onClick={() => applySuggestion(s)}
                            className="rounded-full border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-3 py-1 text-xs text-[#14b8a6] transition hover:bg-[#14b8a6]/20">
                            {s.metricNombre} <span className="text-white/40">({s.nivel}/5)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Plan / aspecto a desarrollar *", "Plan / aspect to develop *")}</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                  placeholder={L("Ej: Coaching de liderazgo", "E.g. Leadership coaching")}
                  value={form.aspectoDesarrollar} onChange={e => setForm(f => ({ ...f, aspectoDesarrollar: e.target.value }))}/>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Descripción / habilidad asociada", "Description / associated skill")}</label>
                <textarea className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none min-h-16 resize-none"
                  placeholder={L("Describí la acción o habilidad…", "Describe the action or skill…")}
                  value={form.medicion} onChange={e => setForm(f => ({ ...f, medicion: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Estado", "Status")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {Object.entries(estadoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Fecha objetivo", "Target date")}</label>
                  <input type="date" className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.fechaSeguimiento} onChange={e => setForm(f => ({ ...f, fechaSeguimiento: e.target.value }))}/>
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs text-[#7f99a8]">
                  <span>{L("Progreso", "Progress")}</span>
                  <span className="text-[#14b8a6] font-semibold">{form.progreso}%</span>
                </label>
                <input type="range" min="0" max="100" step="5"
                  className="w-full accent-[#14b8a6]"
                  value={form.progreso} onChange={e => setForm(f => ({ ...f, progreso: Number(e.target.value) }))}/>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal({ open: false, editId: "" })}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5">
                  {L("Cancelar", "Cancel")}
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
                  {isSubmitting ? L("Guardando…", "Saving…") : modal.editId ? L("Guardar cambios", "Save changes") : L("Crear plan", "Create plan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        title={L("¿Eliminar este plan?", "Delete this plan?")}
        message={confirmState.plan ? `${L("Vas a eliminar", "You're deleting")} "${confirmState.plan.aspectoDesarrollar}".` : ""}
        confirmLabel={L("Eliminar", "Delete")}
        cancelLabel={L("Cancelar", "Cancel")}
        destructive loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, plan: null })}
        onConfirm={handleDelete}
      />
    </div>
  );
}
