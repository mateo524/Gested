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
function EmployeeView({ token, language, searchQuery, user }) {
  const L = (es, en) => language === "en" ? en : es;
  const { addToast } = useToast();
  const [evaluations, setEvaluations] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvalId, setSelectedEvalId] = useState(null);
  const [evalDetail, setEvalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeCycleTab, setActiveCycleTab] = useState("all");
  const [isCreating, setIsCreating] = useState(false);

  const loadEvals = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
      const [evals, met, cyc] = await Promise.all([
        apiFetch("/evaluations", { token, signal }),
        apiFetch("/metrics", { token, signal }).catch(() => []),
        apiFetch("/evaluation-cycles", { token, signal }).catch(() => []),
      ]);
      setEvaluations(evals);
      setMetrics(met || []);
      setCycles(cyc || []);
      // Prefer autoevaluacion, else first
      const self = evals.find(e => e.tipo === "AUTOEVALUACION");
      const toSelect = self?._id || evals[0]?._id || null;
      setSelectedEvalId(prev => prev || toSelect);
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadEvals(ctrl.signal);
    return () => ctrl.abort();
  }, [loadEvals]);

  useEffect(() => {
    if (!selectedEvalId) { setEvalDetail(null); return; }
    const ctrl = new AbortController();
    setLoadingDetail(true);
    apiFetch(`/evaluations/${selectedEvalId}`, { token, signal: ctrl.signal })
      .then(data => {
        if (!ctrl.signal.aborted) {
          // backend returns { evaluation, scores } or just the evaluation object
          if (data?.evaluation) setEvalDetail(data);
          else setEvalDetail({ evaluation: data, scores: data?.scores || [] });
        }
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoadingDetail(false); });
    return () => ctrl.abort();
  }, [selectedEvalId, token]);

  const metricMap = useMemo(() => new Map(metrics.map(m => [String(m._id), m])), [metrics]);
  const selfEval = useMemo(() => evaluations.find(e => e.tipo === "AUTOEVALUACION"), [evaluations]);
  const activeCycle = useMemo(() => cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null, [cycles]);

  async function handleStartSelfEval() {
    if (!activeCycle) { addToast({ message: L("No hay un ciclo activo.", "No active cycle."), type: "warning" }); return; }
    try {
      setIsCreating(true);
      await apiFetch("/evaluations", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user?.employeeId, cycleId: activeCycle._id, tipo: "AUTOEVALUACION" }),
      });
      addToast({ message: L("Autoevaluación iniciada.", "Self-evaluation started."), type: "success" });
      setSelectedEvalId(null);
      const ctrl = new AbortController();
      await loadEvals(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  const filteredEvals = useMemo(() => {
    if (activeCycleTab === "all") return evaluations;
    return evaluations.filter(ev => {
      const cycle = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId));
      return cycle?.estado?.toLowerCase() === activeCycleTab.toLowerCase();
    });
  }, [evaluations, cycles, activeCycleTab]);

  const scores = evalDetail?.scores || [];

  const visibleScores = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    if (!term) return scores;
    return scores.filter(s => {
      const m = metricMap.get(String(s.metricId?._id || s.metricId));
      return m && [m.nombre, m.descripcion].filter(Boolean).some(v => v.toLowerCase().includes(term));
    });
  }, [scores, metricMap, searchQuery]);

  const statsFromEval = useMemo(() => {
    const completed = scores.filter(s => s.nivel != null && s.nivel > 0).length;
    const avg = completed ? (scores.reduce((sum, s) => sum + (s.nivel || 0), 0) / completed).toFixed(1) : "—";
    return { total: scores.length, completed, inProgress: scores.filter(s => !s.nivel).length, avg };
  }, [scores]);

  if (isLoading) return <LoadingState compact title={L("Cargando tu evaluación…", "Loading your evaluation…")} description=""/>;
  if (error) return <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error}/>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Ciclo activo", "Active cycle")}</p>
        <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Mi evaluación", "My Evaluation")}</h2>
        <p className="mt-1 text-sm text-[#7f99a8]">{activeCycle ? `${activeCycle.periodo} — ${activeCycle.estado}` : L("Sin ciclo activo", "No active cycle")}</p>
      </div>

      {/* CTA autoevaluación */}
      {!selfEval ? (
        <div className="rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/8 px-5 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{L("Completá tu autoevaluación", "Complete your self-evaluation")}</p>
            <p className="mt-0.5 text-xs text-[#9ecfcc]">{L("No iniciaste tu autoevaluación para el ciclo activo.", "You haven't started your self-evaluation for the active cycle.")}</p>
          </div>
          <button type="button" onClick={handleStartSelfEval} disabled={isCreating || !activeCycle}
            className="shrink-0 rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
            {isCreating ? L("Iniciando…", "Starting…") : L("Iniciar autoevaluación", "Start self-evaluation")}
          </button>
        </div>
      ) : selfEval.estado === "BORRADOR" ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{L("Autoevaluación en curso", "Self-evaluation in progress")}</p>
            <p className="mt-0.5 text-xs text-amber-200/80">{L("Tenés cambios sin enviar. Completá y enviá tu autoevaluación.", "You have unsent changes. Complete and submit.")}</p>
          </div>
          <button type="button" onClick={() => setSelectedEvalId(selfEval._id)}
            className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25">
            {L("Continuar", "Continue")}
          </button>
        </div>
      ) : null}

      {/* Stats */}
      {evalDetail && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={L("Habilidades evaluadas", "Skills evaluated")} value={statsFromEval.total}/>
          <StatCard label={L("Completadas", "Completed")} value={statsFromEval.completed} accent/>
          <StatCard label={L("En progreso", "In progress")} value={statsFromEval.inProgress}/>
          <StatCard label={L("Promedio actual", "Current avg")} value={statsFromEval.avg}/>
        </div>
      )}

      {/* Cycle tabs */}
      {evaluations.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-[#7f99a8] mr-1">{L("Ciclo:", "Cycle:")}</p>
          {[{ key: "all", label: L("Todos", "All") }, { key: "Inicio", label: L("Inicio", "Start") }, { key: "Midterm", label: "Midterm" }, { key: "Final", label: "Final" }].map(tab => (
            <button key={tab.key} type="button" onClick={() => setActiveCycleTab(tab.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${activeCycleTab === tab.key ? "bg-[#14b8a6] text-[#0f172a]" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Eval selector cuando hay múltiples */}
      {filteredEvals.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {filteredEvals.map(ev => {
            const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || "—";
            const tipoLabel = (language === "en" ? TIPO_LABELS_EN : TIPO_LABELS_ES)[ev.tipo] || ev.tipo;
            return (
              <button key={ev._id} type="button" onClick={() => setSelectedEvalId(ev._id)}
                className={`rounded-xl px-3 py-2 text-sm transition ${selectedEvalId === ev._id ? "bg-[#14b8a6] text-[#0f172a] font-semibold" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
                {tipoLabel} · {cycleLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      {evalDetail && (
        <div className="rounded-xl border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-4 py-3 text-sm text-[#9ecfcc]">
          {L("Las habilidades base son comunes para todas las áreas y empleados.", "Base skills are shared across all areas and employees.")}
        </div>
      )}

      {/* Skills table */}
      {selectedEvalId ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
          {loadingDetail ? (
            <LoadingState compact title={L("Cargando habilidades…", "Loading skills…")} description=""/>
          ) : !evalDetail || !scores.length ? (
            <EmptyState compact title={L("Sin habilidades asignadas", "No skills assigned")} description={L("No hay habilidades en este ciclo todavía.", "No skills in this cycle yet.")}/>
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
                    const catLabel = (language === "en" ? TIPO_TO_CATEGORIA_EN : TIPO_TO_CATEGORIA_ES)[m?.tipo] || "—";
                    const nivelLabel = (language === "en" ? COMPONENTE_TO_NIVEL_EN : COMPONENTE_TO_NIVEL_ES)[m?.componente] || "—";
                    const hasResult = score.nivel != null && score.nivel > 0;
                    return (
                      <tr key={String(score._id || score.metricId?._id || score.metricId)} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-medium text-white">{m?.nombre || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#9fb6c4]">{catLabel}</td>
                        <td className="px-4 py-3 max-w-xs"><p className="text-[#9fb6c4] truncate text-xs">{m?.descripcion || "—"}</p></td>
                        <td className="px-4 py-3 text-[#c7d5dc]">{nivelLabel}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${hasResult ? "bg-emerald-500/15 text-emerald-200" : "bg-sky-500/15 text-sky-200"}`}>
                            {hasResult ? L("Completada", "Completed") : L("En progreso", "In progress")}
                          </span>
                        </td>
                        <td className="px-4 py-3">{hasResult ? <span className="font-semibold text-[#14b8a6]">{score.nivel}</span> : <span className="text-[#5e7d8e]">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : evaluations.length === 0 ? (
        <EmptyState compact
          title={L("Sin evaluaciones aún", "No evaluations yet")}
          description={L("Cuando tu jefe cree una evaluación aparecerá aquí.", "When your manager creates an evaluation it will appear here.")}
        />
      ) : null}
    </div>
  );
}

// ---- Manager/Admin view ----
function ManagerView({ token, language, searchQuery, user }) {
  const L = (es, en) => language === "en" ? en : es;
  const { addToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ cicloId: "", area: "", estado: "" });
  const [activeCycleTab, setActiveCycleTab] = useState("all");
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", cycleId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selfEmployeeId = String(user?.employeeId || "");

  const activeCycle = useMemo(() =>
    cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null
  , [cycles]);

  const loadData = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
      // includeSelf=true → backend adds the manager's own employee record to the list
      const [emp, cyc, evals] = await Promise.all([
        apiFetch("/employees?includeSelf=true", { token, signal }),
        apiFetch("/evaluation-cycles", { token, signal }),
        apiFetch("/evaluations", { token, signal }),
      ]);
      setEmployees(emp);
      setCycles(cyc);
      setEvaluations(evals);
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

  // Auto-set cycle once loaded
  useEffect(() => {
    if (activeCycle) setForm(f => f.cycleId ? f : { ...f, cycleId: activeCycle._id });
  }, [activeCycle]);

  const stats = useMemo(() => {
    const active = evaluations.filter(e => e.estado !== "CERRADA").length;
    const pending = evaluations.filter(e => e.estado === "BORRADOR").length;
    const completed = evaluations.filter(e => e.estado === "CERRADA").length;
    const results = evaluations.filter(e => e.resultadoFinal != null).map(e => e.resultadoFinal);
    const avg = results.length ? (results.reduce((s, v) => s + v, 0) / results.length).toFixed(1) : "—";
    return { active, pending, completed, avg };
  }, [evaluations]);

  const areaOptions = useMemo(() => [...new Set(employees.map(e => e.area).filter(Boolean))].sort(), [employees]);

  const selectedIsSelf = Boolean(form.employeeId && form.employeeId === selfEmployeeId);
  const derivedTipo = selectedIsSelf ? "AUTOEVALUACION" : "JEFATURA";
  const tipoLabels = language === "en" ? TIPO_LABELS_EN : TIPO_LABELS_ES;
  const estadoLabels = language === "en" ? ESTADO_LABELS_EN : ESTADO_LABELS_ES;

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
    if (!form.employeeId) { addToast({ message: L("Seleccioná una persona.", "Select a person."), type: "warning" }); return; }
    if (!activeCycle) { addToast({ message: L("No hay un ciclo activo.", "No active cycle."), type: "warning" }); return; }
    try {
      setIsSubmitting(true);
      await apiFetch("/evaluations", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: form.employeeId, cycleId: activeCycle._id, tipo: derivedTipo }),
      });
      setNewModal(false);
      setForm(f => ({ ...f, employeeId: "" }));
      addToast({ message: L("Evaluación creada.", "Evaluation created."), type: "success" });
      const ctrl = new AbortController();
      loadData(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Ciclos de evaluación", "Evaluation cycles")}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Evaluaciones", "Evaluations")}</h2>
          <p className="mt-1 text-sm text-[#7f99a8]">
            {activeCycle ? `${L("Ciclo activo:", "Active cycle:")} ${activeCycle.periodo}` : L("Sin ciclo activo.", "No active cycle.")}
          </p>
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
          <button key={tab.key} type="button" onClick={() => setActiveCycleTab(tab.key)}
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
          <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error} actionLabel={L("Reintentar", "Retry")} onAction={() => { const ctrl = new AbortController(); loadData(ctrl.signal); }}/>
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
                  {[L("Persona evaluada", "Evaluated person"), L("Tipo", "Type"), L("Ciclo", "Cycle"), L("Estado", "Status"), L("Resultado", "Result"), L("Acciones", "Actions")].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(ev => {
                  const emp = ev.employeeId;
                  const name = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : "—";
                  const isSelfEval = String(emp?._id || emp) === selfEmployeeId;
                  const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || ev.cycleId?.periodo || "—";
                  return (
                    <tr key={ev._id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{name}</p>
                          {isSelfEval ? <span className="rounded-full bg-[#14b8a6]/15 px-2 py-0.5 text-[10px] font-medium text-[#14b8a6]">{L("Yo", "Me")}</span> : null}
                        </div>
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
              <button type="button" onClick={() => { setNewModal(false); setForm(f => ({ ...f, employeeId: "" })); }}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Persona a evaluar */}
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Persona a evaluar *", "Person to evaluate *")}</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                  value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">{L("Seleccioná una persona", "Select a person")}</option>
                  {employees.map(e => (
                    <option key={e._id} value={e._id}>
                      {e.apellido}, {e.nombre}{String(e._id) === selfEmployeeId ? ` (${L("Yo", "Me")})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo derivado — informativo */}
              {form.employeeId ? (
                <div className="rounded-xl border border-white/10 bg-[#12222d]/60 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-[#7f99a8]">{L("Tipo de evaluación", "Evaluation type")}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${selectedIsSelf ? "bg-violet-500/20 text-violet-200" : "bg-sky-500/20 text-sky-200"}`}>
                    {tipoLabels[derivedTipo]}
                  </span>
                </div>
              ) : null}

              {/* Ciclo activo — solo informativo */}
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Ciclo", "Cycle")}</label>
                <div className="rounded-xl border border-white/10 bg-[#12222d]/60 px-3 py-2.5 text-sm text-white">
                  {activeCycle
                    ? <span>{activeCycle.periodo} <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">{activeCycle.estado}</span></span>
                    : <span className="text-[#5e7d8e]">{L("Sin ciclo activo", "No active cycle")}</span>
                  }
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setNewModal(false); setForm(f => ({ ...f, employeeId: "" })); }}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5">
                  {L("Cancelar", "Cancel")}
                </button>
                <button type="submit" disabled={isSubmitting || !form.employeeId || !activeCycle}
                  className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
                  {isSubmitting ? L("Creando…", "Creating…") : L("Crear evaluación", "Create evaluation")}
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
  const { token, user } = useAuth();
  const { language, searchQuery } = useView();

  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployeeOnly = isEmployee && !isManager && !isSuperAdmin;

  if (isEmployeeOnly) {
    return <EmployeeView token={token} language={language} searchQuery={searchQuery} user={user}/>;
  }
  return <ManagerView token={token} language={language} searchQuery={searchQuery} user={user}/>;
}
