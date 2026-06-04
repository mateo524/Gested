import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import CollapsibleList from "../components/CollapsibleList";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  nombre: "",
  descripcion: "",
  tipo: "DOCENTE",
  componente: "C",
  audienceType: "all",
  audienceDepartmentCodes: [],
  audienceEmployeeIds: [],
  metadata: {
    docenteCategory: "",
    transversalCategory: "",
    descriptores: "",
  },
};

function formatAudience(form, employees) {
  if (form.audienceType === "department") {
    return form.audienceDepartmentCodes.length ? `Área ${form.audienceDepartmentCodes.join(", ")}` : "Área / departamento";
  }
  if (form.audienceType === "employees") {
    return `${form.audienceEmployeeIds.length} ${form.audienceEmployeeIds.length === 1 ? "empleado" : "empleados"}`;
  }
  if (form.audienceType === "singleEmployee") {
    const employee = employees.find((item) => String(item._id) === String(form.audienceEmployeeIds[0] || ""));
    return employee ? `${employee.apellido}, ${employee.nombre}` : "Empleado específico";
  }
  return "Toda la organización";
}

export default function CompetenciesPage() {
  const { token } = useAuth();
  const { searchQuery, setSearchQuery } = useView();
  const [competencies, setCompetencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ q: "", tipo: "", componente: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [confirmState, setConfirmState] = useState({ open: false, competency: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const listRef = useRef(null);

  const departmentOptions = useMemo(() => {
    return [...new Set(employees.map((item) => String(item.area || "").trim()).filter(Boolean))].sort();
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      [employee.nombre, employee.apellido, employee.area, employee.cargo]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [employees, searchQuery]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      const localQuery = filters.q.trim() || String(searchQuery || "").trim();
      if (localQuery) params.set("q", localQuery);
      if (filters.tipo) params.set("tipo", filters.tipo);
      if (filters.componente) params.set("componente", filters.componente);

      const [competenciesData, employeesData] = await Promise.all([
        apiFetch(`/competencies${params.toString() ? `?${params.toString()}` : ""}`, { token }),
        apiFetch("/employees", { token }).catch(() => []),
      ]);
      setCompetencies(competenciesData);
      setEmployees(employeesData || []);
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

  function updateMetadata(field, value) {
    setForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [field]: value,
      },
    }));
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

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
      const hadSearch = Boolean(String(searchQuery || "").trim() || filters.q.trim());
      if (searchQuery) setSearchQuery("");
      if (filters.q) setFilters((current) => ({ ...current, q: "" }));
      resetForm();
      setMessageType("success");
      setMessage(
        `${isEditing ? "Competencia actualizada." : "Competencia creada."}${
          hadSearch ? " Limpiamos la búsqueda activa para mostrarla en la lista." : ""
        }`
      );
      await loadData();
      requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
      descripcion: competency.descripcion || "",
      tipo: competency.tipo || "DOCENTE",
      componente: competency.componente || "C",
      audienceType: competency.audienceType || "all",
      audienceDepartmentCodes: competency.audienceDepartmentCodes || [],
      audienceEmployeeIds: (competency.audienceEmployeeIds || []).map((item) => String(item?._id || item)),
      metadata: {
        docenteCategory: competency.metadata?.docenteCategory || "",
        transversalCategory: competency.metadata?.transversalCategory || "",
        descriptores: competency.metadata?.descriptores || "",
      },
    });
    setMessageType("info");
    setMessage("Editando competencia seleccionada.");
  }

  async function confirmDeleteCompetency() {
    const competency = confirmState.competency;
    if (!competency) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/competencies/${competency._id}`, { method: "DELETE", token });
      if (editingId === competency._id) resetForm();
      setConfirmState({ open: false, competency: null });
      setMessageType("success");
      setMessage("Competencia eliminada.");
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleEmployeeSelection(employeeId) {
    setForm((current) => {
      const nextIds = current.audienceEmployeeIds.includes(employeeId)
        ? current.audienceEmployeeIds.filter((item) => item !== employeeId)
        : [...current.audienceEmployeeIds, employeeId];
      return { ...current, audienceEmployeeIds: nextIds };
    });
  }

  return (
    <div className="space-y-5 overflow-x-hidden">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 md:p-7">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Modelo de desempeño</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Competencias</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Definí competencias transversales, docentes o personalizadas. La organización se toma automáticamente desde tu tenant activo.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar competencia" : "Nueva competencia"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            Cargá nombre, definición, descriptores y a quién aplica. Las competencias están disponibles para toda la organización activa.
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
              placeholder="Definición o descripción general"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Descriptores visibles para esta competencia"
              value={form.metadata.descriptores}
              onChange={(e) => updateMetadata("descriptores", e.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="DOCENTE">Docente</option>
                <option value="TRANSVERSAL">Transversal</option>
                <option value="PERSONALIZADA">Personalizada</option>
                <option value="LIDERAZGO">Personalizada de liderazgo</option>
              </select>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.componente}
                onChange={(e) => setForm({ ...form, componente: e.target.value })}
              >
                <option value="C">C - Conceptual</option>
                <option value="A">A - Actitudinal</option>
                <option value="H">H - Habilidad</option>
              </select>
            </div>

            {form.tipo === "DOCENTE" ? (
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                placeholder="Categoría o área docente"
                value={form.metadata.docenteCategory}
                onChange={(e) => updateMetadata("docenteCategory", e.target.value)}
              />
            ) : null}

            {form.tipo === "TRANSVERSAL" ? (
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                placeholder="Categoría transversal"
                value={form.metadata.transversalCategory}
                onChange={(e) => updateMetadata("transversalCategory", e.target.value)}
              />
            ) : null}

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <div>
                <p className="text-sm font-semibold text-white">Aplica a</p>
                <p className="mt-1 text-sm text-[#9fb6c4]">Definí el alcance de esta competencia dentro de tu organización.</p>
              </div>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white"
                value={form.audienceType}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    audienceType: e.target.value,
                    audienceDepartmentCodes: [],
                    audienceEmployeeIds: [],
                  }))
                }
              >
                <option value="all">Todos</option>
                <option value="department">Área / Departamento</option>
                <option value="employees">Grupo de empleados</option>
                <option value="singleEmployee">Empleado específico</option>
              </select>

              {form.audienceType === "department" ? (
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white"
                  value={form.audienceDepartmentCodes[0] || ""}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      audienceDepartmentCodes: e.target.value ? [e.target.value] : [],
                    }))
                  }
                >
                  <option value="">Seleccioná un área</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              ) : null}

              {form.audienceType === "employees" || form.audienceType === "singleEmployee" ? (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#122530] p-3">
                  {visibleEmployees.length ? (
                    visibleEmployees.map((employee) => {
                      const checked = form.audienceEmployeeIds.includes(String(employee._id));
                      return (
                        <label key={employee._id} className="flex items-start gap-3 rounded-2xl border border-white/5 px-3 py-3 text-sm text-[#d6e2e8]">
                          <input
                            type={form.audienceType === "singleEmployee" ? "radio" : "checkbox"}
                            name="competency-audience-employee"
                            checked={checked}
                            onChange={() =>
                              form.audienceType === "singleEmployee"
                                ? setForm((current) => ({ ...current, audienceEmployeeIds: [String(employee._id)] }))
                                : toggleEmployeeSelection(String(employee._id))
                            }
                          />
                          <span>
                            {employee.apellido}, {employee.nombre}
                            {employee.area ? ` · ${employee.area}` : ""}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[#9fb6c4]">No encontramos empleados visibles dentro de tu alcance.</p>
                  )}
                </div>
              ) : null}

              <p className="text-xs text-[#7f99a8]">Alcance actual: {formatAudience(form, employees)}.</p>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear competencia"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section ref={listRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Buscar competencia"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
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
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
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
            {searchQuery ? (
              <div className="pf-alert-info flex flex-wrap items-center justify-between gap-3">
                <span>Hay una búsqueda activa. Limpiála para ver todas las competencias.</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : null}
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
            {!isLoading && competencies.length
              ? <CollapsibleList
                  items={competencies}
                  initialCount={3}
                  className="space-y-4"
                  renderItem={(competency) => (
                  <article key={competency._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{competency.nombre}</p>
                      <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{competency.tipo}</span>
                      <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">{competency.componente}</span>
                    </div>
                    <p className="mt-3 text-sm text-[#9fb6c4]">{competency.descripcion || "Sin definición cargada."}</p>
                    <p className="mt-2 text-xs text-[#7f99a8]">
                      Aplica a: {formatAudience(
                        {
                          audienceType: competency.audienceType || "all",
                          audienceDepartmentCodes: competency.audienceDepartmentCodes || [],
                          audienceEmployeeIds: (competency.audienceEmployeeIds || []).map((item) => String(item?._id || item)),
                        },
                        employees
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => handleEdit(competency)} className="rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                        Editar
                      </button>
                      <button type="button" onClick={() => setConfirmState({ open: true, competency })} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                        Eliminar
                      </button>
                    </div>
                  </article>
                  )}
                />
              : null}
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

      <ConfirmDialog
        open={confirmState.open}
        title="¿Eliminar esta competencia?"
        message={
          confirmState.competency
            ? `Vas a eliminar "${confirmState.competency.nombre}". Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, competency: null })}
        onConfirm={confirmDeleteCompetency}
      />
    </div>
  );
}
