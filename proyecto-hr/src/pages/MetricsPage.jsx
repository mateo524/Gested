import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const baseLevels = [
  { nivel: 1, etiqueta: "Insatisfactorio", descripción: "" },
  { nivel: 2, etiqueta: "Mínimo", descripción: "" },
  { nivel: 3, etiqueta: "En desarrollo", descripción: "" },
  { nivel: 4, etiqueta: "Competente", descripción: "" },
  { nivel: 5, etiqueta: "Excepcional", descripción: "" },
];

const buildDefaultLevels = () => baseLevels.map((level) => ({ ...level }));

const emptyForm = {
  schoolId: "",
  competencyId: "",
  nombre: "",
  descripción: "",
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
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const selectedSchool = schools.find((school) => school._id === form.schoolId) || null;

  const visibleCompetencies = useMemo(
    () => competencies.filter((item) => !form.schoolId || item.schoolId === form.schoolId || item.schoolId === null),
    [competencies, form.schoolId]
  );
  const filteredMetrics = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return metrics;
    return metrics.filter((metric) =>
      [metric.nombre, metric.descripción, ...(metric.cargoAplica || [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [metrics, query]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, [form.schoolId, token]);

  useEffect(() => {
    loadData().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadData]);

  function updateLevel(index, field, value) {
    const nextLevels = [...form.levels];
    nextLevels[index] = { ...nextLevels[index], [field]: value };
    setForm({ ...form, levels: nextLevels });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.schoolId) nextErrors.schoolId = "No hay institucion asignada.";
    if (!form.competencyId) nextErrors.competencyId = "Selecciona una competencia.";
    if (!form.nombre?.trim()) nextErrors.nombre = "El nombre del indicador es obligatorio.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Completa colegio, competencia y nombre de indicador para guardar.");
      setMessageType("warning");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessageType("info");
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
      setFieldErrors({});
      setMessageType("success");
      setMessage(isEditing ? "Indicador actualizado." : "Indicador creado.");
      await loadData();
    } catch (error) {
      setMessageType("error");
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
      descripción: metric.descripción || "",
      cargoAplica: (metric.cargoAplica || []).join(", "),
      ponderacion: Number(metric.ponderacion || 1),
      levels: (metric.levels?.length ? metric.levels : buildDefaultLevels()).map((level) => ({
        nivel: Number(level.nivel),
        etiqueta: level.etiqueta || "",
        descripción: level.descripción || "",
      })),
    });
    setMessageType("info");
    setMessage("Editando indicador seleccionado.");
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, levels: buildDefaultLevels() }));
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Motor de evaluación</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Indicadores y niveles</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Define indicadores claros por competencia y usa la misma escala para comparar resultados.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar indicador" : "Nuevo indicador"}</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Definir indicador</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Escala 1-5</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Institución asignada</p>
              <p className="mt-1 text-sm text-white">{selectedSchool?.nombre || "Sin colegio asignado"}</p>
            </div>
            {fieldErrors.schoolId ? <p className="text-xs text-rose-300">{fieldErrors.schoolId}</p> : null}
            <select className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.competencyId ? "border-rose-400/70" : "border-white/15"}`} value={form.competencyId} onChange={(e) => setForm({ ...form, competencyId: e.target.value })}>
              <option value="">Selecciona competencia</option>
              {visibleCompetencies.map((competency) => (
                <option key={competency._id} value={competency._id}>{competency.nombre}</option>
              ))}
            </select>
            {fieldErrors.competencyId ? <p className="text-xs text-rose-300">{fieldErrors.competencyId}</p> : null}
            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Definicion del indicador</p>
            <input className={`pf-input ${fieldErrors.nombre ? "border-rose-400/70" : ""}`} placeholder="Nombre del indicador" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            {fieldErrors.nombre ? <p className="text-xs text-rose-300">{fieldErrors.nombre}</p> : null}
            <textarea className="pf-textarea" placeholder="Descripción breve y observable" value={form.descripción} onChange={(e) => setForm({ ...form, descripción: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Cargos (separados por coma)" value={form.cargoAplica} onChange={(e) => setForm({ ...form, cargoAplica: e.target.value })} />
              <input type="number" min="1" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Ponderación" value={form.ponderacion} onChange={(e) => setForm({ ...form, ponderacion: Number(e.target.value) })} />
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-[#c5d5de]">Niveles 1 a 5</p>
              {form.levels.map((level, index) => (
                <div key={level.nivel} className="grid gap-3 md:grid-cols-[0.18fr_0.4fr_1fr]">
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={level.nivel} disabled />
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={level.etiqueta} onChange={(e) => updateLevel(index, "etiqueta", e.target.value)} />
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" placeholder="Descripcion del nivel" value={level.descripción} onChange={(e) => updateLevel(index, "descripción", e.target.value)} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full disabled:opacity-60">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear indicador"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h4 className="text-xl font-semibold text-white">Indicadores cargados</h4>
            <input
              className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Buscar indicador o cargo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mt-6 space-y-4">
            {isLoading ? <p className="pf-alert-info">Cargando indicadores...</p> : null}
            {!isLoading && filteredMetrics.length ? filteredMetrics.map((metric) => (
              <article key={metric._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <p className="text-lg font-semibold text-white">{metric.nombre}</p>
                <p className="mt-1 text-sm text-[#9fb6c4]">
                  Ponderación: {metric.ponderacion} - Cargos: {(metric.cargoAplica || []).join(", ") || "General"}
                </p>
                <div className="mt-4 grid gap-2">
                  {(metric.levels || []).map((level) => (
                    <div key={`${metric._id}-${level.nivel}`} className="rounded-2xl bg-[#122530] px-4 py-3 text-sm">
                      <span className="font-semibold text-white">{level.nivel} - {level.etiqueta}</span>
                      <p className="mt-1 text-[#9fb6c4]">{level.descripción || "Sin descripción"}</p>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => handleEdit(metric)} className="mt-3 rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                  Editar
                </button>
              </article>
            )) : null}
            {!isLoading && !filteredMetrics.length ? <p className="pf-alert-warning">No hay indicadores para los filtros actuales.</p> : null}
          </div>
        </section>
      </div>

      {message ? <p className={messageType === "error" ? "pf-alert-error" : messageType === "success" ? "pf-alert-success" : messageType === "warning" ? "pf-alert-warning" : "pf-alert-info"}>{message}</p> : null}
    </div>
  );
}


