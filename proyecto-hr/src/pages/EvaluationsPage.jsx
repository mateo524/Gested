import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import CollapsibleList from "../components/CollapsibleList";

const TIPO_LABELS = {
  AUTOEVALUACION: "Autoevaluación",
  JEFATURA: "Jefatura",
  FINAL: "Cierre final",
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
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#93acbb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function EvaluationsPage() {
  const { token, user } = useAuth();
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
  const [scores, setScores] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.employeeId || !form.cycleId) {
      setMessageType("warning");
      setMessage("Seleccioná empleado y período para guardar la evaluación.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      await apiFetch("/evaluations", {
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
      await loadEvaluations();
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
      const popup = window.open("", "_blank", "width=900,height=800");
      if (!popup) {
        setMessageType("warning");
        setMessage("Tu navegador bloqueó la ventana del reporte.");
        return;
      }
      popup.document.open();
      popup.document.write(printable);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 md:p-7">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Seguimiento de desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Gestión de evaluaciones</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Una evaluación mide desempeño durante un ciclo. El contexto define a quién se evalúa, con qué criterios y en qué período.
        </p>
      </section>

      <SurfaceCard title="Cómo se construye una evaluación" subtitle="Tomamos como referencia el flujo real de desempeño del formulario 2024.">
        <div className="grid gap-3 md:grid-cols-6">
          {["Ciclo", "Metas / competencias", "Autoevaluación", "Evaluación superior", "Evidencias", "Resumen"].map((step, index) => (
            <article key={step} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Paso {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-white">{step}</p>
            </article>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">Nueva evaluación</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Evaluado y ciclo</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Tipo y estado</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Puntajes</span>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Datos del evaluado</p>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
              <option value="">Seleccioná empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs text-[#9fb6c4]">
              <span title="Período de evaluación activo. Un ciclo agrupa evaluaciones, metas y fechas bajo un mismo contexto temporal." className="cursor-help underline decoration-dotted">Ciclo o período</span>
            </label>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.cycleId} onChange={(event) => setForm({ ...form, cycleId: event.target.value })}>
              <option value="">Seleccioná ciclo o período</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.periodo} {cycle.anio} - {cycle.etapa}
                </option>
              ))}
            </select>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Cómo se evaluará</p>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}>
                <option value="AUTOEVALUACION">Autoevaluación</option>
                <option value="JEFATURA">Evaluación de jefatura</option>
                <option value="FINAL">Cierre / final</option>
              </select>
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="REVISADA">Revisada</option>
                <option value="CERRADA">Cerrada</option>
              </select>
            </div>
            <textarea className="min-h-24 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Comentarios generales" value={form.comentariosGenerales} onChange={(event) => setForm({ ...form, comentariosGenerales: event.target.value })} />

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-[#c5d5de]">Contenido evaluativo asociado</p>
              <CollapsibleList
                items={scores}
                initialCount={3}
                buttonLabelMore={`Ver más (${scores.length - 3})`}
                renderItem={(score) => (
                  <div key={score.metricId} className="grid gap-3 md:grid-cols-[1fr_0.22fr_1fr]">
                    <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3 text-sm text-white">{metricMap.get(score.metricId)?.nombre || "Indicador"}</div>
                    <select className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={score.nivel} onChange={(event) => updateScore(score.metricId, "nivel", Number(event.target.value))}>
                      {[1, 2, 3, 4, 5].map((nivel) => (
                        <option key={nivel} value={nivel}>{nivel}</option>
                      ))}
                    </select>
                    <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" placeholder="Comentario o evidencia breve" value={score.comentario} onChange={(event) => updateScore(score.metricId, "comentario", event.target.value)} />
                  </div>
                )}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#14b8a6] py-3 font-semibold text-[#0f172a]">
              {isSubmitting ? "Guardando..." : "Crear evaluación"}
            </button>
          </form>
        </section>

        <section id="evaluations-list-section" className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold text-white">Evaluaciones asignadas</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">Revisá la lista visible y abrí el detalle cuando quieras leer datos, mediciones y comentarios.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Registros</p>
              <p className="mt-1 text-lg font-semibold text-white">{visibleEvaluations.length}</p>
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
                <article key={evaluation._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-white">{evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}</p>
                    <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{labelTipo(evaluation.tipo)}</span>
                    <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{labelEstado(evaluation.estado)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{evaluation.cycleId?.periodo} {evaluation.cycleId?.anio} — Resultado final: {evaluation.resultadoFinal}</p>
                  <p className="mt-3 text-sm text-[#c5d5de]">{evaluation.comentariosGenerales || "Sin comentarios"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadEvaluationDetail(evaluation._id)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-[#c5d5de]">
                      Ver detalle
                    </button>
                    <button type="button" onClick={() => downloadIndividualReport(evaluation._id)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-[#c5d5de]">
                      Ver reporte individual
                    </button>
                  </div>
                </article>
                )}
              />
            ) : (
              !isLoadingBase && !isLoadingEvaluations && messageType !== "error" ? (
                <EmptyState
                  compact
                  title={user?.roleCode === "EMPLEADO" ? "Todavía no tienes evaluaciones cargadas" : "Todavía no hay evaluaciones registradas"}
                  description={
                    user?.roleCode === "EMPLEADO"
                      ? "Cuando te asignen un ciclo o una autoevaluación, la vas a ver acá."
                      : "Creá la primera evaluación para empezar a seguir resultados por persona."
                  }
                />
              ) : null
            )}
          </div>
        </section>
      </div>

      <div ref={detailRef}>
        <SurfaceCard
          title={selectedEvaluation ? "Detalle de evaluación" : "Detalle de evaluación"}
          subtitle={selectedEvaluation ? "Acercamos la lectura al formulario real: datos del evaluado, mediciones, resumen y comentarios." : "Seleccioná una evaluación para ver datos del evaluado, mediciones, evidencias y resumen evaluativo."}
          actions={selectedEvaluation ? <span className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#d6e2e8]">{labelEstado(selectedEvaluation.estado)}</span> : null}
        >
          {loadingDetail ? (
            <LoadingState compact title="Cargando detalle" description="Estamos trayendo mediciones, comentarios y resultado final." />
          ) : !selectedEvaluation ? (
            <EmptyState compact title="Todavía no elegiste una evaluación" description="Usá «Ver detalle» en la lista para abrir mediciones, comentarios y el resultado final." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Evaluado</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedEvaluation.employeeId?.apellido}, {selectedEvaluation.employeeId?.nombre}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Cargo</p>
                  <p className="mt-2 text-base font-semibold text-white">{selectedEvaluation.employeeId?.cargo || "-"}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Área</p>
                  <p className="mt-2 text-base font-semibold text-white">{selectedEvaluation.employeeId?.area || "-"}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
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
                        renderItem={(score) => (
                          <article key={score._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{score.metricId?.nombre || "Indicador"}</p>
                                <p className="mt-1 text-sm text-[#9fb6c4]">{score.comentario || "Sin comentario asociado."}</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d5e2e9]">
                                Nivel {score.nivel}
                              </span>
                            </div>
                          </article>
                        )}
                      />
                    </div>
                  </SurfaceCard>
                </div>

                <div className="space-y-4">
                  <SurfaceCard title="Resumen evaluativo" subtitle="Mostramos lo disponible hoy sin inventar promedios que no existan.">
                    <div className="grid gap-3">
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Resultado final</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{selectedEvaluation.resultadoFinal ?? "-"}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Comentarios de la evaluación</p>
                        <p className="mt-2 text-sm text-[#9fb6c4]">{selectedEvaluation.comentariosGenerales || "Sin comentarios generales."}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
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
    </div>
  );
}
