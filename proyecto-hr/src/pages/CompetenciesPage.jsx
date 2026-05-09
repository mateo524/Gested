import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  schoolId: "",
  nombre: "",
  descripción: "",
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
  const selectedSchool = schools.find((school) => school._id === form.schoolId) || null;

  const loadData = useCallback(async () => {
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
  }, [filters.componente, filters.q, filters.tipo, form.schoolId, token]);

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.schoolId || !form.nombre) {
      setMessage("Completa colegio y nombre de competencia para guardar.");
      return;
    }
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
      setMessage(isEditing ? "Competencia actualizada." : "Competencia creada.");
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
      descripción: competency.descripción || "",
      tipo: competency.tipo || "DOCENTE",
      componente: competency.componente || "C",
    });
    setMessage("Editando competencia seleccionada.");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
    setMessage("Edicion cancelada.");
  }

  async function handleDelete(competency) {
    const ok = window.confirm(`¿Eliminar la competencia "${competency.nombre}"?`);
    if (!ok) return;
    try {
      await apiFetch(`/competencies/${competency._id}`, { method: "DELETE", token });
      if (editingId === competency._id) {
        cancelEdit();
      }
      setMessage("Competencia eliminada.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Modelo de desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Competencias</h3>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar competencia" : "Nueva competencia"}</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Definicion</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Tipo y componente</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Institución asignada</p>
              <p className="mt-1 text-sm text-white">{selectedSchool?.nombre || "Sin colegio asignado"}</p>
            </div>
            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Descripcion de la competencia</p>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Nombre (ej: Trabajo en equipo)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <textarea className="min-h-28 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Descripcion" value={form.descripción} onChange={(e) => setForm({ ...form, descripción: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="TRANSVERSAL">Transversal</option>
                <option value="DOCENTE">Docente</option>
                <option value="LIDERAZGO">Liderazgo</option>
                <option value="PERSONALIZADA">Personalizada</option>
              </select>
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.componente} onChange={(e) => setForm({ ...form, componente: e.target.value })}>
                <option value="C">C - Conceptual</option>
                <option value="A">A - Actitudinal</option>
                <option value="H">H - Procedimental</option>
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear competencia"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Buscar" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}>
              <option value="">Todos los tipos</option>
              <option value="TRANSVERSAL">Transversal</option>
              <option value="DOCENTE">Docente</option>
              <option value="LIDERAZGO">Liderazgo</option>
              <option value="PERSONALIZADA">Personalizada</option>
            </select>
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.componente} onChange={(e) => setFilters({ ...filters, componente: e.target.value })}>
              <option value="">Todos los componentes</option>
              <option value="C">C</option>
              <option value="A">A</option>
              <option value="H">H</option>
            </select>
          </div>
          <div className="mt-6 space-y-4">
            {competencies.length ? competencies.map((competency) => (
              <article key={competency._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-white">{competency.nombre}</p>
                  <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{competency.tipo}</span>
                  <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{competency.componente}</span>
                </div>
                <p className="mt-3 text-sm text-[#9fb6c4]">{competency.descripción || "Sin descripción"}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => handleEdit(competency)} className="rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(competency)} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                    Eliminar
                  </button>
                </div>
              </article>
            )) : <p className="text-[#9fb6c4]">Todavía no hay competencias cargadas.</p>}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#c5d5de]">{message}</p> : null}
    </div>
  );
}


