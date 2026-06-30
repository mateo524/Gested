import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";

const TIPO_LABELS = { AUTOEVALUACION: "Autoevaluación", JEFATURA: "Jefatura", FINAL: "Cierre final", EVALUACION_360: "360°" };
const ESTADO_LABELS = { BORRADOR: "Borrador", ENVIADA: "Enviada", REVISADA: "Revisada", CERRADA: "Cerrada" };

function CycleBadge({ cycle }) {
  const now = new Date();
  const end = cycle.fechaFin ? new Date(cycle.fechaFin) : null;
  const start = cycle.fechaInicio ? new Date(cycle.fechaInicio) : null;
  const manuallyClosed = cycle.estado === "CERRADO" || cycle.estado === "Cerrado";
  const active = !manuallyClosed && start && end && now >= start && now <= end;
  const expired = !manuallyClosed && end && now > end;
  if (manuallyClosed) return <span className="ml-1.5 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#6a8a9a]">CERRADO</span>;
  if (active) return <span className="ml-1.5 inline-flex rounded-full bg-[#14b8a6]/15 px-2 py-0.5 text-[10px] font-medium text-[#14b8a6]">ABIERTO</span>;
  if (expired) return <span className="ml-1.5 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">EN PROCESO</span>;
  return <span className="ml-1.5 inline-flex rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">PROGRAMADO</span>;
}

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

