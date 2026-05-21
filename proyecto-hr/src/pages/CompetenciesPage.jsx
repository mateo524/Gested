import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";

const emptyForm = {
  nombre: "",
  descripcion: "",
  tipo: "DOCENTE",
  componente: "C",
};

export default function CompetenciesPage() {
  const { token } = useAuth();
  const { searchQuery } = useView();
  const [competencies, setCompetencies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ q: "", tipo: "", componente: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      const localQuery = filters.q.trim() || String(searchQuery || "").trim();
      if (localQuery) params.set("q", localQuery);
      if (filters.tipo) params.set("tipo", filters.tipo);
      if (filters.componente) params.set("componente", filters.componente);

      const competenciesData = await apiFetch(`/competencies${params.toString() ? `?${params.toString()}` : ""}`, { token });
      setCompetencies(competenciesData);
      setMessage("");
      setMessageType("info");
    } finally {
      setIsLoading(false);
    }
  }, [filters.componente, filters.q, filters.tipo, searchQuery, token]);

  useEffect(() => {
    loadData().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setMessageType("warning");
      setMessage("Completá el nombre de la competencia para guardarla.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/competencies/${editingId}` : "/competencies", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setEditingId("");
      setMessageType("success");
      setMessage(isEditing ? "Competencia actualizada." : "Competencia creada.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(competency) {
    setEditingId(competency._id);
    setForm({
      nombre: competency.nombre || "",
      descripcion: competency.descripcion || competency.descripción || "",
      tipo: competency.tipo || "DOCENTE",
      componente: competency.componente || "C",
    });
    setMessageType("info");
    setMessage("Editando competencia seleccionada.");
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setMessageType("info");
    setMessage("Edición cancelada.");
  }

  async function handleDelete(competency) {
    const ok = window.confirm(`¿Eliminar la competencia "${competency.nombre}"?`);
    if (!ok) return;
    try {
      await apiFetch(`/competencies/${competency._id}`, { method: "DELETE", token });
      if (editingId === competency._id) {
        cancelEdit();
      }
      setMessageType("success");
      setMessage("Competencia eliminada.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 md:p-7">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Modelo de desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Competencias</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Definí competencias transversales, docentes o personalizadas. La organización se toma automáticamente desde tu tenant activo.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar competencia" : "Nueva competencia"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            Cargá nombre, definición y clasificación. No hace falta elegir institución.
          </p>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Nombre (ej: Trabajo en equipo)"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <textarea
              className="min-h-28 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Definición, descriptores o criterios visibles para esta competencia"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="TRANSVERSAL">Transversal</option>
                <option value="DOCENTE">Docente / específica</option>
                <option value="LIDERAZGO">Liderazgo</option>
                <option value="PERSONALIZADA">Personalizada</option>
              </select>
              <select
                className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.componente}
                onChange={(e) => setForm({ ...form, componente: e.target.value })}
              >
                <option value="C">C - Conceptual</option>
                <option value="A">A - Actitudinal</option>
                <option value="H">H - Habilidad</option>
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

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Buscar competencia"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={filters.tipo}
              onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
            >
              <option value="">Todos los tipos</option>
              <option value="TRANSVERSAL">Transversal</option>
              <option value="DOCENTE">Docente</option>
              <option value="LIDERAZGO">Liderazgo</option>
              <option value="PERSONALIZADA">Personalizada</option>
            </select>
            <select
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={filters.componente}
              onChange={(e) => setFilters({ ...filters, componente: e.target.value })}
            >
              <option value="">Todos los componentes</option>
              <option value="C">C</option>
              <option value="A">A</option>
              <option value="H">H</option>
            </select>
          </div>
          <div className="mt-5 space-y-4">
            {isLoading ? (
              <LoadingState compact title="Cargando competencias" description="Estamos actualizando el modelo de desempeño." />
            ) : null}
            {!isLoading && messageType === "error" && !competencies.length ? (
              <ErrorState
                compact
                title="No pudimos cargar las competencias"
                description="Reintentá para recuperar el modelo institucional."
                actionLabel="Reintentar"
                onAction={() =>
                  loadData().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
              />
            ) : null}
            {!isLoading && competencies.length ? competencies.map((competency) => (
              <article key={competency._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-white">{competency.nombre}</p>
                  <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{competency.tipo}</span>
                  <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{competency.componente}</span>
                </div>
                <p className="mt-3 text-sm text-[#9fb6c4]">{competency.descripcion || competency.descripción || "Sin definición cargada."}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => handleEdit(competency)} className="rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(competency)} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                    Eliminar
                  </button>
                </div>
              </article>
            )) : null}
            {!isLoading && messageType !== "error" && !competencies.length ? (
              <EmptyState compact title="Todavía no hay competencias cargadas" description="Creá la primera competencia para ordenar evaluaciones, mediciones y desarrollo." />
            ) : null}
          </div>
        </section>
      </div>

      {message ? (
        <p
          className={
            messageType === "error"
              ? "pf-alert-error"
              : messageType === "success"
                ? "pf-alert-success"
                : messageType === "warning"
                  ? "pf-alert-warning"
                  : "pf-alert-info"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
