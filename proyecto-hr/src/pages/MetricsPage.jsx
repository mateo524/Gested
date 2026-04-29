import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const defaultLevels = [
  { nivel: 1, etiqueta: "Insatisfactorio", descripcion: "" },
  { nivel: 2, etiqueta: "Minimo", descripcion: "" },
  { nivel: 3, etiqueta: "En desarrollo", descripcion: "" },
  { nivel: 4, etiqueta: "Competente", descripcion: "" },
  { nivel: 5, etiqueta: "Excepcional", descripcion: "" },
];

const emptyForm = {
  schoolId: "",
  competencyId: "",
  nombre: "",
  descripcion: "",
  cargoAplica: "",
  ponderacion: 1,
  levels: defaultLevels,
};

export default function MetricsPage() {
  const { token } = useAuth();
  const [schools, setSchools] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleCompetencies = useMemo(
    () => competencies.filter((item) => !form.schoolId || item.schoolId === form.schoolId || item.schoolId === null),
    [competencies, form.schoolId]
  );

  async function loadData() {
    const [schoolsData, competenciesData, metricsData] = await Promise.all([
      apiFetch("/schools", { token }),
      apiFetch("/competencies", { token }),
      apiFetch("/metrics", { token }),
    ]);
    setSchools(schoolsData);
    setCompetencies(competenciesData);
    setMetrics(metricsData);
    if (!form.schoolId && schoolsData[0]?._id) {
      setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
    }
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  function updateLevel(index, field, value) {
    const nextLevels = [...form.levels];
    nextLevels[index] = { ...nextLevels[index], [field]: value };
    setForm({ ...form, levels: nextLevels });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/metrics", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cargoAplica: form.cargoAplica
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      setForm((current) => ({
        ...emptyForm,
        schoolId: current.schoolId,
        levels: defaultLevels,
      }));
      setMessage("Métrica creada");
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
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Motor de evaluación</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Métricas y niveles</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Crea métricas observables asociadas a competencias, con ponderación y niveles claros de
          evaluación del 1 al 5.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nueva métrica</h4>
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
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.competencyId}
              onChange={(event) => setForm({ ...form, competencyId: event.target.value })}
            >
              <option value="">Selecciona competencia</option>
              {visibleCompetencies.map((competency) => (
                <option key={competency._id} value={competency._id}>
                  {competency.nombre}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre de la métrica"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Cargos a los que aplica"
                value={form.cargoAplica}
                onChange={(event) => setForm({ ...form, cargoAplica: event.target.value })}
              />
              <input
                type="number"
                min="1"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Ponderación"
                value={form.ponderacion}
                onChange={(event) => setForm({ ...form, ponderacion: Number(event.target.value) })}
              />
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Niveles 1 a 5</p>
              {form.levels.map((level, index) => (
                <div key={level.nivel} className="grid gap-3 md:grid-cols-[0.18fr_0.4fr_1fr]">
                  <input
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    value={level.nivel}
                    disabled
                  />
                  <input
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    value={level.etiqueta}
                    onChange={(event) => updateLevel(index, "etiqueta", event.target.value)}
                  />
                  <input
                    className="rounded-2xl border border-slate-300 px-4 py-3"
                    placeholder="Descripción del nivel"
                    value={level.descripcion}
                    onChange={(event) => updateLevel(index, "descripcion", event.target.value)}
                  />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : "Crear métrica"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Métricas cargadas</h4>
          <div className="mt-6 space-y-4">
            {metrics.length ? (
              metrics.map((metric) => (
                <article key={metric._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <p className="text-lg font-semibold text-slate-950">{metric.nombre}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ponderación: {metric.ponderacion} · Cargos: {(metric.cargoAplica || []).join(", ") || "General"}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {(metric.levels || []).map((level) => (
                      <div key={`${metric._id}-${level.nivel}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="font-semibold text-slate-900">{level.nivel} - {level.etiqueta}</span>
                        <p className="mt-1 text-slate-500">{level.descripcion || "Sin descripción"}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavía no hay métricas cargadas.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