// ─── Eval metric rows (defined outside to avoid remount on each render) ────────
function MetricRow({ id, metric, autoScore, scores, comments, setScores, setComments, showSideBySide, isJefatura, isReadOnly, gridCls }) {
  const autoNivel = autoScore?.nivel || 0;
  const currentNivel = scores[id] || 0;
  const diff = showSideBySide && currentNivel && autoNivel ? currentNivel - autoNivel : null;
  return (
    <div className={`grid gap-0 border-t border-white/5 ${gridCls}`}>
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-white">{metric?.nombre || "—"}</p>
        {metric?.descripcion ? <p className="mt-0.5 text-xs text-[#7f99a8] line-clamp-2">{metric.descripcion}</p> : null}
      </div>
      {showSideBySide && (
        <div className="border-l border-violet-500/10 bg-violet-500/[0.04] px-4 py-3">
          <div className="flex items-center gap-2">
            <StarRow value={autoNivel} disabled/>
            {autoNivel > 0 && <span className="text-sm font-semibold text-violet-300">{autoNivel}</span>}
          </div>
          {autoScore?.comentario ? (
            <p className="mt-1 text-[11px] italic text-violet-300/70 line-clamp-2">"{autoScore.comentario}"</p>
          ) : null}
        </div>
      )}
      <div className={`border-l px-4 py-3 ${isJefatura ? "border-[#14b8a6]/10 bg-[#14b8a6]/[0.04]" : "border-white/10"}`}>
        <div className="flex items-center gap-2">
          <StarRow value={currentNivel}
            onChange={isReadOnly ? undefined : (n) => setScores(s => ({ ...s, [id]: n }))}
            disabled={isReadOnly}/>
          {currentNivel > 0 && <span className="text-sm font-semibold text-[#14b8a6]">{currentNivel}</span>}
        </div>
        {diff !== null && (
          <span className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold
            ${diff > 0 ? "bg-emerald-500/15 text-emerald-300" : diff < 0 ? "bg-rose-500/15 text-rose-300" : "bg-white/10 text-[#7f99a8]"}`}>
            {diff > 0 ? `+${diff}` : diff} vs auto
          </span>
        )}
      </div>
      <div className="border-l border-white/10 px-4 py-3">
        {isReadOnly ? (
          <p className="text-sm text-[#9fb6c4]">{comments[id] || <span className="text-[#5e7d8e]">—</span>}</p>
        ) : (
          <input type="text" placeholder="Notas…" value={comments[id] || ""}
            onChange={e => setComments(c => ({ ...c, [id]: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-[#12222d] px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-[#5e7d8e] focus:border-[#14b8a6]/50"/>
        )}
      </div>
    </div>
  );
}

function CompetencySubtotalRow({ metricIds, scores, autoScoreMap, showSideBySide, isJefatura, gridCls }) {
  const vals = metricIds.map(id => scores[id] || 0).filter(v => v > 0);
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  const autoVals = metricIds.map(id => autoScoreMap.get(id)?.nivel || 0).filter(v => v > 0);
  const autoAvg = showSideBySide && autoVals.length ? (autoVals.reduce((a, b) => a + b, 0) / autoVals.length).toFixed(1) : null;
  return (
    <div className={`grid gap-0 border-t border-white/10 bg-white/[0.02] ${gridCls}`}>
      <div className="px-4 py-2.5 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5e7d8e]">Puntaje habilidad</span>
      </div>
      {showSideBySide && (
        <div className="border-l border-violet-500/10 bg-violet-500/[0.06] px-4 py-2.5">
          {autoAvg
            ? <span className="text-sm font-bold text-violet-200">{autoAvg}<span className="ml-0.5 text-xs font-normal text-violet-400">/5</span></span>
            : <span className="text-sm text-violet-400/30">—</span>}
        </div>
      )}
      <div className={`border-l px-4 py-2.5 ${isJefatura ? "border-[#14b8a6]/10 bg-[#14b8a6]/[0.06]" : "border-white/10"}`}>
        {avg
          ? <span className={`text-sm font-bold ${isJefatura ? "text-[#14b8a6]" : "text-white"}`}>{avg}<span className="ml-0.5 text-xs font-normal opacity-50">/5</span></span>
          : <span className="text-sm text-white/20">—</span>}
      </div>
      <div className="border-l border-white/10 px-4 py-2.5"/>
    </div>
  );
}

// ─── Eval Detail View (Vista Jefe — side by side) ─────────────────────────────
function EvalDetailView({ evalId, token, onBack, onSaved }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [autoData, setAutoData] = useState(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
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
        setMetrics(Array.isArray(met) ? met : []);
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
            // Backend returns { data: [], total } — not a plain array
            const autoEval = Array.isArray(allEvals) ? allEvals[0] : (allEvals?.data?.[0] ?? null);
            if (autoEval?._id) {
              const autoDetail = await apiFetch(`/evaluations/${autoEval._id}`, { token, signal: ctrl.signal });
              if (!ctrl.signal.aborted) setAutoData(autoDetail);
            }
          } catch { /* employee hasn't created auto-eval yet */ }
          if (!ctrl.signal.aborted) setAutoLoaded(true);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) addToast({ message: err.message, type: "error" });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [evalId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const metricMap = useMemo(() => {
    const map = new Map(metrics.map(m => [String(m._id), m]));
    // Enrich from populated metricId on scores (covers auto-created metrics not in /metrics list)
    [...(data?.scores || []), ...(autoData?.scores || [])].forEach(s => {
      if (s.metricId && typeof s.metricId === "object" && s.metricId._id) {
        const key = String(s.metricId._id);
        if (!map.has(key)) map.set(key, s.metricId);
      }
    });
    return map;
  }, [metrics, data, autoData]);

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

  // Group metric IDs by their parent competency (populated via deep-populate on metricId.competencyId)
  const groupedByCompetency = useMemo(() => {
    const groupMap = new Map(); // competencyId string => { competency, metricIds[] }
    const ungrouped = [];
    allMetricIds.forEach(id => {
      const metric = metricMap.get(id);
      const comp = metric?.competencyId;
      if (comp && typeof comp === "object" && comp._id && comp.nombre) {
        const cId = String(comp._id);
        if (!groupMap.has(cId)) groupMap.set(cId, { competency: comp, metricIds: [] });
        groupMap.get(cId).metricIds.push(id);
      } else {
        ungrouped.push(id);
      }
    });
    return { groups: [...groupMap.values()], ungrouped };
  }, [allMetricIds, metricMap]);

  const summaryAuto = useMemo(() => {
    const vals = (autoData?.scores || []).map(s => s.nivel || 0).filter(v => v > 0);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  }, [autoData]);

  const summaryManager = useMemo(() => {
    const vals = Object.values(scores).map(Number).filter(v => v > 0);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  }, [scores]);

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
  const isReadOnly = ev.estado === "CERRADA";
  const showSideBySide = isJefatura && !!autoData;
  const noAutoYet = isJefatura && autoLoaded && !autoData;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#c7d5dc] transition hover:bg-white/10">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M10 3L5 8l5 5"/></svg>
          Volver
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white">{empName}</h2>
          <p className="text-xs text-[#7f99a8]">
            {ev.cycleId?.periodo || "—"} · {TIPO_LABELS[ev.tipo] || ev.tipo}
            {emp?.cargo ? <span className="ml-2 text-[#5e7d8e]">· {emp.cargo}</span> : null}
            {emp?.area ? <span className="ml-2 text-[#5e7d8e]">· {emp.area}</span> : null}
          </p>
        </div>
        <StatusBadge estado={ev.estado}/>
      </div>

      {/* Score summary cards — only for JEFATURA once auto-eval loaded */}
      {isJefatura && (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/8 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-300">Autoevaluación</p>
            {summaryAuto
              ? <p className="mt-1 text-2xl font-bold text-violet-200">{summaryAuto}<span className="ml-1 text-sm font-normal text-violet-400">/5</span></p>
              : <p className="mt-1 text-sm text-violet-400/70">{autoLoaded ? "Sin completar" : "Cargando…"}</p>}
          </div>
          <div className="rounded-2xl border border-[#14b8a6]/25 bg-[#14b8a6]/8 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#14b8a6]">Tu evaluación</p>
            {summaryManager
              ? <p className="mt-1 text-2xl font-bold text-[#14b8a6]">{summaryManager}<span className="ml-1 text-sm font-normal text-[#0d9488]">/5</span></p>
              : <p className="mt-1 text-sm text-[#14b8a6]/50">Sin completar</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c1e28] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5e7d8e]">Diferencia</p>
            {summaryAuto && summaryManager ? (() => {
              const d = (parseFloat(summaryManager) - parseFloat(summaryAuto)).toFixed(1);
              const isPos = parseFloat(d) > 0, isNeg = parseFloat(d) < 0;
              return <p className={`mt-1 text-2xl font-bold ${isPos ? "text-emerald-400" : isNeg ? "text-rose-400" : "text-white"}`}>{isPos ? `+${d}` : d}</p>;
            })() : <p className="mt-1 text-sm text-white/20">—</p>}
          </div>
        </div>
      )}

      {/* Info banners */}
      {showSideBySide && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 text-sm">
          <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-violet-300"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p className="text-violet-200">La columna <span className="font-semibold">Autoevaluación</span> muestra cómo se puntuó el empleado. Usala como referencia para hacer una evaluación justa y objetiva.</p>
        </div>
      )}
      {noAutoYet && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm">
          <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"><path d="M8 2L14 13H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <p className="text-amber-200">El empleado <span className="font-semibold">aún no completó su autoevaluación</span>. Podés evaluar igualmente; cuando la complete aparecerá al lado para comparar.</p>
        </div>
      )}

      {/* Skills grid */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden overflow-x-auto">
        {/* Column headers */}
        <div className={`grid gap-0 border-b border-white/10 ${showSideBySide ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]" : "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]"}`}>
          <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Habilidad</div>
          {showSideBySide && (
            <div className="border-l border-violet-500/15 bg-violet-500/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-300">
              Autoevaluación
            </div>
          )}
          <div className={`border-l px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${isJefatura ? "border-[#14b8a6]/15 bg-[#14b8a6]/5 text-[#14b8a6]" : "border-white/10 text-[#5e7d8e]"}`}>
            {isJefatura ? "Tu evaluación" : "Calificación"}
          </div>
          <div className="border-l border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Notas</div>
        </div>

        {allMetricIds.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#7f99a8]">Sin habilidades asignadas a este empleado.</div>
        ) : (() => {
          const gridCls = showSideBySide
            ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
            : "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]";
          const rowProps = { scores, comments, setScores, setComments, showSideBySide, isJefatura, isReadOnly, gridCls };
          const { groups, ungrouped } = groupedByCompetency;

          if (groups.length > 0) return (
            <div>
              {groups.map(({ competency, metricIds: mIds }) => (
                <div key={String(competency._id)} className="border-b border-white/8 last:border-b-0">
                  <div className="flex items-baseline gap-2 border-b border-white/5 bg-white/[0.025] px-4 py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c7d5dc]">{competency.nombre}</span>
                    {competency.descripcion && (
                      <span className="text-[11px] text-[#4a6070] line-clamp-1">{competency.descripcion}</span>
                    )}
                  </div>
                  {mIds.map(id => (
                    <MetricRow key={id} id={id} metric={metricMap.get(id)} autoScore={autoScoreMap.get(id)} {...rowProps}/>
                  ))}
                  <CompetencySubtotalRow metricIds={mIds} scores={scores} autoScoreMap={autoScoreMap} showSideBySide={showSideBySide} isJefatura={isJefatura} gridCls={gridCls}/>
                </div>
              ))}
              {ungrouped.map(id => (
                <MetricRow key={id} id={id} metric={metricMap.get(id)} autoScore={autoScoreMap.get(id)} {...rowProps}/>
              ))}
            </div>
          );

          // Fallback flat list (no grouping)
          return (
            <div className="divide-y divide-white/5">
              {allMetricIds.map(id => (
                <MetricRow key={id} id={id} metric={metricMap.get(id)} autoScore={autoScoreMap.get(id)} {...rowProps}/>
              ))}
            </div>
          );
        })()}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("performia:set-view", { detail: { view: "planes" } }))}
          className="inline-flex items-center gap-2 rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-4 py-2.5 text-sm font-medium text-[#14b8a6] transition hover:bg-[#14b8a6]/20">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
          Crear plan de desarrollo
        </button>
        {!isReadOnly && (
          <div className="flex gap-3">
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
    </div>
  );
}

