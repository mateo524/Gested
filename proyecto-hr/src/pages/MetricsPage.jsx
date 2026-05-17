import { useCallback, useEffect, useMemo, useState } from "react";
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

const insightsTabs = [
  { key: "metricas", label: "Indicadores base" },
  { key: "kpis", label: "KPIs cargados" },
  { key: "okrs", label: "OKRs cargados" },
];

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
  const [activeTab, setActiveTab] = useState("metricas");
  const [kpiRecords, setKpiRecords] = useState([]);
  const [okrRecords, setOkrRecords] = useState([]);
  const selectedSchool = schools.find((school) => school._id === form.schoolId) || null;

  const visibleCompetencies = useMemo(
    () => competencies.filter((item) => !form.schoolId || item.schoolId === form.schoolId || item.schoolId === null),
    [competencies, form.schoolId]
  );
  const filteredMetrics = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return metrics;
    return metrics.filter((metric) =>
      [metric.nombre, metric.descripcion, ...(metric.cargoAplica || [])]
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
      const [kpiData, okrData] = await Promise.all([
        apiFetch("/metrics/kpi-records", { token }),
        apiFetch("/metrics/okr-records", { token }),
      ]);
      setSchools(schoolsData);
      setCompetencies(competenciesData);
      setMetrics(metricsData);
      setKpiRecords(kpiData);
      setOkrRecords(okrData);
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
    if (!form.schoolId) nextErrors.schoolId = "No hay institución asignada.";
    if (!form.competencyId) nextErrors.competencyId = "Selecciona una competencia.";
    if (!form.nombre?.trim()) nextErrors.nombre = "El nombre del indicador es obligatorio.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Completa institución, competencia y nombre de indicador para guardar.");
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
      descripcion: metric.descripcion || "",
      cargoAplica: (metric.cargoAplica || []).join(", "),
      ponderacion: Number(metric.ponderacion || 1),
      levels: (metric.levels?.length ? metric.levels : buildDefaultLevels()).map((level) => ({
        nivel: Number(level.nivel),
        etiqueta: level.etiqueta || "",
        descripcion: level.descripcion || "",
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

  function formatRecordDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
  }

  async function handleDelete(metric) {
    const ok = window.confirm(`¿Eliminar el indicador "${metric.nombre}"?`);
    if (!ok) return;
    try {
      await apiFetch(`/metrics/${metric._id}`, { method: "DELETE", token });
      if (editingId === metric._id) {
        cancelEdit();
      }
      setMessageType("success");
      setMessage("Indicador eliminado.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
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
          <p className="mt-2 text-sm text-[#9fb6c4]">
            Carga el indicador con una descripción observable y niveles 1 a 5 claros.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Institución asignada</p>
              <p className="mt-1 text-sm text-white">{selectedSchool?.nombre || "Sin institución asignada"}</p>
            </div>
            {fieldErrors.schoolId ? <p className="text-xs text-rose-300">{fieldErrors.schoolId}</p> : null}

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Competencia</label>
              <select className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.competencyId ? "border-rose-400/70" : "border-white/15"}`} value={form.competencyId} onChange={(e) => setForm({ ...form, competencyId: e.target.value })}>
                <option value="">Selecciona competencia</option>
                {visibleCompetencies.map((competency) => (
                  <option key={competency._id} value={competency._id}>{competency.nombre}</option>
                ))}
              </select>
            </div>
            {fieldErrors.competencyId ? <p className="text-xs text-rose-300">{fieldErrors.competencyId}</p> : null}

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Nombre del indicador</label>
              <input className={`pf-input ${fieldErrors.nombre ? "border-rose-400/70" : ""}`} placeholder="Ej: Cumple objetivos trimestrales" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            {fieldErrors.nombre ? <p className="text-xs text-rose-300">{fieldErrors.nombre}</p> : null}

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Descripción observable</label>
              <textarea className="pf-textarea" placeholder="Describe cómo se mide este indicador en la práctica." value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Cargos (separados por coma)</label>
                <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Docente, Jefe de área" value={form.cargoAplica} onChange={(e) => setForm({ ...form, cargoAplica: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Ponderación</label>
                <input type="number" min="1" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Ej: 2" value={form.ponderacion} onChange={(e) => setForm({ ...form, ponderacion: Number(e.target.value) })} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-[#c5d5de]">Escala de evaluación (1 a 5)</p>
              {form.levels.map((level, index) => (
                <div key={level.nivel} className="grid gap-3 md:grid-cols-[0.18fr_0.4fr_1fr]">
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={level.nivel} disabled />
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" value={level.etiqueta} onChange={(e) => updateLevel(index, "etiqueta", e.target.value)} />
                  <input className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white" placeholder="Descripción del nivel" value={level.descripcion} onChange={(e) => updateLevel(index, "descripcion", e.target.value)} />
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
          <div className="mt-4 flex flex-wrap gap-2">
            {insightsTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? "bg-[#1e3a8a] text-white"
                    : "border border-white/10 bg-[#0f1f28] text-[#AFC3CE]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {isLoading ? <p className="pf-alert-info">Cargando indicadores...</p> : null}
            {!isLoading && activeTab === "metricas" && filteredMetrics.length ? filteredMetrics.map((metric) => (
              <article key={metric._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <p className="text-lg font-semibold text-white">{metric.nombre}</p>
                <p className="mt-1 text-sm text-[#9fb6c4]">
                  Ponderación: {metric.ponderacion} - Cargos: {(metric.cargoAplica || []).join(", ") || "General"}
                </p>
                <div className="mt-4 grid gap-2">
                  {(metric.levels || []).map((level) => (
                    <div key={`${metric._id}-${level.nivel}`} className="rounded-2xl bg-[#122530] px-4 py-3 text-sm">
                      <span className="font-semibold text-white">{level.nivel} - {level.etiqueta}</span>
                      <p className="mt-1 text-[#9fb6c4]">{level.descripcion || "Sin descripción"}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => handleEdit(metric)} className="rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(metric)} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                    Eliminar
                  </button>
                </div>
              </article>
            )) : null}
            {!isLoading && activeTab === "metricas" && !filteredMetrics.length ? <p className="pf-alert-warning">No hay indicadores para los filtros actuales.</p> : null}

            {!isLoading && activeTab === "kpis" && kpiRecords.length ? kpiRecords.map((item) => (
              <article key={item._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-sm text-[#9fb6c4]">
                      {item.employee?.fullName || "Sin empleado"} {item.employee?.area ? `· ${item.employee.area}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.status ? <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">{item.status}</span> : null}
                    <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                      Actualizado {formatRecordDate(item.updatedAt)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#c8d8df]">
                  Meta {item.targetValue ?? "-"} {item.unit || ""} {item.frequency ? `· ${item.frequency}` : ""}
                </p>
                <p className="mt-2 text-xs text-[#8FA9B7]">
                  {item.kpiCode || "Sin codigo"} {item.departmentCode ? `· ${item.departmentCode}` : ""}
                </p>
              </article>
            )) : null}
            {!isLoading && activeTab === "kpis" && !kpiRecords.length ? <p className="pf-alert-warning">Todavia no hay KPIs operativos cargados para este alcance.</p> : null}

            {!isLoading && activeTab === "okrs" && okrRecords.length ? okrRecords.map((item) => (
              <article key={item._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{item.objectiveTitle}</p>
                    <p className="mt-1 text-sm text-[#9fb6c4]">
                      {item.keyResultTitle}
                    </p>
                    <p className="mt-1 text-sm text-[#9fb6c4]">
                      {item.employee?.fullName || "Sin empleado"} {item.employee?.area ? `· ${item.employee.area}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.status ? <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">{item.status}</span> : null}
                    <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                      Actualizado {formatRecordDate(item.updatedAt)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#c8d8df]">
                  Meta {item.targetValue ?? "-"} {item.quarter ? `· ${item.quarter}` : ""}
                </p>
                <p className="mt-2 text-xs text-[#8FA9B7]">
                  {item.okrCode || "Sin codigo"} {item.departmentCode ? `· ${item.departmentCode}` : ""}
                </p>
              </article>
            )) : null}
            {!isLoading && activeTab === "okrs" && !okrRecords.length ? <p className="pf-alert-warning">Todavia no hay OKRs operativos cargados para este alcance.</p> : null}
          </div>
        </section>
      </div>

      {message ? (
        <p className={messageType === "error" ? "pf-alert-error" : messageType === "success" ? "pf-alert-success" : messageType === "warning" ? "pf-alert-warning" : "pf-alert-info"}>
          {messageType === "error" ? "No se pudo guardar. " : ""}
          {message}
        </p>
      ) : null}
    </div>
  );
}
