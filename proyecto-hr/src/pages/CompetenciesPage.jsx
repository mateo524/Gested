import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  schoolId: "",
  nombre: "",
  descripcion: "",
  tipo: "DOCENTE",
  componente: "C",
};

export default function CompetenciesPage() {
  const { token } = useAuth();
  const [schools, setSchools] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ q: "", tipo: "", componente: "" });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");

  async function loadData() {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.tipo) params.set("tipo", filters.tipo);
    if (filters.componente) params.set("componente", filters.componente);

    const [schoolsData, competenciesData] = await Promise.all([
      apiFetch("/schools", { token }),
      apiFetch(`/competencies${params.toString() ? `?${params.toString()}` : ""}`, { token }),
    ]);

    setSchools(schoolsData);
    setCompetencies(competenciesData);
    if (!form.schoolId && schoolsData[0]?._id) {
      setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
    }
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token, filters.q, filters.tipo, filters.componente]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage("");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/competencies/${editingId}` : "/competencies", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
      setEditingId("");
      setMessage(isEditing ? "Competencia actualizada" : "Competencia creada");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(competency) {
    setEditingId(competency._id);
    setForm({
      schoolId: competency.schoolId || "",
      nombre: competency.nombre || "",
      descripcion: competency.descripcion || "",
      tipo: competency.tipo || "DOCENTE",
      componente: competency.componente || "C",
    });
    setMessage("Editando competencia seleccionada");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
    setMessage("Edicion cancelada");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Modelo de desempeno</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Competencias</h3>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">{editingId ? "Editar competencia" : "Nueva competencia"}</h4>
          <p className="mt-2 text-sm text-slate-500">
            Define la capacidad que vas a evaluar (ej: Trabajo en equipo, Comunicacion).
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select className="w-full rounded-2xl border border-slate-300 px-4 py-3" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>{school.nombre}</option>
              ))}
            </select>
            <input className="w-full rounded-2xl border border-slate-300 px-4 py-3" placeholder="Nombre de la competencia" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <textarea className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3" placeholder="Descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-slate-300 px-4 py-3" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="TRANSVERSAL">Transversal</option>
                <option value="DOCENTE">Docente</option>
                <option value="LIDERAZGO">Liderazgo</option>
                <option value="PERSONALIZADA">Personalizada</option>
              </select>
              <select className="rounded-2xl border border-slate-300 px-4 py-3" value={form.componente} onChange={(e) => setForm({ ...form, componente: e.target.value })}>
                <option value="C">C - Conceptual</option>
                <option value="A">A - Actitudinal</option>
                <option value="H">H - Procedimental</option>
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear competencia"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-slate-300 py-3 font-semibold text-slate-700">
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Buscar" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <select className="rounded-2xl border border-slate-300 px-4 py-3" value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}>
              <option value="">Todos los tipos</option>
              <option value="TRANSVERSAL">Transversal</option>
              <option value="DOCENTE">Docente</option>
              <option value="LIDERAZGO">Liderazgo</option>
              <option value="PERSONALIZADA">Personalizada</option>
            </select>
            <select className="rounded-2xl border border-slate-300 px-4 py-3" value={filters.componente} onChange={(e) => setFilters({ ...filters, componente: e.target.value })}>
              <option value="">Todos los componentes</option>
              <option value="C">C</option>
              <option value="A">A</option>
              <option value="H">H</option>
            </select>
          </div>
          <div className="mt-6 space-y-4">
            {competencies.length ? competencies.map((competency) => (
              <article key={competency._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-slate-950">{competency.nombre}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{competency.tipo}</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{competency.componente}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{competency.descripcion || "Sin descripcion"}</p>
                <button type="button" onClick={() => handleEdit(competency)} className="mt-3 rounded-xl border border-emerald-300 px-4 py-2 text-sm text-emerald-700">
                  Editar
                </button>
              </article>
            )) : <p className="text-slate-500">Todavia no hay competencias cargadas.</p>}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
