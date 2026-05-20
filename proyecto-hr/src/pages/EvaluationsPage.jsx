import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";

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
        <h1>Performia</h1>
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

export default function EvaluationsPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [scores, setScores] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);

  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric._id, metric])), [metrics]);
  const roleScope = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
  const baseCacheKey = `pf_eval_base_${roleScope}`;
  const evaluationsCacheKey = `pf_eval_list_${roleScope}`;
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
      sessionStorage.setItem(
        baseCacheKey,
        JSON.stringify({ employees: employeesData, cycles: cyclesData, metrics: metricsData })
      );
    } finally {
      setIsLoadingBase(false);
    }
  }, [baseCacheKey, token]);

  const loadEvaluations = useCallback(async (signal) => {
    setIsLoadingEvaluations(true);
    try {
      const evaluationsData = await apiFetch("/evaluations", {
        token,
        signal,
        timeoutMs: 20000,
      });
      setEvaluations(evaluationsData);
      sessionStorage.setItem(evaluationsCacheKey, JSON.stringify(evaluationsData));
    } finally {
      setIsLoadingEvaluations(false);
    }
  }, [evaluationsCacheKey, token]);

  useEffect(() => {
    const cachedBase = sessionStorage.getItem(baseCacheKey);
    if (cachedBase) {
      try {
        const parsed = JSON.parse(cachedBase);
        setEmployees(parsed.employees || []);
        setCycles(parsed.cycles || []);
        setMetrics(parsed.metrics || []);
      } catch {
        sessionStorage.removeItem(baseCacheKey);
      }
    }

    const cachedEvaluations = sessionStorage.getItem(evaluationsCacheKey);
    if (cachedEvaluations) {
      try {
        setEvaluations(JSON.parse(cachedEvaluations) || []);
      } catch {
        sessionStorage.removeItem(evaluationsCacheKey);
      }
    }

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
  }, [baseCacheKey, evaluationsCacheKey, loadBaseData, loadEvaluations]);

  useEffect(() => {
    setScores(metrics.map((metric) => defaultScore(metric._id)));
  }, [metrics]);

  function updateScore(metricId, field, value) {
    setScores((current) =>
      current.map((score) => (score.metricId === metricId ? { ...score, [field]: value } : score))
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.employeeId || !form.cycleId) {
      setMessageType("warning");
      setMessage("Selecciona empleado y periodo para guardar la evaluación.");
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
      setForm(emptyForm);
      setScores(metrics.map((metric) => defaultScore(metric._id)));
      setMessageType("success");
      setMessage("Evaluación creada.");
      await loadEvaluations();
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
        setMessage("Tu navegador bloqueo la ventana del reporte.");
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
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Seguimiento de desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Evaluaciones</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Crea, revisa y sigue evaluaciones por persona y por ciclo con una vista clara del estado actual.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">
            Ciclos, personas y puntajes en una sola vista
          </span>
          <button
            type="button"
            onClick={() =>
              loadEvaluations().catch((error) => {
                setMessageType("error");
                setMessage(error.message);
              })
            }
            className="rounded-full border border-white/15 bg-[#122530] px-3 py-1 text-xs font-medium text-white"
          >
            Actualizar lista
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-[#7f99a8]">Que son las evaluaciones</p>
            <h4 className="mt-2 text-xl font-semibold text-white">Medir desempeno para dar feedback y orientar desarrollo</h4>
            <p className="mt-3 text-sm leading-relaxed text-[#9fb6c4]">
              Las evaluaciones permiten medir el desempeno de una persona o equipo durante un ciclo. Sirven para generar feedback,
              detectar brechas y alimentar planes de desarrollo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5 xl:grid-cols-1">
            {["Ciclo", "Evaluacion", "Feedback", "Plan de desarrollo", "Reporte"].map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Paso {index + 1}</p>
                <p className="mt-2 text-sm font-semibold text-white">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">Nueva evaluación</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Empleado y periodo</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Tipo y estado</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Puntajes</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Seleccion base</p>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
              <option value="">Selecciona empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.cycleId} onChange={(event) => setForm({ ...form, cycleId: event.target.value })}>
              <option value="">Selecciona periodo</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.periodo} {cycle.anio} - {cycle.etapa}
                </option>
              ))}
            </select>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">2. Cómo se evaluará</p>
            <p className="text-sm text-[#9fb6c4]">
              El contexto define a quién se evalúa, con qué criterios y en qué período.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}>
                <option value="AUTOEVALUACION">Autoevaluación</option>
                <option value="JEFATURA">Jefatura</option>
                <option value="FINAL">Final</option>
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
              <p className="text-sm font-semibold text-[#c5d5de]">3. Puntajes por indicador</p>
              {scores.map((score) => (
                <div key={score.metricId} className="grid gap-3 md:grid-cols-[1fr_0.22fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3 text-sm text-white">{metricMap.get(score.metricId)?.nombre || "Indicador"}</div>
                  <select className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={score.nivel} onChange={(event) => updateScore(score.metricId, "nivel", Number(event.target.value))}>
                    {[1, 2, 3, 4, 5].map((nivel) => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </select>
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" placeholder="Comentario breve" value={score.comentario} onChange={(event) => updateScore(score.metricId, "comentario", event.target.value)} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : "Crear evaluación"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold text-white">Evaluaciones registradas</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">
                Revisa el avance por persona y abre el reporte individual cuando haga falta.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Registros</p>
              <p className="mt-1 text-lg font-semibold text-white">{evaluations.length}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {isLoadingBase || isLoadingEvaluations ? (
              <LoadingState
                compact
                title="Actualizando evaluaciones"
                description="Estamos trayendo ciclos, personas y resultados recientes."
              />
            ) : null}
            {!isLoadingBase && !isLoadingEvaluations && messageType === "error" && !evaluations.length ? (
              <ErrorState
                compact
                title="No pudimos cargar las evaluaciones"
                description="Reintenta para recuperar la lista del ciclo actual."
                actionLabel="Reintentar"
                onAction={() =>
                  loadEvaluations().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
              />
            ) : null}
            {!isLoadingBase && !isLoadingEvaluations && evaluations.length ? (
              evaluations.map((evaluation) => (
                <article key={evaluation._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-white">{evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}</p>
                    <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{evaluation.tipo}</span>
                    <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{evaluation.estado}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{evaluation.cycleId?.periodo} {evaluation.cycleId?.anio} - Resultado final: {evaluation.resultadoFinal}</p>
                  <p className="mt-3 text-sm text-[#c5d5de]">{evaluation.comentariosGenerales || "Sin comentarios"}</p>
                  <button type="button" onClick={() => downloadIndividualReport(evaluation._id)} className="mt-3 rounded-xl border border-white/20 px-4 py-2 text-sm text-[#c5d5de]">
                    Ver reporte individual
                  </button>
                </article>
              ))
            ) : (
              !isLoadingBase && !isLoadingEvaluations && messageType !== "error" ? (
                <EmptyState
                  compact
                  title={user?.roleCode === "EMPLEADO" ? "Todavía no tienes evaluaciones cargadas" : "Todavía no hay evaluaciones registradas"}
                  description={
                    user?.roleCode === "EMPLEADO"
                      ? "Cuando te asignen un ciclo o una autoevaluación, la vas a ver acá."
                      : "Crea la primera evaluación para empezar a seguir resultados por persona."
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
    </div>
  );
}



