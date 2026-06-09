import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";

const TIPO_LABELS_ES = { AUTOEVALUACION: "Autoevaluación", JEFATURA: "Jefatura", FINAL: "Cierre final", EVALUACION_360: "360°" };
const TIPO_LABELS_EN = { AUTOEVALUACION: "Self-evaluation", JEFATURA: "Manager review", FINAL: "Final review", EVALUACION_360: "360°" };
const ESTADO_LABELS_ES = { BORRADOR: "Borrador", ENVIADA: "Enviada", REVISADA: "Revisada", CERRADA: "Cerrada" };
const ESTADO_LABELS_EN = { BORRADOR: "Draft", ENVIADA: "Submitted", REVISADA: "Reviewed", CERRADA: "Closed" };

const COMPONENTE_TO_NIVEL_ES = { C: "Básico", A: "Intermedio", H: "Avanzado" };
const COMPONENTE_TO_NIVEL_EN = { C: "Basic", A: "Intermediate", H: "Advanced" };
const TIPO_TO_CATEGORIA_ES = { TRANSVERSAL: "Blanda", DOCENTE: "Blanda", LIDERAZGO: "Blanda", PERSONALIZADA: "Técnica" };
const TIPO_TO_CATEGORIA_EN = { TRANSVERSAL: "Soft", DOCENTE: "Soft", LIDERAZGO: "Soft", PERSONALIZADA: "Technical" };

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
  const cls = estado === "CERRADA" ? "bg-emerald-500/15 text-emerald-200"
    : estado === "ENVIADA" ? "bg-sky-500/15 text-sky-200"
    : estado === "REVISADA" ? "bg-violet-500/15 text-violet-200"
    : "bg-white/10 text-[#c7d5dc]";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

