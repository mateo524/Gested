import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import CollapsibleList from "../components/CollapsibleList";

const TIPO_LABELS = {
  AUTOEVALUACION: "Autoevaluación",
  JEFATURA: "Jefatura",
  FINAL: "Cierre final",
  EVALUACION_360: "360° — Evaluar a mi jefe",
};
const ESTADO_LABELS = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  REVISADA: "Revisada",
  CERRADA: "Cerrada",
};
const labelTipo = (v) => TIPO_LABELS[v] || v || "-";
const labelEstado = (v) => ESTADO_LABELS[v] || v || "-";

const emptyForm = {
  employeeId: "",
  cycleId: "",
  tipo: "AUTOEVALUACION",
  estado: "BORRADOR",
  comentariosGenerales: "",
};

function defaultScore(metricId) {
  return { metricId, nivel: 3, comentario: "" };
}

function buildPrintableReport(data) {
  const fecha = new Date(data.evaluation.fecha).toLocaleDateString("es-AR");
  return `
    <html>
      <head>
        <title>Reporte individual</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
          h1 { margin: 0 0 6px 0; font-size: 28px; }
          h2 { margin: 20px 0 8px 0; font-size: 18px; }
          p { margin: 6px 0; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-top: 10px; }
          .muted { color: #64748b; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>ZENTOR</h1>
        <p class="muted">Reporte individual de evaluación</p>
        <p class="muted">Generado: ${new Date(data.generatedAt).toLocaleString("es-AR")}</p>

        <h2>Empleado</h2>
        <div class="card">
          <p><strong>Nombre:</strong> ${data.employee?.nombreCompleto || "-"}</p>
          <p><strong>Cargo:</strong> ${data.employee?.cargo || "-"}</p>
          <p><strong>Área:</strong> ${data.employee?.area || "-"}</p>
          <p><strong>Email:</strong> ${data.employee?.email || "-"}</p>
          <p><strong>Colegio:</strong> ${data.schoolName || "-"}</p>
        </div>

        <h2>Evaluación</h2>
        <div class="card">
          <p><strong>Tipo:</strong> ${data.evaluation?.tipo || "-"}</p>
          <p><strong>Estado:</strong> ${data.evaluation?.estado || "-"}</p>
          <p><strong>Resultado final:</strong> ${data.evaluation?.resultadoFinal ?? "-"}</p>
          <p><strong>Acuerdo:</strong> ${data.evaluation?.acuerdoEmpleado || "-"}</p>
          <p><strong>Fecha:</strong> ${fecha}</p>
          <p><strong>Comentarios:</strong> ${data.evaluation?.comentariosGenerales || "-"}</p>
        </div>
      </body>
    </html>
  `;
}