// ─── Employee view ─────────────────────────────────────────────────────────────
function EmployeeView({ token, language, searchQuery, user }) {
  const { addToast } = useToast();
  const [evaluations, setEvaluations] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvalId, setSelectedEvalId] = useState(null);
  const [evalDetail, setEvalDetail] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [openEvalId, setOpenEvalId] = useState(null);

  const loadEvals = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
      const [evalsRes, cyc] = await Promise.all([
        apiFetch("/evaluations", { token, signal }),
        apiFetch("/evaluation-cycles", { token, signal }).catch(() => []),
      ]);
      const evals = evalsRes?.data ?? evalsRes ?? [];
      setEvaluations(evals);
      setCycles(Array.isArray(cyc) ? cyc : []);
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
    apiFetch(`/evaluations/${selectedEvalId}`, { token, signal: ctrl.signal })
      .then(data => {
        if (!ctrl.signal.aborted)
          setEvalDetail(data?.evaluation ? data : { evaluation: data, scores: data?.scores || [] });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [selectedEvalId, token]);

  const selfEval = useMemo(() => evaluations.find(e => e.tipo === "AUTOEVALUACION"), [evaluations]);
  const activeCycle = useMemo(() =>
    cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null, [cycles]);

  const scores = evalDetail?.scores || [];
  const stats = useMemo(() => {
    const completed = scores.filter(s => s.nivel > 0).length;
    const avg = completed ? (scores.reduce((sum, s) => sum + (s.nivel || 0), 0) / completed).toFixed(1) : "—";
    return { total: scores.length, completed, avg };
  }, [scores]);

  async function handleStartSelfEval() {
    if (!activeCycle) { addToast({ message: "No hay un ciclo activo.", type: "warning" }); return; }
    try {
      setIsCreating(true);
      const created = await apiFetch("/evaluations", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: user?.employeeId, cycleId: activeCycle._id, tipo: "AUTOEVALUACION" }),
      });
      addToast({ message: "Autoevaluación iniciada.", type: "success" });
      const ctrl = new AbortController();
      await loadEvals(ctrl.signal);
      const newId = created?.evaluation?._id || created?._id;
      if (newId) setOpenEvalId(newId);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  if (openEvalId) {
    return (
      <EvalDetailView
        evalId={openEvalId}
        token={token}
        onBack={() => setOpenEvalId(null)}
        onSaved={() => { setOpenEvalId(null); const ctrl = new AbortController(); loadEvals(ctrl.signal); }}
      />
    );
  }

  if (isLoading) return <LoadingState compact title="Cargando tu evaluación…" description=""/>;
  if (error) return <ErrorState compact title="Error al cargar" description={error}/>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Ciclo activo</p>
        <h2 className="mt-0.5 text-xl font-semibold text-white">Mi evaluación</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[#7f99a8]">
          {activeCycle
            ? <><span>{activeCycle.periodo}</span><CycleBadge cycle={activeCycle}/></>
            : <span>Sin ciclo activo — aguardá que RRHH abra uno nuevo.</span>}
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
          <button type="button" onClick={() => setOpenEvalId(selfEval._id)}
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

      {evaluations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Mis evaluaciones</span>
          </div>
          <div className="divide-y divide-white/5">
            {evaluations.map(ev => {
              const cycleLabel = cycles.find(c => String(c._id) === String(ev.cycleId?._id || ev.cycleId))?.periodo || "—";
              const isPending = ev.estado === "BORRADOR";
              return (
                <button key={ev._id} type="button" onClick={() => setOpenEvalId(ev._id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{TIPO_LABELS[ev.tipo] || ev.tipo}</p>
                    <p className="text-xs text-[#7f99a8]">{cycleLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge estado={ev.estado}/>
                    {ev.resultadoFinal != null && ev.resultadoFinal > 0
                      ? <span className="text-sm font-semibold text-[#14b8a6]">{ev.resultadoFinal}</span>
                      : null}
                    <span className={`text-xs font-medium ${isPending ? "text-amber-300" : "text-[#14b8a6]"}`}>
                      {isPending ? "Completar →" : "Ver →"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {evaluations.length === 0 ? (
        <EmptyState compact
          title="Todavía no tenés evaluaciones asignadas"
          description={activeCycle
            ? `El ciclo ${activeCycle.periodo} está activo. Tu jefe habilitará tu evaluación en breve.`
            : "Cuando tu jefe abra un ciclo y cree tu evaluación, aparecerá aquí."}
        />
      ) : null}
    </div>
  );
}

function ScoreDistributionChart({ scores }) {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  const buckets = [
    { label: "1–2", min: 1, max: 2 },
    { label: "2–3", min: 2, max: 3 },
    { label: "3–4", min: 3, max: 4 },
    { label: "4–5", min: 4, max: 5 },
  ];
  const data = buckets.map(b => ({
    label: b.label,
    count: scores.filter(s => s > b.min - 0.001 && s <= b.max + 0.001 && (b.min === 1 ? s >= 1 : s > b.min)).length,
  }));
  const hasAny = data.some(d => d.count > 0);
  if (!hasAny) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Distribución de puntajes</p>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="label" tick={{ fill: "#7f99a8", fontSize: 11 }} axisLine={false} tickLine={false}/>
          <YAxis allowDecimals={false} tick={{ fill: "#7f99a8", fontSize: 11 }} axisLine={false} tickLine={false} width={24}/>
          <Tooltip
            contentStyle={{ background: "#0f2330", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "#c7d5dc" }}
            itemStyle={{ color: "#14b8a6" }}
            formatter={v => [v, "Empleados"]}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 3 ? "#14b8a6" : i === 2 ? "#0e9b8b" : i === 1 ? "#0d7a6d" : "#0b5c52"}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CycleProgressBadge({ evaluations, cycleId }) {
  const inCycle = cycleId
    ? evaluations.filter(e => String(e.cycleId?._id || e.cycleId) === String(cycleId))
    : evaluations;
  const total = inCycle.length;
  const completed = inCycle.filter(e => e.estado === "CERRADA" || e.estado === "ENVIADA").length;
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Progreso del ciclo</span>
          <span className="text-sm font-bold text-[#14b8a6]">{completed}/{total}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#14b8a6] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-[#7f99a8]">{pct}% completadas</p>
      </div>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openEvalId, setOpenEvalId] = useState(null);
  const savedFilters = useRef(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);

  const isSuperAdminMgr = Boolean(user?.isSuperAdmin);
  const derivedCompanyId = isSuperAdminMgr
    ? (evaluations[0]?.companyId ? String(evaluations[0].companyId) : null)
    : null;
  useEffect(() => {
    // For SuperAdmin derive companyId from loaded evaluations
    const qs = derivedCompanyId ? `?companyId=${derivedCompanyId}` : "";
    apiFetch(`/companies/my-spreadsheet${qs}`, { token }).then(d => setSpreadsheetUrl(d?.spreadsheetUrl || null)).catch(() => {});
  }, [token, isSuperAdminMgr, derivedCompanyId]);

  async function handleSyncNow() {
    try {
      setSyncing(true);
      await apiFetch("/companies/sync-now", { method: "POST", token });
      addToast({ message: "Excel actualizándose…", type: "success" });
      setTimeout(() => {
        apiFetch("/companies/my-spreadsheet", { token }).then(d => setSpreadsheetUrl(d?.spreadsheetUrl || null)).catch(() => {});
      }, 4000);
    } catch { addToast({ message: "No se pudo sincronizar.", type: "error" }); }
    finally { setSyncing(false); }
  }

  const selfEmployeeId = String(user?.employeeId || "");

  const activeCycle = useMemo(() =>
    cycles.find(c => c.estado === "Activo" || c.estado === "Inicio") || cycles[0] || null, [cycles]);

  const loadData = useCallback(async (signal) => {
    try {
      setIsLoading(true); setError("");
      const [empRes, cyc, evalsRes] = await Promise.all([
        apiFetch("/employees?includeSelf=true&limit=200", { token, signal }),
        apiFetch("/evaluation-cycles", { token, signal }),
        apiFetch("/evaluations", { token, signal }),
      ]);
      setEmployees(empRes?.data ?? empRes ?? []);
      setCycles(Array.isArray(cyc) ? cyc : []);
      setEvaluations(evalsRes?.data ?? evalsRes ?? []);
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

  // Employees who have no evaluation in the active cycle
  const withoutEval = useMemo(() => {
    if (!activeCycle) return [];
    const cycleId = String(activeCycle._id);
    const evalledIds = new Set(
      evaluations
        .filter(e => String(e.cycleId?._id || e.cycleId) === cycleId)
        .map(e => String(e.employeeId?._id || e.employeeId))
    );
    return (Array.isArray(employees) ? employees : []).filter(emp => !evalledIds.has(String(emp._id)));
  }, [employees, evaluations, activeCycle]);

  const scoreDistribution = useMemo(() => {
    const inCycle = filters.cicloId
      ? evaluations.filter(e => String(e.cycleId?._id || e.cycleId) === filters.cicloId)
      : evaluations;
    return inCycle.filter(e => e.resultadoFinal != null).map(e => e.resultadoFinal);
  }, [evaluations, filters.cicloId]);

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(ev => {
        const emp = ev.employeeId;
        const nombre = emp ? `${emp.nombre || ""} ${emp.apellido || ""}`.toLowerCase() : "";
        const nombreAlt = ev.empleadoNombre?.toLowerCase() || "";
        return nombre.includes(q) || nombreAlt.includes(q) || ev.empleadoId?.nombre?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [evaluations, filters, employees, searchQuery]);

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
      if (newId) { savedFilters.current = filters; setOpenEvalId(newId); }
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (filters.cicloId) params.set("cycleId", filters.cicloId);
      if (filters.area) params.set("area", filters.area);
      if (filters.estado) params.set("estado", filters.estado);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const blob = await apiFetch(`/evaluations/export${qs}`, { token, rawBlob: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluaciones_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast({ message: "Exportación descargada.", type: "success" });
    } catch (err) {
      addToast({ message: err.message || "No se pudo exportar.", type: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function handleBulkCreate() {
    if (!activeCycle) { addToast({ message: "No hay un ciclo activo.", type: "warning" }); return; }
    const existingEmployeeIds = new Set(
      evaluations
        .filter(ev => String(ev.cycleId?._id || ev.cycleId) === String(activeCycle._id) && ev.tipo === "JEFATURA")
        .map(ev => String(ev.employeeId?._id || ev.employeeId))
    );
    const directReports = employees.filter(emp => String(emp._id) !== selfEmployeeId && !existingEmployeeIds.has(String(emp._id)));
    if (directReports.length === 0) {
      addToast({ message: "Todos los empleados ya tienen evaluación en este ciclo.", type: "info" });
      return;
    }
    try {
      setBulkCreating(true);
      await apiFetch("/evaluations/bulk", {
        method: "POST", token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: activeCycle._id,
          tipo: "JEFATURA",
          employeeIds: directReports.map(emp => emp._id),
        }),
      });
      addToast({ message: `${directReports.length} evaluación(es) creada(s).`, type: "success" });
      const ctrl = new AbortController();
      await loadData(ctrl.signal);
    } catch (err) {
      addToast({ message: err.message || "No se pudo crear evaluaciones en lote.", type: "error" });
    } finally {
      setBulkCreating(false);
    }
  }

  function openDetail(id) {
    savedFilters.current = filters;
    setOpenEvalId(id);
  }

  function closeDetail() {
    setOpenEvalId(null);
    if (savedFilters.current) setFilters(savedFilters.current);
  }

  function sendReminder(employeeId) {
    addToast({ message: "Recordatorio enviado.", type: "success" });
    // stub — wire to POST /notifications/reminder when backend supports it
  }

  useEffect(() => {
    if (openEvalId) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [openEvalId]);

  if (openEvalId) {
    return (
      <EvalDetailView
        evalId={openEvalId}
        token={token}
        onBack={closeDetail}
        onSaved={() => { closeDetail(); const ctrl = new AbortController(); loadData(ctrl.signal); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Ciclos de evaluación</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">Evaluaciones</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#7f99a8]">
            {activeCycle
              ? <><span>Ciclo activo: {activeCycle.periodo}</span><CycleBadge cycle={activeCycle}/></>
              : <span>Sin ciclo activo — creá uno en Ciclos de evaluación.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {spreadsheetUrl ? (
            <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 no-underline">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Ver Excel
            </a>
          ) : null}
          <button type="button" onClick={handleSyncNow} disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/10 disabled:opacity-50">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`}><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5M13.5 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {syncing ? "Sincronizando…" : "Sincronizar Excel"}
          </button>
          <button type="button" onClick={handleExport} disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/10 disabled:opacity-50">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {exporting ? "Exportando…" : "Exportar"}
          </button>
          <button type="button" onClick={handleBulkCreate} disabled={bulkCreating || !activeCycle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-2 text-sm font-medium text-[#14b8a6] transition hover:bg-[#14b8a6]/20 disabled:opacity-50">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
            {bulkCreating ? "Creando…" : "Crear para todo el equipo"}
          </button>
          <button type="button" onClick={() => setNewModal(true)}
            className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
            + Nueva evaluación
          </button>
        </div>
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

      {/* Warning: employees without evaluation in current cycle */}
      {withoutEval.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/8 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  {withoutEval.length} {withoutEval.length === 1 ? "persona sin evaluación" : "personas sin evaluación"} en el ciclo activo
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {withoutEval.slice(0, 10).map(emp => (
                    <span key={emp._id} className="inline-flex items-center rounded-full bg-amber-400/12 px-2.5 py-0.5 text-xs font-medium text-amber-200 border border-amber-400/25">
                      {emp.apellido}, {emp.nombre}
                    </span>
                  ))}
                  {withoutEval.length > 10 && (
                    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-[#9fb6c4]">
                      +{withoutEval.length - 10} más
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBulkCreate}
              disabled={bulkCreating || !activeCycle}
              className="shrink-0 rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-400/25 disabled:opacity-50"
            >
              {bulkCreating ? "Creando…" : "Crear evaluaciones para todos"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CycleProgressBadge evaluations={evaluations} cycleId={filters.cicloId || activeCycle?._id}/>
        <ScoreDistributionChart scores={scoreDistribution}/>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#7f99a8]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por empleado..."
            className="w-full sm:w-72 rounded-xl border border-white/10 bg-[#0c1e28] pl-9 pr-4 py-2 text-sm text-white placeholder-[#7f99a8] focus:border-[#14b8a6]/50 focus:outline-none"
          />
        </div>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.cicloId} onChange={e => setFilters(f => ({ ...f, cicloId: e.target.value }))}>
          <option value="">Todos los ciclos</option>
          {cycles.map(c => {
            const now = new Date();
            const end = c.fechaFin ? new Date(c.fechaFin) : null;
            const start = c.fechaInicio ? new Date(c.fechaInicio) : null;
            const manuallyClosed = c.estado === "CERRADO" || c.estado === "Cerrado";
            const active = !manuallyClosed && start && end && now >= start && now <= end;
            const expired = !manuallyClosed && end && now > end;
            const tag = manuallyClosed ? "CERRADO" : active ? "ABIERTO" : expired ? "EN PROCESO" : "PROGRAMADO";
            return <option key={c._id} value={c._id}>{c.periodo} [{tag}]</option>;
          })}
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
            title={
              evaluations.length === 0
                ? activeCycle ? "Este ciclo todavía no tiene evaluaciones" : "No hay evaluaciones ni ciclos activos"
                : "Sin resultados para los filtros aplicados"
            }
            description={
              evaluations.length === 0
                ? activeCycle
                  ? `Podés crear evaluaciones individuales o usar "Crear para todo el equipo" para el ciclo ${activeCycle.periodo}.`
                  : "Primero creá un ciclo de evaluación en la sección Ciclos, luego volvé aquí para crear evaluaciones."
                : "Probá limpiando los filtros de ciclo, área o estado para ver más resultados."
            }
            actionLabel={evaluations.length === 0 && activeCycle ? "+ Nueva evaluación" : ""}
            onAction={evaluations.length === 0 && activeCycle ? () => setNewModal(true) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={ev._id} className="hover:bg-white/[0.02] transition cursor-pointer" onClick={() => openDetail(ev._id)}>
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
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={e2 => { e2.stopPropagation(); openDetail(ev._id); }}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#9fb6c4] transition hover:bg-white/5 hover:text-white">
                          Ver →
                        </button>
                        {ev.estado === "BORRADOR" && (
                          <button type="button"
                            onClick={e2 => { e2.stopPropagation(); sendReminder(ev.employeeId?._id || ev.employeeId); }}
                            className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 transition hover:bg-amber-500/20">
                            Recordatorio
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
