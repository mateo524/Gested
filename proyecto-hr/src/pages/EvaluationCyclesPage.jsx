import { useCallback, useEffect, useState } from "react";
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
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const selectedSchool = schools.find((school) => school._id === form.schoolId) || null;
  const [fieldErrors, setFieldErrors] = useState({});

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [schoolsData, cyclesData] = await Promise.all([
        apiFetch("/schools", { token }),
        apiFetch("/evaluation-cycles", { token }),
      ]);
      setSchools(schoolsData);
      setCycles(cyclesData);
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

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.schoolId) nextErrors.schoolId = "No hay institución asignada.";
    if (!form.periodo?.trim()) nextErrors.periodo = "El período es obligatorio.";
    if (!form.fechaInicio) nextErrors.fechaInicio = "Fecha de inicio obligatoria.";
    if (!form.fechaFin) nextErrors.fechaFin = "Fecha de cierre obligatoria.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Completa institución, período y rango de fechas para guardar.");
      setMessageType("warning");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/evaluation-cycles/${editingId}` : "/evaluation-cycles", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
      setEditingId("");
      setFieldErrors({});
      setMessageType("success");
      setMessage(isEditing ? "Período actualizado." : "Período creado.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(cycle) {
    setEditingId(cycle._id);
    setForm({
      schoolId: cycle.schoolId || "",
      anio: Number(cycle.anio || new Date().getFullYear()),
      periodo: cycle.periodo || "",
      etapa: cycle.etapa || "INICIO",
      estado: cycle.estado || "BORRADOR",
      fechaInicio: cycle.fechaInicio ? new Date(cycle.fechaInicio).toISOString().slice(0, 10) : "",
      fechaFin: cycle.fechaFin ? new Date(cycle.fechaFin).toISOString().slice(0, 10) : "",
    });
    setMessageType("info");
    setMessage("Editando período seleccionado.");
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Calendario institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Períodos de evaluación</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Define períodos claros para ordenar altas, evaluaciones y reportes por etapa.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar período" : "Nuevo período"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            Carga un período por institución, define su estado y marca fechas de inicio y cierre.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Institución asignada</p>
              <p className="mt-1 text-sm text-white">{selectedSchool?.nombre || "Sin institución asignada"}</p>
            </div>
            {fieldErrors.schoolId ? <p className="text-xs text-rose-300">{fieldErrors.schoolId}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Año</label>
                <input type="number" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Período</label>
                <input className={`rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.periodo ? "border-rose-400/70" : "border-white/15"}`} placeholder="Ej: 1er trimestre" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} />
              </div>
            </div>
            {fieldErrors.periodo ? <p className="text-xs text-rose-300">{fieldErrors.periodo}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Etapa</label>
                <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                  <option value="INICIO">Inicio</option>
                  <option value="REVISION_INTERMEDIA">Revisión intermedia</option>
                  <option value="EVALUACION_FINAL">Evaluación final</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Estado</label>
                <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="BORRADOR">Borrador</option>
                  <option value="ABIERTO">Abierto</option>
                  <option value="CERRADO">Cerrado</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de inicio</label>
                <input type="date" className={`rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.fechaInicio ? "border-rose-400/70" : "border-white/15"}`} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de cierre</label>
                <input type="date" className={`rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.fechaFin ? "border-rose-400/70" : "border-white/15"}`} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
              </div>
            </div>
            {(fieldErrors.fechaInicio || fieldErrors.fechaFin) ? <p className="text-xs text-rose-300">{fieldErrors.fechaInicio || fieldErrors.fechaFin}</p> : null}

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full disabled:opacity-60">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear período"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">Períodos cargados</h4>
          <div className="mt-6 space-y-4">
            {isLoading ? <p className="pf-alert-info">Cargando períodos...</p> : null}
            {!isLoading && cycles.length ? cycles.map((cycle) => (
              <article key={cycle._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-white">{cycle.periodo} {cycle.anio}</p>
                  <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{cycle.etapa}</span>
                  <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{cycle.estado}</span>
                </div>
                <p className="mt-2 text-sm text-[#9fb6c4]">
                  {cycle.fechaInicio ? new Date(cycle.fechaInicio).toLocaleDateString("es-AR") : "-"} al{" "}
                  {cycle.fechaFin ? new Date(cycle.fechaFin).toLocaleDateString("es-AR") : "-"}
                </p>
                <button type="button" onClick={() => handleEdit(cycle)} className="mt-3 rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                  Editar
                </button>
              </article>
            )) : null}
            {!isLoading && !cycles.length ? <p className="pf-alert-warning">Todavía no hay períodos definidos.</p> : null}
          </div>
        </section>
      </div>

      {message ? <p className={messageType === "error" ? "pf-alert-error" : messageType === "success" ? "pf-alert-success" : messageType === "warning" ? "pf-alert-warning" : "pf-alert-info"}>{message}</p> : null}
    </div>
  );
}