// ---- Employee view ----
function EmployeeView({ token, language, searchQuery }) {
  const L = (es, en) => language === "en" ? en : es;
  const [evaluations, setEvaluations] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvalId, setSelectedEvalId] = useState(null);
  const [evalDetail, setEvalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedCycleFilter, setSelectedCycleFilter] = useState("all");

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setIsLoading(true); setError("");
        const [evals, met, cyc] = await Promise.all([
          apiFetch("/evaluations", { token, signal: ctrl.signal }),
          apiFetch("/metrics", { token, signal: ctrl.signal }).catch(() => []),
          apiFetch("/evaluation-cycles", { token, signal: ctrl.signal }).catch(() => []),
        ]);
        setEvaluations(evals);
        setMetrics(met || []);
        setCycles(cyc || []);
        // Auto-select first evaluation
        if (evals.length && !selectedEvalId) setSelectedEvalId(evals[0]._id);
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEvalId) return;
    const ctrl = new AbortController();
    setLoadingDetail(true);
    apiFetch(`/evaluations/${selectedEvalId}`, { token, signal: ctrl.signal })
      .then(data => { if (!ctrl.signal.aborted) setEvalDetail(data); })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoadingDetail(false); });
    return () => ctrl.abort();
  }, [selectedEvalId, token]);

  const metricMap = useMemo(() => new Map(metrics.map(m => [m._id, m])), [metrics]);

  const filteredEvals = useMemo(() => {
    if (selectedCycleFilter === "all") return evaluations;
    return evaluations.filter(ev => {
      const cycle = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId));
      return cycle?.estado?.toLowerCase() === selectedCycleFilter.toLowerCase() || cycle?.periodo?.toLowerCase().includes(selectedCycleFilter.toLowerCase());
    });
  }, [evaluations, cycles, selectedCycleFilter]);

  const stats = useMemo(() => {
    const scores = evalDetail?.scores || [];
    const completed = scores.filter(s => s.nivel != null && s.nivel > 0).length;
    const avg = completed ? (scores.reduce((sum, s) => sum + (s.nivel || 0), 0) / completed).toFixed(1) : "—";
    return { total: scores.length, completed, inProgress: scores.filter(s => !s.nivel).length, avg };
  }, [evalDetail]);

  const visibleScores = useMemo(() => {
    const scores = evalDetail?.scores || [];
    const term = (searchQuery || "").trim().toLowerCase();
    if (!term) return scores;
    return scores.filter(s => {
      const m = metricMap.get(String(s.metricId?._id || s.metricId));
      return m && [m.nombre, m.descripcion].filter(Boolean).some(v => v.toLowerCase().includes(term));
    });
  }, [evalDetail, metricMap, searchQuery]);

  if (isLoading) return <LoadingState compact title={L("Cargando tu evaluación…", "Loading your evaluation…")} description=""/>;
  if (error) return <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error}/>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Ciclo activo", "Active cycle")}</p>
        <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Mi evaluación", "My Evaluation")}</h2>
        <p className="mt-1 text-sm text-[#7f99a8]">{L("Estas son las habilidades que se están evaluando en tu ciclo actual.", "These are the skills being evaluated in your current cycle.")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={L("Habilidades evaluadas", "Skills evaluated")} value={stats.total}/>
        <StatCard label={L("Completadas", "Completed")} value={stats.completed} accent/>
        <StatCard label={L("En progreso", "In progress")} value={stats.inProgress}/>
        <StatCard label={L("Promedio actual", "Current avg")} value={stats.avg}/>
      </div>

      {/* Cycle selector */}
      {evaluations.length > 1 && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-[#7f99a8] mr-1">{L("Ciclo:", "Cycle:")}</p>
          {[{ key: "all", label: L("Todos", "All") }, { key: "Inicio", label: L("Inicio", "Start") }, { key: "Midterm", label: "Midterm" }, { key: "Final", label: "Final" }].map(tab => (
            <button key={tab.key} type="button"
              onClick={() => setSelectedCycleFilter(tab.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${selectedCycleFilter === tab.key ? "bg-[#14b8a6] text-[#0f172a]" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Evaluation selector when multiple */}
      {filteredEvals.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {filteredEvals.map(ev => {
            const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || "—";
            const tipoLabel = (language === "en" ? TIPO_LABELS_EN : TIPO_LABELS_ES)[ev.tipo] || ev.tipo;
            return (
              <button key={ev._id} type="button"
                onClick={() => setSelectedEvalId(ev._id)}
                className={`rounded-xl px-3 py-2 text-sm transition ${selectedEvalId === ev._id ? "bg-[#14b8a6] text-[#0f172a] font-semibold" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
                {tipoLabel} · {cycleLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-xl border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-4 py-3 text-sm text-[#9ecfcc]">
        {L("Las habilidades base son comunes para todas las áreas y empleados. Algunas habilidades adicionales pueden aplicarse a áreas específicas.", "Base skills are shared across all areas and employees. Some additional skills may apply to specific areas.")}
      </div>

      {/* Skills table */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
        {loadingDetail ? (
          <LoadingState compact title={L("Cargando habilidades…", "Loading skills…")} description=""/>
        ) : !evalDetail || !evalDetail.scores?.length ? (
          <EmptyState compact title={L("Sin habilidades evaluadas", "No skills evaluated")} description={L("No hay habilidades asignadas en este ciclo.", "No skills assigned in this cycle.")}/>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {[L("Habilidad", "Skill"), L("Categoría", "Category"), L("Descripción", "Description"), L("Nivel esperado", "Expected level"), L("Estado", "Status"), L("Resultado", "Result")].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleScores.map(score => {
                  const m = metricMap.get(String(score.metricId?._id || score.metricId));
                  const tipoMap = language === "en" ? TIPO_TO_CATEGORIA_EN : TIPO_TO_CATEGORIA_ES;
                  const catLabel = m ? (tipoMap[m.tipo] || "—") : "—";
                  const nivelMap = language === "en" ? COMPONENTE_TO_NIVEL_EN : COMPONENTE_TO_NIVEL_ES;
                  const nivelLabel = m ? (nivelMap[m.componente] || "—") : "—";
                  const hasResult = score.nivel != null && score.nivel > 0;
                  const statusLabel = hasResult ? L("Completada", "Completed") : L("En progreso", "In progress");
                  const statusCls = hasResult ? "bg-emerald-500/15 text-emerald-200" : "bg-sky-500/15 text-sky-200";
                  return (
                    <tr key={String(score.metricId?._id || score.metricId || Math.random())} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-medium text-white">{m?.nombre || "—"}</td>
                      <td className="px-4 py-3"><span className="text-[#9fb6c4] text-xs">{catLabel}</span></td>
                      <td className="px-4 py-3 max-w-xs"><p className="text-[#9fb6c4] truncate text-xs">{m?.descripcion || "—"}</p></td>
                      <td className="px-4 py-3 text-[#c7d5dc]">{nivelLabel}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusCls}`}>{statusLabel}</span></td>
                      <td className="px-4 py-3">{hasResult ? <span className="font-semibold text-[#14b8a6]">{score.nivel}</span> : <span className="text-[#5e7d8e]">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Manager/Admin view ----
function ManagerView({ token, language, searchQuery, hasPermission }) {
  const L = (es, en) => language === "en" ? en : es;
  const { addToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ cicloId: "", area: "", estado: "" });
  const [activeCycleTab, setActiveCycleTab] = useState("all");
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", cycleId: "", tipo: "AUTOEVALUACION", estado: "BORRADOR", comentariosGenerales: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const loadData = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
      const [emp, cyc, met, evals] = await Promise.all([
        apiFetch("/employees", { token, signal }),
        apiFetch("/evaluation-cycles", { token, signal }),
        apiFetch("/metrics", { token, signal }).catch(() => []),
        apiFetch("/evaluations", { token, signal }),
      ]);
      setEmployees(emp); setCycles(cyc); setMetrics(met || []);
      setEvaluations(evals);
      const active = cyc.find(c => c.estado === "Inicio" || c.estado === "Activo");
      if (active) setForm(f => ({ ...f, cycleId: active._id }));
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  const stats = useMemo(() => {
    const active = evaluations.filter(e => e.estado !== "CERRADA").length;
    const pending = evaluations.filter(e => e.estado === "BORRADOR").length;
    const completed = evaluations.filter(e => e.estado === "CERRADA").length;
    const results = evaluations.filter(e => e.resultadoFinal != null).map(e => e.resultadoFinal);
    const avg = results.length ? (results.reduce((s, v) => s + v, 0) / results.length).toFixed(1) : "—";
    return { active, pending, completed, avg };
  }, [evaluations]);

  const areaOptions = useMemo(() => [...new Set(employees.map(e => e.area).filter(Boolean))].sort(), [employees]);

  const filtered = useMemo(() => {
    let list = evaluations;
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) list = list.filter(e => [e.employeeId?.nombre, e.employeeId?.apellido, e.cycleId?.periodo, e.tipo, e.estado].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    if (filters.cicloId) list = list.filter(e => String(e.cycleId?._id || e.cycleId) === filters.cicloId);
    if (filters.area) list = list.filter(e => {
      const emp = employees.find(em => String(em._id) === String(e.employeeId?._id || e.employeeId));
      return emp?.area === filters.area;
    });
    if (filters.estado) list = list.filter(e => e.estado === filters.estado);
    if (activeCycleTab !== "all") {
      list = list.filter(e => {
        const cycle = cycles.find(c => String(c._id) === String(e.cycleId?._id || e.cycleId));
        return cycle?.estado?.toLowerCase() === activeCycleTab.toLowerCase();
      });
    }
    return list;
  }, [evaluations, filters, searchQuery, activeCycleTab, cycles, employees]);

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.employeeId) errs.employeeId = L("Requerido", "Required");
    if (!form.cycleId) errs.cycleId = L("Requerido", "Required");
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    try {
      setIsSubmitting(true);
      await apiFetch("/evaluations", { method: "POST", token, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setNewModal(false);
      setForm(f => ({ ...f, employeeId: "", tipo: "AUTOEVALUACION", estado: "BORRADOR", comentariosGenerales: "" }));
      addToast({ message: L("Evaluación creada.", "Evaluation created."), type: "success" });
      const ctrl = new AbortController();
      loadData(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const tipoLabels = language === "en" ? TIPO_LABELS_EN : TIPO_LABELS_ES;
  const estadoLabels = language === "en" ? ESTADO_LABELS_EN : ESTADO_LABELS_ES;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Ciclos de evaluación", "Evaluation cycles")}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Evaluaciones", "Evaluations")}</h2>
          <p className="mt-1 text-sm text-[#7f99a8]">{L("Gestioná las evaluaciones por ciclo y hacé seguimiento del avance.", "Manage evaluations by cycle and track progress.")}</p>
        </div>
        <button type="button" onClick={() => setNewModal(true)}
          className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
          + {L("Nueva evaluación", "New evaluation")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={L("Evaluaciones activas", "Active evaluations")} value={stats.active}/>
        <StatCard label={L("Pendientes", "Pending")} value={stats.pending}/>
        <StatCard label={L("Completadas", "Completed")} value={stats.completed} accent/>
        <StatCard label={L("Promedio general", "Overall avg")} value={stats.avg}/>
      </div>

      {/* Cycle tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: "all", label: L("Todos", "All") }, { key: "inicio", label: L("Inicio", "Start") }, { key: "midterm", label: "Midterm" }, { key: "final", label: "Final" }].map(tab => (
          <button key={tab.key} type="button"
            onClick={() => setActiveCycleTab(tab.key)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${activeCycleTab === tab.key ? "bg-[#14b8a6] text-[#0f172a]" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.cicloId} onChange={e => setFilters(f => ({ ...f, cicloId: e.target.value }))}>
          <option value="">{L("Todos los ciclos", "All cycles")}</option>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.periodo} — {c.estado}</option>)}
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.area} onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}>
          <option value="">{L("Todas las áreas", "All areas")}</option>
          {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
          <option value="">{L("Todos los estados", "All statuses")}</option>
          {Object.entries(estadoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filters.cicloId || filters.area || filters.estado) ? (
          <button type="button" onClick={() => setFilters({ cicloId: "", area: "", estado: "" })}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/5">
            {L("Limpiar", "Clear")}
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
        {isLoading ? (
          <LoadingState compact title={L("Cargando evaluaciones…", "Loading evaluations…")} description=""/>
        ) : error ? (
          <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error} actionLabel={L("Reintentar", "Retry")} onAction={() => loadData()}/>
        ) : filtered.length === 0 ? (
          <EmptyState compact
            title={evaluations.length === 0 ? L("Sin evaluaciones aún", "No evaluations yet") : L("Sin resultados", "No results")}
            description={evaluations.length === 0 ? L("Creá la primera evaluación.", "Create the first evaluation.") : L("Ajustá los filtros.", "Adjust the filters.")}
            actionLabel={evaluations.length === 0 ? L("+ Nueva evaluación", "+ New evaluation") : ""}
            onAction={evaluations.length === 0 ? () => setNewModal(true) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {[L("Colaborador", "Collaborator"), L("Tipo", "Type"), L("Ciclo", "Cycle"), L("Estado", "Status"), L("Resultado", "Result"), L("Acciones", "Actions")].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(ev => {
                  const emp = ev.employeeId;
                  const name = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : "—";
                  const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || ev.cycleId?.periodo || "—";
                  return (
                    <tr key={ev._id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{name}</p>
                        {emp?.area ? <p className="text-xs text-[#7f99a8]">{emp.area}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-[#c7d5dc]">{tipoLabels[ev.tipo] || ev.tipo}</td>
                      <td className="px-4 py-3 text-[#9fb6c4]">{cycleLabel}</td>
                      <td className="px-4 py-3"><StatusBadge estado={ev.estado} language={language}/></td>
                      <td className="px-4 py-3">{ev.resultadoFinal != null ? <span className="font-semibold text-[#14b8a6]">{ev.resultadoFinal}</span> : <span className="text-[#5e7d8e]">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#9fb6c4]">{L("Ver", "View")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New evaluation modal */}
      {newModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{L("Nueva evaluación", "New evaluation")}</h3>
              <button type="button" onClick={() => setNewModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Colaborador *", "Collaborator *")}</label>
                <select className={`w-full rounded-xl border ${fieldErrors.employeeId ? "border-rose-400/60" : "border-white/10"} bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none`}
                  value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{L("Seleccioná un empleado", "Select an employee")}</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.apellido}, {e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Ciclo *", "Cycle *")}</label>
                <select className={`w-full rounded-xl border ${fieldErrors.cycleId ? "border-rose-400/60" : "border-white/10"} bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none`}
                  value={form.cycleId} onChange={e => setForm(f => ({ ...f, cycleId: e.target.value }))}>
                  <option value="">{L("Seleccioná un ciclo", "Select a cycle")}</option>
                  {cycles.map(c => <option key={c._id} value={c._id}>{c.periodo} — {c.estado}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Tipo", "Type")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {Object.entries(tipoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Estado", "Status")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {Object.entries(estadoLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Comentarios generales", "General comments")}</label>
                <textarea className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none min-h-16 resize-none"
                  placeholder={L("Observaciones…", "Observations…")}
                  value={form.comentariosGenerales} onChange={e => setForm(f => ({ ...f, comentariosGenerales: e.target.value }))}/>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setNewModal(false)}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5">
                  {L("Cancelar", "Cancel")}
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
                  {isSubmitting ? L("Guardando…", "Saving…") : L("Crear evaluación", "Create evaluation")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Root export ----
export default function EvaluationsPage() {
  const { token, user, hasPermission } = useAuth();
  const { language, searchQuery } = useView();

  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployeeOnly = isEmployee && !isManager && !isSuperAdmin;

  if (isEmployeeOnly) {
    return <EmployeeView token={token} language={language} searchQuery={searchQuery}/>;
  }
  return <ManagerView token={token} language={language} searchQuery={searchQuery} hasPermission={hasPermission}/>;
}
