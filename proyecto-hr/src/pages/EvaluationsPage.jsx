import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";

const TIPO_LABELS = { AUTOEVALUACION: "Autoevaluación", JEFATURA: "Jefatura", FINAL: "Cierre final", EVALUACION_360: "360°" };
const ESTADO_LABELS = { BORRADOR: "Borrador", ENVIADA: "Enviada", REVISADA: "Revisada", CERRADA: "Cerrada" };

function StatusBadge({ estado }) {
  const label = ESTADO_LABELS[estado] || estado;
  const cls = estado === "CERRADA" ? "bg-emerald-500/15 text-emerald-200"
    : estado === "ENVIADA" ? "bg-sky-500/15 text-sky-200"
    : estado === "REVISADA" ? "bg-violet-500/15 text-violet-200"
    : "bg-white/10 text-[#c7d5dc]";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function StarRow({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={disabled} onClick={() => onChange?.(n)}
          className={`h-7 w-7 flex items-center justify-center rounded-lg text-lg transition
            ${n <= (value || 0) ? "text-[#14b8a6]" : "text-white/20 hover:text-white/50"}
            ${disabled ? "cursor-default" : "hover:scale-110"}`}>
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Eval Detail View (Vista Jefe — side by side) ─────────────────────────────
function EvalDetailView({ evalId, token, onBack, onSaved }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [autoData, setAutoData] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [comentariosGenerales, setComentariosGenerales] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const [detail, met] = await Promise.all([
          apiFetch(`/evaluations/${evalId}`, { token, signal: ctrl.signal }),
          apiFetch("/metrics", { token, signal: ctrl.signal }).catch(() => []),
        ]);
        if (ctrl.signal.aborted) return;
        const ev = detail?.evaluation || detail;
        const sc = detail?.scores || [];
        setData({ evaluation: ev, scores: sc });
        setMetrics(met || []);
        const initS = {}, initC = {};
        sc.forEach(s => {
          const id = String(s.metricId?._id || s.metricId);
          initS[id] = s.nivel || 0;
          initC[id] = s.comentario || "";
        });
        setScores(initS);
        setComments(initC);
        setComentariosGenerales(ev?.comentariosGenerales || "");
        if (ev?.tipo === "JEFATURA" && ev?.employeeId && ev?.cycleId) {
          const empId = ev.employeeId?._id || ev.employeeId;
          const cycId = ev.cycleId?._id || ev.cycleId;
          try {
            const allEvals = await apiFetch(`/evaluations?employeeId=${empId}&cycleId=${cycId}&tipo=AUTOEVALUACION`, { token, signal: ctrl.signal });
            const autoEval = Array.isArray(allEvals) ? allEvals[0] : null;
            if (autoEval?._id) {
              const autoDetail = await apiFetch(`/evaluations/${autoEval._id}`, { token, signal: ctrl.signal });
              if (!ctrl.signal.aborted) setAutoData(autoDetail);
            }
          } catch { /* no auto eval */ }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) addToast({ message: err.message, type: "error" });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [evalId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const metricMap = useMemo(() => new Map(metrics.map(m => [String(m._id), m])), [metrics]);

  const allMetricIds = useMemo(() => {
    const ids = new Set();
    (data?.scores || []).forEach(s => ids.add(String(s.metricId?._id || s.metricId)));
    (autoData?.scores || []).forEach(s => ids.add(String(s.metricId?._id || s.metricId)));
    if (!ids.size) metrics.forEach(m => ids.add(String(m._id)));
    return [...ids];
  }, [data, autoData, metrics]);

  const autoScoreMap = useMemo(() => {
    const m = new Map();
    (autoData?.scores || []).forEach(s => m.set(String(s.metricId?._id || s.metricId), s));
    return m;
  }, [autoData]);

  async function handleSave(submit) {
    const evaluation = data?.evaluation;
    if (!evaluation) return;
    try {
      setSaving(true);
      await apiFetch(`/evaluations/${evaluation._id}`, {
        method: "PUT", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scores: allMetricIds.map(id => ({ metricId: id, nivel: scores[id] || 0, comentario: comments[id] || "" })),
          comentariosGenerales,
          ...(submit ? { estado: "ENVIADA" } : {}),
        }),
      });
      addToast({ message: submit ? "Evaluación enviada." : "Borrador guardado.", type: "success" });
      onSaved?.();
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState compact title="Cargando evaluación…" description=""/>;
  const ev = data?.evaluation;
  if (!ev) return <ErrorState compact title="No encontrada" description=""/>;

  const emp = ev.employeeId;
  const empName = emp ? `${emp.nombre || ""} ${emp.apellido || ""}`.trim() : "—";
  const isJefatura = ev.tipo === "JEFATURA";
  const isReadOnly = ev.estado === "ENVIADA" || ev.estado === "CERRADA";
  const showSideBySide = isJefatura && autoData;

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#c7d5dc] transition hover:bg-white/10">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M10 3L5 8l5 5"/></svg>
          Volver
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white">{empName}</h2>
          <p className="text-xs text-[#7f99a8]">{ev.cycleId?.periodo || "—"} · {TIPO_LABELS[ev.tipo] || ev.tipo}</p>
        </div>
        <StatusBadge estado={ev.estado}/>
        {emp?.cargo ? <span className="hidden sm:block text-xs text-[#9fb6c4]">{emp.cargo}</span> : null}
        {emp?.area ? <span className="hidden sm:block text-xs text-[#7f99a8]">{emp.area}</span> : null}
      </div>

      {showSideBySide && (
        <div className="rounded-xl border border-[#14b8a6]/25 bg-[#14b8a6]/8 px-4 py-2.5 text-sm text-[#9ecfcc]">
          Podés ver la autoevaluación del empleado al costado para hacer una evaluación justa y objetiva.
        </div>
      )}

      {/* Skills grid */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
        {/* Header */}
        <div className={`grid gap-3 border-b border-white/10 px-4 py-3 ${showSideBySide ? "grid-cols-[2fr_1fr_1fr_1.5fr]" : "grid-cols-[2fr_1fr_1.5fr]"}`}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Habilidad</span>
          {showSideBySide && <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-300">Autoevaluación</span>}
          <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isJefatura ? "text-[#14b8a6]" : "text-[#5e7d8e]"}`}>
            {isJefatura ? "Tu evaluación" : "Calificación"}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Notas</span>
        </div>

        {allMetricIds.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#7f99a8]">Sin habilidades asignadas en este ciclo.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {allMetricIds.map(id => {
              const metric = metricMap.get(id);
              const autoScore = autoScoreMap.get(id);
              const autoNivel = autoScore?.nivel || 0;
              const currentNivel = scores[id] || 0;
              const diff = currentNivel && autoNivel ? currentNivel - autoNivel : null;
              return (
                <div key={id} className={`grid items-center gap-3 px-4 py-3 ${showSideBySide ? "grid-cols-[2fr_1fr_1fr_1.5fr]" : "grid-cols-[2fr_1fr_1.5fr]"}`}>
                  <div>
                    <p className="text-sm font-medium text-white">{metric?.nombre || "—"}</p>
                    {metric?.descripcion ? <p className="text-xs text-[#7f99a8] truncate">{metric.descripcion}</p> : null}
                  </div>
                  {showSideBySide && (
                    <div>
                      <StarRow value={autoNivel} disabled/>
                      {autoScore?.comentario ? <p className="text-[11px] text-[#8ea5b3] truncate">{autoScore.comentario}</p> : null}
                    </div>
                  )}
                  <div>
                    <StarRow value={currentNivel}
                      onChange={isReadOnly ? undefined : (n) => setScores(s => ({ ...s, [id]: n }))}
                      disabled={isReadOnly}/>
                    {diff !== null && (
                      <span className={`text-[10px] font-medium ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-[#7f99a8]"}`}>
                        {diff > 0 ? `+${diff}` : diff} vs auto
                      </span>
                    )}
                  </div>
                  <div>
                    {isReadOnly ? (
                      <p className="text-sm text-[#9fb6c4]">{comments[id] || "—"}</p>
                    ) : (
                      <input type="text" placeholder="Notas…" value={comments[id] || ""}
                        onChange={e => setComments(c => ({ ...c, [id]: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#12222d] px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-[#5e7d8e] focus:border-[#14b8a6]/50"/>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comentario general */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#7f99a8]">Comentario general</label>
        {isReadOnly ? (
          <p className="rounded-xl border border-white/10 bg-[#0c1e28] px-4 py-3 text-sm text-[#c7d5dc]">{comentariosGenerales || "—"}</p>
        ) : (
          <textarea value={comentariosGenerales} onChange={e => setComentariosGenerales(e.target.value)}
            rows={3} placeholder="Observaciones generales sobre el desempeño…"
            className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-4 py-3 text-sm text-white outline-none placeholder:text-[#5e7d8e] resize-none focus:border-[#14b8a6]/50"/>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => handleSave(false)} disabled={saving}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5 disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar borrador"}
          </button>
          <button type="button" onClick={() => handleSave(true)} disabled={saving}
            className="rounded-xl bg-[#14b8a6] px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
            {saving ? "Enviando…" : "Enviar evaluación"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Employee view ─────────────────────────────────────────────────────────────
function EmployeeView({ token, language, searchQuery, user }) {
  const { addToast } = useToast();
  const [evaluations, setEvaluations] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvalId, setSelectedEvalId] = useState(null);
  const [evalDetail, setEvalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
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
      const self = evals.find(e => e.tipo === "AUTOEVALUACION");
      setSelectedEvalId(prev => prev || self?._id || evals[0]?._id || null);
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
        if (!ctrl.signal.aborted)
          setEvalDetail(data?.evaluation ? data : { evaluation: data, scores: data?.scores || [] });
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoadingDetail(false); });
    return () => ctrl.abort();
  }, [selectedEvalId, token]);

  const metricMap = useMemo(() => new Map(metrics.map(m => [String(m._id), m])), [metrics]);
  const selfEval = useMemo(() => evaluations.find(e => e.tipo === "AUTOEVALUACION"), [evaluations]);
  const activeCycle = useMemo(() =>
    cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null, [cycles]);

  const scores = evalDetail?.scores || [];
  const visibleScores = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    if (!term) return scores;
    return scores.filter(s => {
      const m = metricMap.get(String(s.metricId?._id || s.metricId));
      return m && [m.nombre, m.descripcion].filter(Boolean).some(v => v.toLowerCase().includes(term));
    });
  }, [scores, metricMap, searchQuery]);

  const stats = useMemo(() => {
    const completed = scores.filter(s => s.nivel > 0).length;
    const avg = completed ? (scores.reduce((sum, s) => sum + (s.nivel || 0), 0) / completed).toFixed(1) : "—";
    return { total: scores.length, completed, avg };
  }, [scores]);

  async function handleStartSelfEval() {
    if (!activeCycle) { addToast({ message: "No hay un ciclo activo.", type: "warning" }); return; }
    try {
      setIsCreating(true);
      await apiFetch("/evaluations", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user?.employeeId, cycleId: activeCycle._id, tipo: "AUTOEVALUACION" }),
      });
      addToast({ message: "Autoevaluación iniciada.", type: "success" });
      setSelectedEvalId(null);
      const ctrl = new AbortController();
      await loadEvals(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) return <LoadingState compact title="Cargando tu evaluación…" description=""/>;
  if (error) return <ErrorState compact title="Error al cargar" description={error}/>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Ciclo activo</p>
        <h2 className="mt-0.5 text-xl font-semibold text-white">Mi evaluación</h2>
        <p className="mt-1 text-sm text-[#7f99a8]">
          {activeCycle ? `${activeCycle.periodo} — ${activeCycle.estado}` : "Sin ciclo activo"}
        </p>
      </div>

      {!selfEval ? (
        <div className="rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/8 px-5 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Completá tu autoevaluación</p>
            <p className="mt-0.5 text-xs text-[#9ecfcc]">No iniciaste tu autoevaluación para el ciclo activo.</p>
          </div>
          <button type="button" onClick={handleStartSelfEval} disabled={isCreating || !activeCycle}
            className="shrink-0 rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
            {isCreating ? "Iniciando…" : "Iniciar autoevaluación"}
          </button>
        </div>
      ) : selfEval.estado === "BORRADOR" ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Autoevaluación en curso</p>
            <p className="mt-0.5 text-xs text-amber-200/80">Tenés cambios sin enviar. Completá y enviá tu autoevaluación.</p>
          </div>
          <button type="button" onClick={() => setSelectedEvalId(selfEval._id)}
            className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25">
            Continuar
          </button>
        </div>
      ) : null}

      {evalDetail && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Habilidades", v: stats.total }, { label: "Completadas", v: stats.completed, a: true }, { label: "Promedio", v: stats.avg, a: true }].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-[#0c1e28] px-4 py-3">
              <p className="text-xs text-[#7f99a8]">{s.label}</p>
              <p className={`mt-1 text-xl font-bold ${s.a ? "text-[#14b8a6]" : "text-white"}`}>{s.v}</p>
            </div>
          ))}
        </div>
      )}

      {evaluations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {evaluations.map(ev => {
            const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || "—";
            return (
              <button key={ev._id} type="button" onClick={() => setSelectedEvalId(ev._id)}
                className={`rounded-xl px-3 py-2 text-sm transition ${selectedEvalId === ev._id ? "bg-[#14b8a6] text-[#0f172a] font-semibold" : "border border-white/10 bg-[#0c1e28] text-[#9fb6c4] hover:bg-white/5"}`}>
                {TIPO_LABELS[ev.tipo] || ev.tipo} · {cycleLabel}
              </button>
            );
          })}
        </div>
      )}

      {selectedEvalId ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
          {loadingDetail ? (
            <LoadingState compact title="Cargando habilidades…" description=""/>
          ) : !evalDetail || !scores.length ? (
            <EmptyState compact title="Sin habilidades asignadas" description="No hay habilidades en este ciclo todavía."/>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Habilidad", "Descripción", "Estado", "Resultado"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleScores.map(score => {
                  const m = metricMap.get(String(score.metricId?._id || score.metricId));
                  const hasResult = score.nivel > 0;
                  return (
                    <tr key={String(score._id || score.metricId?._id || score.metricId)} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-medium text-white">{m?.nombre || "—"}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="text-xs text-[#9fb6c4] truncate">{m?.descripcion || "—"}</p></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${hasResult ? "bg-emerald-500/15 text-emerald-200" : "bg-sky-500/15 text-sky-200"}`}>
                          {hasResult ? "Completada" : "En progreso"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasResult ? <span className="font-semibold text-[#14b8a6]">{score.nivel}</span> : <span className="text-[#5e7d8e]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : evaluations.length === 0 ? (
        <EmptyState compact title="Sin evaluaciones aún" description="Cuando tu jefe cree una evaluación aparecerá aquí."/>
      ) : null}
    </div>
  );
}

// ─── Manager view ──────────────────────────────────────────────────────────────
function ManagerView({ token, user }) {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ cicloId: "", area: "", estado: "" });
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openEvalId, setOpenEvalId] = useState(null);

  const selfEmployeeId = String(user?.employeeId || "");

  const activeCycle = useMemo(() =>
    cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null, [cycles]);

  const loadData = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
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
  const selectedIsSelf = form.employeeId === selfEmployeeId;
  const derivedTipo = selectedIsSelf ? "AUTOEVALUACION" : "JEFATURA";

  const filtered = useMemo(() => {
    let list = [...evaluations];
    if (filters.cicloId) list = list.filter(e => String(e.cycleId?._id || e.cycleId) === filters.cicloId);
    if (filters.area) list = list.filter(e => {
      const emp = employees.find(em => String(em._id) === String(e.employeeId?._id || e.employeeId));
      return emp?.area === filters.area;
    });
    if (filters.estado) list = list.filter(e => e.estado === filters.estado);
    return list;
  }, [evaluations, filters, employees]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeeId) { addToast({ message: "Seleccioná una persona.", type: "warning" }); return; }
    if (!activeCycle) { addToast({ message: "No hay un ciclo activo.", type: "warning" }); return; }
    try {
      setIsSubmitting(true);
      const created = await apiFetch("/evaluations", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: form.employeeId, cycleId: activeCycle._id, tipo: derivedTipo }),
      });
      setNewModal(false);
      setForm({ employeeId: "" });
      addToast({ message: "Evaluación creada.", type: "success" });
      const ctrl = new AbortController();
      await loadData(ctrl.signal);
      const newId = created?.evaluation?._id || created?._id;
      if (newId) setOpenEvalId(newId);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (openEvalId) {
    return (
      <EvalDetailView
        evalId={openEvalId}
        token={token}
        onBack={() => setOpenEvalId(null)}
        onSaved={() => { setOpenEvalId(null); const ctrl = new AbortController(); loadData(ctrl.signal); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Ciclos de evaluación</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">Evaluaciones</h2>
          <p className="mt-1 text-sm text-[#7f99a8]">
            {activeCycle ? `Ciclo activo: ${activeCycle.periodo}` : "Sin ciclo activo."}
          </p>
        </div>
        <button type="button" onClick={() => setNewModal(true)}
          className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
          + Nueva evaluación
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Activas", value: stats.active },
          { label: "Pendientes", value: stats.pending },
          { label: "Completadas", value: stats.completed, accent: true },
          { label: "Promedio", value: stats.avg, accent: true },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
            <p className="text-xs text-[#7f99a8]">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.accent ? "text-[#14b8a6]" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.cicloId} onChange={e => setFilters(f => ({ ...f, cicloId: e.target.value }))}>
          <option value="">Todos los ciclos</option>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.periodo} — {c.estado}</option>)}
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.area} onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}>
          <option value="">Todas las áreas</option>
          {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filters.cicloId || filters.area || filters.estado) ? (
          <button type="button" onClick={() => setFilters({ cicloId: "", area: "", estado: "" })}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/5">
            Limpiar
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
        {isLoading ? (
          <LoadingState compact title="Cargando evaluaciones…" description=""/>
        ) : error ? (
          <ErrorState compact title="Error al cargar" description={error}
            actionLabel="Reintentar" onAction={() => { const ctrl = new AbortController(); loadData(ctrl.signal); }}/>
        ) : filtered.length === 0 ? (
          <EmptyState compact
            title={evaluations.length === 0 ? "Sin evaluaciones aún" : "Sin resultados"}
            description={evaluations.length === 0 ? "Creá la primera evaluación." : "Ajustá los filtros."}
            actionLabel={evaluations.length === 0 ? "+ Nueva evaluación" : ""}
            onAction={evaluations.length === 0 ? () => setNewModal(true) : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Persona evaluada", "Tipo", "Ciclo", "Estado", "Resultado", "Acciones"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(ev => {
                const emp = ev.employeeId;
                const name = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : "—";
                const isSelf = String(emp?._id || emp) === selfEmployeeId;
                const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || ev.cycleId?.periodo || "—";
                return (
                  <tr key={ev._id} className="hover:bg-white/[0.02] transition cursor-pointer" onClick={() => setOpenEvalId(ev._id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{name}</p>
                        {isSelf ? <span className="rounded-full bg-[#14b8a6]/15 px-2 py-0.5 text-[10px] font-medium text-[#14b8a6]">Yo</span> : null}
                      </div>
                      {emp?.area ? <p className="text-xs text-[#7f99a8]">{emp.area}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-[#c7d5dc]">{TIPO_LABELS[ev.tipo] || ev.tipo}</td>
                    <td className="px-4 py-3 text-[#9fb6c4]">{cycleLabel}</td>
                    <td className="px-4 py-3"><StatusBadge estado={ev.estado}/></td>
                    <td className="px-4 py-3">
                      {ev.resultadoFinal != null
                        ? <span className="font-semibold text-[#14b8a6]">{ev.resultadoFinal}</span>
                        : <span className="text-[#5e7d8e]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button"
                        onClick={e2 => { e2.stopPropagation(); setOpenEvalId(ev._id); }}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#9fb6c4] transition hover:bg-white/5 hover:text-white">
                        Ver →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {newModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Nueva evaluación</h3>
              <button type="button" onClick={() => { setNewModal(false); setForm({ employeeId: "" }); }}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">Persona a evaluar *</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                  value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Seleccioná una persona</option>
                  {employees.map(e => (
                    <option key={e._id} value={e._id}>
                      {e.apellido}, {e.nombre}{String(e._id) === selfEmployeeId ? " (Yo)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {form.employeeId ? (
                <div className="rounded-xl border border-white/10 bg-[#12222d]/60 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-[#7f99a8]">Tipo de evaluación</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${selectedIsSelf ? "bg-violet-500/20 text-violet-200" : "bg-sky-500/20 text-sky-200"}`}>
                    {TIPO_LABELS[derivedTipo]}
                  </span>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">Ciclo</label>
                <div className="rounded-xl border border-white/10 bg-[#12222d]/60 px-3 py-2.5 text-sm text-white">
                  {activeCycle
                    ? <span>{activeCycle.periodo} <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">{activeCycle.estado}</span></span>
                    : <span className="text-[#5e7d8e]">Sin ciclo activo</span>}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setNewModal(false); setForm({ employeeId: "" }); }}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting || !form.employeeId || !activeCycle}
                  className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
                  {isSubmitting ? "Creando…" : "Crear evaluación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Root export ───────────────────────────────────────────────────────────────
export default function EvaluationsPage() {
  const { token, user } = useAuth();
  const { language, searchQuery } = useView();
  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployeeOnly = isEmployee && !isManager && !isSuperAdmin;
  if (isEmployeeOnly) return <EmployeeView token={token} language={language} searchQuery={searchQuery} user={user}/>;
  return <ManagerView token={token} user={user}/>;
}
