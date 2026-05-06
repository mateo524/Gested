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
      setMessage(isEditing ? "Ciclo actualizado" : "Ciclo creado");
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
    setMessage("Editando ciclo seleccionado");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId, anio: new Date().getFullYear() }));
    setMessage("Edicion cancelada");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Calendario institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Ciclos de evaluacion</h3>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">{editingId ? "Editar ciclo" : "Nuevo ciclo"}</h4>
          <p className="mt-2 text-sm text-slate-500">
            Define periodo, etapa y fechas para ordenar las evaluaciones del colegio.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select className="w-full rounded-2xl border border-slate-300 px-4 py-3" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>{school.nombre}</option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="number" className="rounded-2xl border border-slate-300 px-4 py-3" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} />
              <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Periodo" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-slate-300 px-4 py-3" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                <option value="INICIO">Inicio</option>
                <option value="REVISION_INTERMEDIA">Revision intermedia</option>
                <option value="EVALUACION_FINAL">Evaluacion final</option>
              </select>
              <select className="rounded-2xl border border-slate-300 px-4 py-3" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="BORRADOR">Borrador</option>
                <option value="ABIERTO">Abierto</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="rounded-2xl border border-slate-300 px-4 py-3" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
              <input type="date" className="rounded-2xl border border-slate-300 px-4 py-3" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear ciclo"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-slate-300 py-3 font-semibold text-slate-700">
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Ciclos cargados</h4>
          <div className="mt-6 space-y-4">
            {cycles.length ? cycles.map((cycle) => (
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
                <button type="button" onClick={() => handleEdit(cycle)} className="mt-3 rounded-xl border border-emerald-300 px-4 py-2 text-sm text-emerald-700">
                  Editar
                </button>
              </article>
            )) : <p className="text-slate-500">Todavia no hay ciclos definidos.</p>}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
