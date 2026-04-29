import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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

export default function EvaluationsPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [scores, setScores] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric._id, metric])), [metrics]);

  async function loadData() {
    const [employeesData, cyclesData, metricsData, evaluationsData] = await Promise.all([
      apiFetch("/employees", { token }),
      apiFetch("/evaluation-cycles", { token }),
      apiFetch("/metrics", { token }),
      apiFetch("/evaluations", { token }),
    ]);
    setEmployees(employeesData);
    setCycles(cyclesData);
    setMetrics(metricsData);
    setEvaluations(evaluationsData);
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    setScores(metrics.map((metric) => defaultScore(metric._id)));
  }, [metrics]);

  function updateScore(metricId, field, value) {
    setScores((current) =>
      current.map((score) =>
        score.metricId === metricId ? { ...score, [field]: value } : score
      )
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/evaluations", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scores,
        }),
      });
      setForm(emptyForm);
      setScores(metrics.map((metric) => defaultScore(metric._id)));
      setMessage("Evaluación creada");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Seguimiento del desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Evaluaciones</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Registra autoevaluaciones, evaluaciones de jefatura y cierres finales con puntaje por
          métrica, comentarios y trazabilidad.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nueva evaluación</h4>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.employeeId}
              onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
            >
              <option value="">Selecciona empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.cycleId}
              onChange={(event) => setForm({ ...form, cycleId: event.target.value })}
            >
              <option value="">Selecciona ciclo</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.periodo} {cycle.anio} · {cycle.etapa}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.tipo}
                onChange={(event) => setForm({ ...form, tipo: event.target.value })}
              >
                <option value="AUTOEVALUACION">Autoevaluación</option>
                <option value="JEFATURA">Jefatura</option>
                <option value="FINAL">Final</option>
              </select>
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value })}
              >
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="REVISADA">Revisada</option>
                <option value="CERRADA">Cerrada</option>
              </select>
            </div>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Comentarios generales"
              value={form.comentariosGenerales}
              onChange={(event) => setForm({ ...form, comentariosGenerales: event.target.value })}
            />

            <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Puntajes por métrica</p>
              {scores.map((score) => (
                <div key={score.metricId} className="grid gap-3 md:grid-cols-[1fr_0.22fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {metricMap.get(score.metricId)?.nombre || "Métrica"}
                  </div>
                  <select
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    value={score.nivel}
                    onChange={(event) => updateScore(score.metricId, "nivel", Number(event.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((nivel) => (
                      <option key={nivel} value={nivel}>
                        {nivel}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    placeholder="Comentario breve"
                    value={score.comentario}
                    onChange={(event) => updateScore(score.metricId, "comentario", event.target.value)}
                  />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : "Crear evaluación"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Evaluaciones registradas</h4>
          <div className="mt-6 space-y-4">
            {evaluations.length ? (
              evaluations.map((evaluation) => (
                <article key={evaluation._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-950">
                      {evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{evaluation.tipo}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{evaluation.estado}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {evaluation.cycleId?.periodo} {evaluation.cycleId?.anio} · Resultado final: {evaluation.resultadoFinal}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{evaluation.comentariosGenerales || "Sin comentarios"}</p>
                </article>
              ))
            ) : (
              <p className="text-slate-500">
                {user?.roleCode === "EMPLEADO"
                  ? "Todavía no tienes evaluaciones cargadas."
                  : "Todavía no hay evaluaciones registradas."}
              </p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
