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
  const [editingId, setEditingId] = useState("");

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
    if (!form.schoolId || !form.periodo || !form.fechaInicio || !form.fechaFin) {
      setMessage("Completa colegio, periodo y rango de fechas para guardar.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/evaluation-cycles/${editingId}` : "/evaluation-cycles", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
      setEditingId("");
      setMessage(isEditing ? "Periodo actualizado." : "Periodo creado.");
      await loadData();
    } catch (error) {
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
    setMessage("Editando periodo seleccionado.");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
    setMessage("Edicion cancelada.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Calendario institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Periodos de evaluacion</h3>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar periodo" : "Nuevo periodo"}</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Colegio y anio</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Etapa y estado</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Fechas</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Identificacion del periodo</p>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>{school.nombre}</option>
              ))}
            </select>
            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">2. Configuracion operativa</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="number" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} />
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Periodo (ej: 1er trimestre)" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                <option value="INICIO">Inicio</option>
                <option value="REVISION_INTERMEDIA">Revision intermedia</option>
                <option value="EVALUACION_FINAL">Evaluacion final</option>
              </select>
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="BORRADOR">Borrador</option>
                <option value="ABIERTO">Abierto</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear periodo"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">Periodos cargados</h4>
          <div className="mt-6 space-y-4">
            {cycles.length ? cycles.map((cycle) => (
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
            )) : <p className="text-[#9fb6c4]">Todavia no hay periodos definidos.</p>}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#c5d5de]">{message}</p> : null}
    </div>
  );
}
