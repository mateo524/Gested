import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  schoolId: "",
  anio: new Date().getFullYear(),
  periodo: "",
  etapa: "INICIO",
  estado: "BORRADOR",
  fechaInicio: "",
  fechaFin: "",
};

export default function EvaluationCyclesPage() {
  const { token } = useAuth();
  const [schools, setSchools] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const [schoolsData, cyclesData] = await Promise.all([
      apiFetch("/schools", { token }),
      apiFetch("/evaluation-cycles", { token }),
    ]);
    setSchools(schoolsData);
    setCycles(cyclesData);
    if (!form.schoolId && schoolsData[0]?._id) {
      setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
    }
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/evaluation-cycles", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
      setMessage("Ciclo creado");
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
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Calendario institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Ciclos de evaluación</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Organiza los períodos de desempeño por colegio, etapa y fechas para ordenar autoevaluaciones,
          jefaturas y cierres finales.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nuevo ciclo</h4>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.schoolId}
              onChange={(event) => setForm({ ...form, schoolId: event.target.value })}
            >
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="number"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.anio}
                onChange={(event) => setForm({ ...form, anio: Number(event.target.value) })}
              />
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Periodo"
                value={form.periodo}
                onChange={(event) => setForm({ ...form, periodo: event.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.etapa}
                onChange={(event) => setForm({ ...form, etapa: event.target.value })}
              >
                <option value="INICIO">Inicio</option>
                <option value="REVISION_INTERMEDIA">Revisión intermedia</option>
                <option value="EVALUACION_FINAL">Evaluación final</option>
              </select>
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value })}
              >
                <option value="BORRADOR">Borrador</option>
                <option value="ABIERTO">Abierto</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="date"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.fechaInicio}
                onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })}
              />
              <input
                type="date"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.fechaFin}
                onChange={(event) => setForm({ ...form, fechaFin: event.target.value })}
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : "Crear ciclo"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Ciclos cargados</h4>
          <div className="mt-6 space-y-4">
            {cycles.length ? (
              cycles.map((cycle) => (
                <article key={cycle._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-950">{cycle.periodo} {cycle.anio}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{cycle.etapa}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{cycle.estado}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {cycle.fechaInicio ? new Date(cycle.fechaInicio).toLocaleDateString("es-AR") : "-"} al{" "}
                    {cycle.fechaFin ? new Date(cycle.fechaFin).toLocaleDateString("es-AR") : "-"}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavía no hay ciclos definidos.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