function SurfaceCard({ title, subtitle, children, actions }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[#7a98a8]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function EvaluationsPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const { searchQuery, setSearchQuery } = useView();
  const detailRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [selectedScores, setSelectedScores] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [scores, setScores] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [newEvaluationId, setNewEvaluationId] = useState(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailEditForm, setDetailEditForm] = useState({ estado: "", comentariosGenerales: "" });
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [myManager, setMyManager] = useState(null);
  const [isLoadingManager, setIsLoadingManager] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfHtml, setPdfHtml] = useState("");
  const iframeRef = useRef(null);

  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric._id, metric])), [metrics]);
  const visibleEvaluations = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return evaluations;
    return evaluations.filter((evaluation) =>
      [
        evaluation.employeeId?.nombre,
        evaluation.employeeId?.apellido,
        evaluation.tipo,
        evaluation.estado,
        evaluation.comentariosGenerales,
        evaluation.cycleId?.periodo,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [evaluations, searchQuery]);

  const completionByEmployee = useMemo(() => {
    const map = {};
    for (const ev of evaluations) {
      const id = ev.employeeId?._id || ev.employeeId;
      if (!id) continue;
      if (!map[id]) map[id] = { total: 0, closed: 0 };
      map[id].total += 1;
      if (ev.estado === "CERRADA") map[id].closed += 1;
    }
    return map;
  }, [evaluations]);

  const loadBaseData = useCallback(async (signal) => {
    setIsLoadingBase(true);
    try {
      const [employeesData, cyclesData, metricsData] = await Promise.all([
        apiFetch("/employees", { token, signal, timeoutMs: 20000 }),
        apiFetch("/evaluation-cycles", { token, signal, timeoutMs: 20000 }),
        apiFetch("/metrics", { token, signal, timeoutMs: 20000 }),
      ]);
      setEmployees(employeesData);
      setCycles(cyclesData);
      const activeC = cyclesData.find((c) => c.estado === "Inicio" || c.estado === "Activo");
      if (activeC) {
        setForm((prev) => ({ ...prev, cycleId: activeC._id }));
      }
      setMetrics(metricsData);
    } finally {
      setIsLoadingBase(false);
    }
  }, [token]);

  const loadEvaluations = useCallback(async (signal) => {
    setIsLoadingEvaluations(true);
    try {
      const evaluationsData = await apiFetch("/evaluations", {
        token,
        signal,
        timeoutMs: 20000,
      });
      setEvaluations(evaluationsData);
    } finally {
      setIsLoadingEvaluations(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    loadBaseData(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setMessageType("error");
        setMessage(error.message);
      }
    });
    loadEvaluations(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setMessageType("error");
        setMessage(error.message);
      }
    });
    return () => controller.abort();
  }, [loadBaseData, loadEvaluations]);

  useEffect(() => {
    setScores(metrics.map((metric) => defaultScore(metric._id)));
  }, [metrics]);

  useEffect(() => {
    if (form.tipo !== "EVALUACION_360") {
      setMyManager(null);
      // Clear the locked employeeId if switching away from 360
      setForm((prev) => (prev.tipo !== "EVALUACION_360" ? prev : { ...prev, employeeId: "" }));
      return;
    }
    let cancelled = false;
    setIsLoadingManager(true);
    apiFetch("/evaluations/my-managers", { token })
      .then((managers) => {
        if (cancelled) return;
        const manager = managers[0] || null;
        setMyManager(manager);
        setForm((prev) => ({ ...prev, employeeId: manager ? manager._id : "" }));
      })
      .catch(() => {
        if (!cancelled) setMyManager(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingManager(false);
      });
    return () => { cancelled = true; };
  }, [form.tipo, token]);

  function updateScore(metricId, field, value) {
    setScores((current) =>
      current.map((score) => (score.metricId === metricId ? { ...score, [field]: value } : score))
    );
  }

  async function loadEvaluationDetail(evaluationId) {
    try {
      setLoadingDetail(true);
      const data = await apiFetch(`/evaluations/${evaluationId}`, { token });
      setSelectedEvaluation(data.evaluation);
      setSelectedScores(data.scores || []);
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleSaveDetailEdit() {
    if (!selectedEvaluation?._id) return;
    try {
      setIsSavingDetail(true);
      await apiFetch(`/evaluations/${selectedEvaluation._id}`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: detailEditForm.estado,
          comentariosGenerales: detailEditForm.comentariosGenerales,
        }),
      });
      await loadEvaluations();
      await loadEvaluationDetail(selectedEvaluation._id);
      setIsEditingDetail(false);
      addToast({ message: "Evaluación actualizada.", type: "success" });
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSavingDetail(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.employeeId) nextErrors.employeeId = "Este campo es obligatorio";
    if (!form.cycleId) nextErrors.cycleId = "Este campo es obligatorio";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setMessageType("warning");
      setMessage("Completá los campos marcados antes de guardar.");
      return;
    }
    setFieldErrors({});
    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      const created = await apiFetch("/evaluations", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, scores }),
      });
      if (searchQuery) {
        setSearchQuery("");
      }
      setForm(emptyForm);
      setScores(metrics.map((metric) => defaultScore(metric._id)));
      setMessageType("success");
      setMessage("Evaluación creada.");
      addToast({ message: "Evaluación creada.", type: "success" });
      await loadEvaluations();
      if (created?._id) {
        setNewEvaluationId(created._id);
        setTimeout(() => setNewEvaluationId(null), 3000);
      }
      window.requestAnimationFrame(() => {
        document.getElementById("evaluations-list-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadIndividualReport(evaluationId) {
    try {
      setMessage("");
      setMessageType("info");
      const data = await apiFetch(`/education-exports/evaluation-report/${evaluationId}`, { token });
      const printable = buildPrintableReport(data);
      setPdfHtml(printable);
      setShowPdfPreview(true);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  async function handleBulkClose() {
    if (!selectedIds.size) return;
    setIsBulkLoading(true);
    try {
      const ids = [...selectedIds];
      try {
        await apiFetch('/evaluations/bulk', {
          method: 'PATCH',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, estado: 'CERRADA' }),
        });
      } catch {
        for (const id of ids) {
          await apiFetch(`/evaluations/${id}`, {
            method: 'PATCH',
            token,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'CERRADA' }),
          });
        }
      }
      setSelectedIds(new Set());
      await loadEvaluations();
      addToast({ message: `${ids.length} evaluación(es) cerradas.`, type: 'success' });
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    } finally {
      setIsBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    const confirmed = window.confirm(
      `¿Confirmás eliminar ${selectedIds.size} evaluación(es)? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setIsBulkLoading(true);
    try {
      const ids = [...selectedIds];
      try {
        await apiFetch('/evaluations/bulk', {
          method: 'DELETE',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      } catch {
        for (const id of ids) {
          await apiFetch(`/evaluations/${id}`, { method: 'DELETE', token });
        }
      }
      setSelectedIds(new Set());
      if (selectedEvaluation && ids.includes(selectedEvaluation._id)) {
        setSelectedEvaluation(null);
        setSelectedScores([]);
      }
      await loadEvaluations();
      addToast({ message: `${ids.length} evaluación(es) eliminadas.`, type: 'success' });
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    } finally {
      setIsBulkLoading(false);
    }
  }

  function toggleSelectId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleEvaluations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleEvaluations.map((e) => e._id)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Evaluaciones</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Gestión de evaluaciones</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section id="new-eval-form" className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">Nueva evaluación</h4>
          {(() => {
            const s1 = !!(form.employeeId && form.cycleId);
            const s3 = s1 && scores.some((s) => s.nivel > 0);
            const pill = (done, label) =>
              done
                ? `rounded-full border border-[#14b8a6]/40 bg-[#0d2826] px-3 py-1 text-xs text-[#14b8a6]`
                : `rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]`;
            return (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={pill(s1, "Paso 1")}>{s1 ? "✓ " : ""}Paso 1: Evaluado y ciclo</span>
                <span className={pill(s1, "Paso 2")}>{s1 ? "✓ " : ""}Paso 2: Tipo y estado</span>
                <span className={pill(s3, "Paso 3")}>{s3 ? "✓ " : ""}Paso 3: Puntajes</span>
              </div>
            );
          })()}
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Datos del evaluado</p>
            <div>
              {form.tipo === "EVALUACION_360" ? (
                <div className={`w-full rounded-2xl border px-4 py-3 text-white transition ${fieldErrors.employeeId ? "border-rose-400 bg-rose-500/5" : "border-white/15 bg-[#0f1f28]"}`}>
                  {isLoadingManager ? (
                    <span className="text-[#7a98a8]">Buscando tu jefe directo...</span>
                  ) : myManager ? (
                    <div>
                      <p className="font-semibold text-white">{myManager.apellido}, {myManager.nombre}</p>
                      <p className="mt-0.5 text-xs text-[#14b8a6]">Evaluarás a tu jefe directo</p>
                    </div>
                  ) : (
                    <span className="text-amber-300">No tenés un jefe directo asignado. Consultá con RRHH.</span>
                  )}
                </div>
              ) : (
                <select
                  className={`w-full rounded-2xl border px-4 py-3 text-white transition ${fieldErrors.employeeId ? "border-rose-400 bg-rose-500/5" : "border-white/15 bg-[#0f1f28]"}`}
                  value={form.employeeId}
                  onChange={(event) => {
                    setForm({ ...form, employeeId: event.target.value });
                    if (fieldErrors.employeeId) setFieldErrors((prev) => ({ ...prev, employeeId: "" }));
                  }}
                  onBlur={() => {
                    if (!form.employeeId) setFieldErrors((prev) => ({ ...prev, employeeId: "Este campo es obligatorio" }));
                    else setFieldErrors((prev) => ({ ...prev, employeeId: "" }));
                  }}
                >
                  <option value="">Seleccioná empleado</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.apellido}, {employee.nombre}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.employeeId && <p className="mt-1 px-1 text-xs text-rose-300">{fieldErrors.employeeId}</p>}
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-[#9fb6c4]">Ciclo o período</label>
              <p className="mb-1.5 text-xs text-[#5e7d8c]">Agrupa evaluaciones, metas y fechas bajo un mismo período.</p>
              <select
                className={`w-full rounded-2xl border px-4 py-3 text-white transition ${fieldErrors.cycleId ? "border-rose-400 bg-rose-500/5" : "border-white/15 bg-[#0f1f28]"}`}
                value={form.cycleId}
                onChange={(event) => {
                  setForm({ ...form, cycleId: event.target.value });
                  if (fieldErrors.cycleId) setFieldErrors((prev) => ({ ...prev, cycleId: "" }));
                }}
                onBlur={() => {
                  if (!form.cycleId) setFieldErrors((prev) => ({ ...prev, cycleId: "Este campo es obligatorio" }));
                  else setFieldErrors((prev) => ({ ...prev, cycleId: "" }));
                }}
              >
                <option value="">Seleccioná ciclo o período</option>
                {cycles.map((cycle) => (
                  <option key={cycle._id} value={cycle._id}>
                    {cycle.periodo} {cycle.anio} - {cycle.etapa}
                  </option>
                ))}
              </select>
              {fieldErrors.cycleId && <p className="mt-1 px-1 text-xs text-rose-300">{fieldErrors.cycleId}</p>}
            </div>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Cómo se evaluará</p>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.tipo}
                onChange={(event) => {
                  const newTipo = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    tipo: newTipo,
                    // Clear employeeId when leaving 360 so the user must pick again
                    employeeId: newTipo === "EVALUACION_360" ? prev.employeeId : (prev.tipo === "EVALUACION_360" ? "" : prev.employeeId),
                  }));
                }}
              >
                <option value="AUTOEVALUACION">Autoevaluación</option>
                <option value="JEFATURA">Evaluación de jefatura</option>
                <option value="FINAL">Cierre / final</option>
                {user?.roleCode === "EMPLEADO" && (
                  <option value="EVALUACION_360">360° — Evaluar a mi jefe</option>
                )}
              </select>
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="REVISADA">Revisada</option>
                <option value="CERRADA">Cerrada</option>
              </select>
            </div>
            <textarea className="min-h-24 max-h-48 w-full resize-y rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Comentarios generales" value={form.comentariosGenerales} onChange={(event) => setForm({ ...form, comentariosGenerales: event.target.value })} />

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-[#c5d5de]">Contenido evaluativo asociado</p>
              <CollapsibleList
                items={scores}
                initialCount={3}
                buttonLabelMore={`Ver más (${scores.length - 3})`}
                renderItem={(score) => {
                  const NIVEL_COLORS = ["", "bg-rose-500", "bg-amber-400", "bg-yellow-400", "bg-teal-400", "bg-emerald-400"];
                  const NIVEL_LABELS = ["", "Insuficiente", "Básico", "Esperado", "Destacado", "Excelente"];
                  return (
                  <div key={score.metricId} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{metricMap.get(score.metricId)?.nombre || "Indicador"}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${score.nivel ? "bg-white/10 text-[#d6e2e8]" : "text-[#7a98a8]"}`}>
                        {score.nivel ? NIVEL_LABELS[score.nivel] : "Sin calificar"}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updateScore(score.metricId, "nivel", n)}
                          className={`flex-1 h-8 rounded-xl border text-xs font-bold transition-all duration-150 ${
                            score.nivel === n
                              ? `${NIVEL_COLORS[n]} border-transparent text-white shadow-[0_0_8px_rgba(0,0,0,0.3)]`
                              : score.nivel > n
                                ? `${NIVEL_COLORS[score.nivel]} opacity-40 border-transparent text-white`
                                : "border-white/10 bg-[#122530] text-[#7a98a8] hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <input className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm text-white placeholder:text-[#7a98a8] outline-none focus:border-[#14b8a6]" placeholder="Comentario o evidencia breve" value={score.comentario} onChange={(event) => updateScore(score.metricId, "comentario", event.target.value)} />
                  </div>
                  );
                }}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#14b8a6] py-3 font-semibold text-[#0f172a]">
              {isSubmitting ? "Guardando..." : "Crear evaluación"}
            </button>
          </form>
        </section>

        <section id="evaluations-list-section" className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-[#0f1f28] accent-[#14b8a6]"
                checked={visibleEvaluations.length > 0 && selectedIds.size === visibleEvaluations.length}
                onChange={toggleSelectAll}
              />
              <span className="text-xs text-[#7f99a8]">Todas</span>
            </label>
            <h4 className="text-sm font-semibold text-white">Evaluaciones asignadas</h4>
            <div className="relative flex-1 min-w-[160px]">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7f99a8]"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M11 11l3 3" /></svg>
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] py-2 pl-8 pr-3 text-xs text-white outline-none transition focus:border-[#14b8a6] placeholder:text-[#7f99a8]" placeholder="Buscar evaluacion..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-[#0f1f28] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#7f99a8]">Registros</p>
              <p className="text-sm font-semibold text-white">{visibleEvaluations.length}</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {searchQuery ? (
              <div className="pf-alert-info flex flex-wrap items-center justify-between gap-3">
                <span>Hay una búsqueda activa. Limpiála para ver todas las evaluaciones.</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : null}
            {isLoadingBase || isLoadingEvaluations ? (
              <LoadingState compact title="Actualizando evaluaciones" description="Estamos trayendo ciclos, personas y resultados recientes." />
            ) : null}
            {!isLoadingBase && !isLoadingEvaluations && messageType === "error" && !evaluations.length ? (
              <ErrorState
                compact
                title="No pudimos cargar las evaluaciones"
                description="Reintentá para recuperar la lista del ciclo actual."
                actionLabel="Reintentar"
                onAction={() =>
                  loadEvaluations().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
              />
            ) : null}
            {!isLoadingBase && !isLoadingEvaluations && visibleEvaluations.length ? (
              <CollapsibleList
                items={visibleEvaluations}
                initialCount={3}
                className="space-y-4"
                renderItem={(evaluation) => (
                <article key={evaluation._id} className={`lift-item rounded-2xl border bg-[#0f1f28] p-4 ${newEvaluationId === evaluation._id ? "border-[#14b8a6]/50 ring-2 ring-[#14b8a6]/50" : selectedIds.has(evaluation._id) ? "border-[#14b8a6]/40" : "border-white/10"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-[#0f1f28] accent-[#14b8a6]"
                      checked={selectedIds.has(evaluation._id)}
                      onChange={() => toggleSelectId(evaluation._id)}
                    />
                  <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}</p>
                      <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{labelTipo(evaluation.tipo)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${evaluation.estado === "CERRADA" ? "bg-emerald-500/10 text-emerald-300" : evaluation.estado === "REVISADA" ? "bg-sky-500/10 text-sky-300" : evaluation.estado === "ENVIADA" ? "bg-amber-500/10 text-amber-300" : "bg-[#122530] text-[#8fa9b7]"}`}>{labelEstado(evaluation.estado)}</span>
                    </div>
                    {(() => {
                      const id = evaluation.employeeId?._id || evaluation.employeeId;
                      const stats = completionByEmployee[id];
                      if (!stats || stats.total <= 1) return null;
                      const allDone = stats.closed === stats.total;
                      return (
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${allDone ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-amber-300/25 bg-amber-500/8 text-amber-300"}`}>
                          {stats.closed}/{stats.total} cerradas
                        </span>
                      );
                    })()}
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{evaluation.cycleId?.periodo} {evaluation.cycleId?.anio} — Resultado final: {evaluation.resultadoFinal}</p>
                  <p className="mt-3 text-sm text-[#c5d5de]">{evaluation.comentariosGenerales || "Sin comentarios"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadEvaluationDetail(evaluation._id)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-[#c5d5de] hover:border-white/40 transition">
                      Ver detalle
                    </button>
                    <button type="button" onClick={() => downloadIndividualReport(evaluation._id)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 px-4 py-2 text-sm text-[#14b8a6] hover:bg-[#14b8a6]/10 transition">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>
                      Reporte
                    </button>
                  </div>
                  </div>
                  </div>
                </article>
                )}
              />
            ) : (
              !isLoadingBase && !isLoadingEvaluations && messageType !== "error" ? (
                <EmptyState
                  compact
                  title={user?.roleCode === "EMPLEADO" ? "Todavía no tenés evaluaciones cargadas" : "Todavía no hay evaluaciones registradas"}
                  description={
                    user?.roleCode === "EMPLEADO"
                      ? "Cuando te asignen un ciclo o una autoevaluación, la vas a ver acá."
                      : "Creá la primera evaluación para empezar a seguir resultados por persona."
                  }
                  actionLabel={user?.roleCode !== "EMPLEADO" ? "Nueva evaluación" : undefined}
                  onAction={user?.roleCode !== "EMPLEADO" ? () => document.getElementById("new-eval-form")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
                />
              ) : null
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 left-0 right-0 flex items-center gap-3 rounded-2xl border border-[#14b8a6]/30 bg-[#0c1e28] px-4 py-3 shadow-xl">
              <span className="flex-1 text-sm font-semibold text-white">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
              <button
                type="button"
                disabled={isBulkLoading}
                onClick={handleBulkClose}
                className="rounded-xl bg-[#14b8a6]/10 border border-[#14b8a6]/30 px-3 py-1.5 text-xs font-semibold text-[#14b8a6] hover:bg-[#14b8a6]/20 transition disabled:opacity-50"
              >
                Cerrar seleccionadas
              </button>
              <button
                type="button"
                disabled={isBulkLoading}
                onClick={handleBulkDelete}
                className="rounded-xl bg-rose-500/10 border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
              >
                Eliminar seleccionadas
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#c5d5de] hover:border-white/30 transition"
              >
                Deseleccionar todo
              </button>
            </div>
          )}
        </section>
      </div>

      <div ref={detailRef}>
        <SurfaceCard
          title={selectedEvaluation ? "Detalle de evaluación" : "Detalle de evaluación"}
          subtitle={selectedEvaluation ? "Acercamos la lectura al formulario real: datos del evaluado, mediciones, resumen y comentarios." : "Seleccioná una evaluación para ver datos del evaluado, mediciones, evidencias y resumen evaluativo."}
          actions={
            selectedEvaluation ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#d6e2e8]">{labelEstado(selectedEvaluation.estado)}</span>
                {!isEditingDetail ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDetail(true);
                      setDetailEditForm({
                        estado: selectedEvaluation.estado || "BORRADOR",
                        comentariosGenerales: selectedEvaluation.comentariosGenerales || "",
                      });
                    }}
                    className="rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 px-3 py-1.5 text-xs font-semibold text-[#14b8a6] transition hover:bg-[#14b8a6]/15"
                  >
                    Editar evaluación
                  </button>
                ) : null}
              </div>
            ) : null
          }
        >
          {loadingDetail ? (
            <LoadingState compact title="Cargando detalle" description="Estamos trayendo mediciones, comentarios y resultado final." />
          ) : !selectedEvaluation ? (
            <EmptyState compact title="Todavía no elegiste una evaluación" description="Usá «Ver detalle» en la lista para abrir mediciones, comentarios y el resultado final." />
          ) : isEditingDetail ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Estado</label>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={detailEditForm.estado}
                  onChange={(e) => setDetailEditForm((prev) => ({ ...prev, estado: e.target.value }))}
                >
                  <option value="BORRADOR">Borrador</option>
                  <option value="ENVIADA">Enviada</option>
                  <option value="REVISADA">Revisada</option>
                  <option value="CERRADA">Cerrada</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Comentarios generales</label>
                <textarea
                  className="min-h-28 max-h-48 w-full resize-y rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white placeholder:text-[#7a98a8]"
                  placeholder="Comentarios sobre la evaluación"
                  value={detailEditForm.comentariosGenerales}
                  onChange={(e) => setDetailEditForm((prev) => ({ ...prev, comentariosGenerales: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSavingDetail}
                  onClick={handleSaveDetailEdit}
                  className="rounded-2xl bg-[#14b8a6] px-5 py-2.5 font-semibold text-[#0f172a] disabled:opacity-60"
                >
                  {isSavingDetail ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDetail(false)}
                  className="rounded-2xl border border-white/20 px-5 py-2.5 font-semibold text-[#c5d5de]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Evaluado</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedEvaluation.employeeId?.apellido}, {selectedEvaluation.employeeId?.nombre}
                  </p>
                </article>
                <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Cargo</p>
                  <p className="mt-2 text-base font-semibold text-white">{selectedEvaluation.employeeId?.cargo || "-"}</p>
                </article>
                <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Área</p>
                  <p className="mt-2 text-base font-semibold text-white">{selectedEvaluation.employeeId?.area || "-"}</p>
                </article>
                <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Ciclo</p>
                  <p className="mt-2 text-base font-semibold text-white">{selectedEvaluation.cycleId?.periodo} {selectedEvaluation.cycleId?.anio}</p>
                </article>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <SurfaceCard title="Contenido evaluativo asociado" subtitle="Acá concentramos las mediciones visibles del formulario actual.">
                    <div className="space-y-3">
                      <CollapsibleList
                        items={selectedScores}
                        initialCount={3}
                        buttonLabelMore={`Ver más (${selectedScores.length - 3})`}
                        emptyState={<EmptyState compact title="No hay mediciones cargadas" description="Esta evaluación todavía no tiene metas o competencias detalladas." />}
                        renderItem={(score) => {
                          const N_COLORS = ["","bg-rose-500","bg-amber-400","bg-yellow-400","bg-teal-400","bg-emerald-400"];
                          const N_LABELS = ["","Insuficiente","Básico","Esperado","Destacado","Excelente"];
                          const n = score.nivel || 0;
                          return (
                          <article key={score._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-semibold text-white">{score.metricId?.nombre || "Indicador"}</p>
                              {n > 0 && <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${N_COLORS[n]} text-white`}>{N_LABELS[n]}</span>}
                            </div>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map((i) => (
                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= n ? N_COLORS[n] : "bg-white/10"}`} />
                              ))}
                            </div>
                            {score.comentario && <p className="text-sm text-[#9fb6c4]">{score.comentario}</p>}
                          </article>
                        );}}
                      />
                    </div>
                  </SurfaceCard>
                </div>

                <div className="space-y-4">
                  <SurfaceCard title="Resumen evaluativo" subtitle="Mostramos lo disponible hoy sin inventar promedios que no existan.">
                    <div className="grid gap-3">
                      <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Resultado final</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{selectedEvaluation.resultadoFinal ?? "-"}</p>
                      </article>
                      <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Comentarios de la evaluación</p>
                        <p className="mt-2 text-sm text-[#9fb6c4]">{selectedEvaluation.comentariosGenerales || "Sin comentarios generales."}</p>
                      </article>
                      <article className="lift-item rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Evidencias</p>
                        <p className="mt-2 text-sm text-[#9fb6c4]">
                          {Array.isArray(selectedEvaluation.evidenciaUrls) && selectedEvaluation.evidenciaUrls.length
                            ? `${selectedEvaluation.evidenciaUrls.length} evidencias registradas`
                            : "Sin evidencias adjuntas visibles."}
                        </p>
                      </article>
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </div>
          )}
        </SurfaceCard>
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

      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setShowPdfPreview(false); }}>
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white" style={{ height: '80vh' }}>
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">Vista previa del reporte</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => iframeRef.current?.contentWindow?.print()}
                  className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d9488] transition"
                >
                  Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(false)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <iframe
              ref={iframeRef}
              srcDoc={pdfHtml}
              title="Vista previa del reporte"
              className="flex-1 w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
