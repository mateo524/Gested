import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const baseLevels = [
  { nivel: 1, etiqueta: "Insatisfactorio", descripcion: "" },
  { nivel: 2, etiqueta: "Minimo", descripcion: "" },
  { nivel: 3, etiqueta: "En desarrollo", descripcion: "" },
  { nivel: 4, etiqueta: "Competente", descripcion: "" },
  { nivel: 5, etiqueta: "Excepcional", descripcion: "" },
];

const buildDefaultLevels = () => baseLevels.map((level) => ({ ...level }));

const emptyForm = {
  schoolId: "",
  competencyId: "",
  nombre: "",
  descripcion: "",
  cargoAplica: "",
  ponderacion: 1,
  levels: buildDefaultLevels(),
};

export default function MetricsPage() {
  const { token } = useAuth();
  const [schools, setSchools] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");

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
      const payload = {
        ...form,
        cargoAplica: form.cargoAplica.split(",").map((item) => item.trim()).filter(Boolean),
      };
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/metrics/${editingId}` : "/metrics", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, levels: buildDefaultLevels() }));
      setEditingId("");
      setMessage(isEditing ? "Metrica actualizada" : "Metrica creada");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(metric) {
    setEditingId(metric._id);
    setForm({
      schoolId: metric.schoolId || "",
      competencyId: metric.competencyId || "",
      nombre: metric.nombre || "",
      descripcion: metric.descripcion || "",
      cargoAplica: (metric.cargoAplica || []).join(", "),
      ponderacion: Number(metric.ponderacion || 1),
      levels: (metric.levels?.length
        ? metric.levels
        : buildDefaultLevels()
      ).map((level) => ({
        nivel: Number(level.nivel),
        etiqueta: level.etiqueta || "",
        descripcion: level.descripcion || "",
      })),
    });
    setMessage("Editando metrica seleccionada");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, levels: buildDefaultLevels() }));
    setMessage("Edicion cancelada");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Motor de evaluacion</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Metricas y niveles</h3>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">{editingId ? "Editar metrica" : "Nueva metrica"}</h4>
          <p className="mt-2 text-sm text-slate-500">
            Crea el indicador puntual que se puntua de 1 a 5 dentro de una competencia.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select className="w-full rounded-2xl border border-slate-300 px-4 py-3" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>{school.nombre}</option>
              ))}
            </select>
            <select className="w-full rounded-2xl border border-slate-300 px-4 py-3" value={form.competencyId} onChange={(e) => setForm({ ...form, competencyId: e.target.value })}>
              <option value="">Selecciona competencia</option>
              {visibleCompetencies.map((competency) => (
                <option key={competency._id} value={competency._id}>{competency.nombre}</option>
              ))}
            </select>
            <input className="w-full rounded-2xl border border-slate-300 px-4 py-3" placeholder="Nombre de la metrica" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <textarea className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3" placeholder="Descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Cargos (separados por coma)" value={form.cargoAplica} onChange={(e) => setForm({ ...form, cargoAplica: e.target.value })} />
              <input type="number" min="1" className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Ponderacion" value={form.ponderacion} onChange={(e) => setForm({ ...form, ponderacion: Number(e.target.value) })} />
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Niveles 1 a 5</p>
              {form.levels.map((level, index) => (
                <div key={level.nivel} className="grid gap-3 md:grid-cols-[0.18fr_0.4fr_1fr]">
                  <input className="rounded-2xl border border-slate-300 px-4 py-3" value={level.nivel} disabled />
                  <input className="rounded-2xl border border-slate-300 px-4 py-3" value={level.etiqueta} onChange={(e) => updateLevel(index, "etiqueta", e.target.value)} />
                  <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Descripcion del nivel" value={level.descripcion} onChange={(e) => updateLevel(index, "descripcion", e.target.value)} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear metrica"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-slate-300 py-3 font-semibold text-slate-700">
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Metricas cargadas</h4>
          <div className="mt-6 space-y-4">
            {metrics.length ? metrics.map((metric) => (
              <article key={metric._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <p className="text-lg font-semibold text-slate-950">{metric.nombre}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Ponderacion: {metric.ponderacion} · Cargos: {(metric.cargoAplica || []).join(", ") || "General"}
                </p>
                <div className="mt-4 grid gap-2">
                  {(metric.levels || []).map((level) => (
                    <div key={`${metric._id}-${level.nivel}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="font-semibold text-slate-900">{level.nivel} - {level.etiqueta}</span>
                      <p className="mt-1 text-slate-500">{level.descripcion || "Sin descripcion"}</p>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => handleEdit(metric)} className="mt-3 rounded-xl border border-emerald-300 px-4 py-2 text-sm text-emerald-700">
                  Editar
                </button>
              </article>
            )) : <p className="text-slate-500">Todavia no hay metricas cargadas.</p>}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
