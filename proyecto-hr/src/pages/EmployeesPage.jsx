import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { useView } from "../context/ViewContext";

const emptyForm = {
  schoolId: "",
  nombre: "",
  apellido: "",
  email: "",
  cargo: "",
  area: "",
  tipoEmpleado: "DOCENTE",
  managerId: "",
  fechaIngreso: "",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

export default function EmployeesPage() {
  const { token } = useAuth();
  const { setView } = useView();
  const [employees, setEmployees] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filters, setFilters] = useState({ q: "", schoolId: "" });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee._id, employee])),
    [employees]
  );
  const selectedSchool = useMemo(
    () => schools.find((school) => school._id === form.schoolId) || null,
    [schools, form.schoolId]
  );

  function buildEmployeeQuery(nextFilters) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  const loadBase = useCallback(async () => {
    try {
      setIsLoading(true);
      const [schoolsData, employeesData] = await Promise.all([
        apiFetch("/schools", { token }),
        apiFetch(`/employees${buildEmployeeQuery(filters)}`, { token }),
      ]);
      setSchools(schoolsData);
      setEmployees(employeesData);
      if (!form.schoolId && schoolsData[0]?._id) {
        setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, form.schoolId, token]);

  useEffect(() => {
    loadBase().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadBase]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.schoolId) nextErrors.schoolId = "No hay institución asignada.";
    if (!form.nombre?.trim()) nextErrors.nombre = "Nombre obligatorio.";
    if (!form.apellido?.trim()) nextErrors.apellido = "Apellido obligatorio.";
    if (!form.cargo?.trim()) nextErrors.cargo = "Cargo obligatorio.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessageType("warning");
      setMessage("Completa institución, nombre, apellido y cargo para guardar.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/employees/${editingId}` : "/employees", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
      setEditingId("");
      setFieldErrors({});
      setMessageType("success");
      setMessage(isEditing ? "Empleado actualizado correctamente." : "Empleado creado correctamente.");
      await loadBase();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(employee) {
    setEditingId(employee._id);
    setForm({
      schoolId: employee.schoolId || "",
      nombre: employee.nombre || "",
      apellido: employee.apellido || "",
      email: employee.email || "",
      cargo: employee.cargo || "",
      area: employee.area || "",
      tipoEmpleado: employee.tipoEmpleado || "DOCENTE",
      managerId: employee.managerId || "",
      fechaIngreso: employee.fechaIngreso ? new Date(employee.fechaIngreso).toISOString().slice(0, 10) : "",
    });
    setMessageType("info");
    setMessage("Editando empleado seleccionado.");
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
  }

  return (
    <div className="space-y-6">
      <section className="pf-card p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Talento institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Empleados y docentes</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Carga y actualiza personas de tu organización. Esto impacta evaluaciones, reportes y decisiones.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="pf-card p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar empleado" : "Nuevo empleado"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">Completa los datos mínimos y guarda. Luego puedes editar cuando quieras.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Institución asignada</p>
              <p className="mt-1 text-sm text-white">{selectedSchool?.nombre || "Sin institución asignada"}</p>
            </div>
            {fieldErrors.schoolId ? <p className="text-xs text-rose-300">{fieldErrors.schoolId}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Nombre</label>
                <input className={`pf-input ${fieldErrors.nombre ? "border-rose-400/70" : ""}`} placeholder="Ej: Mateo" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Apellido</label>
                <input className={`pf-input ${fieldErrors.apellido ? "border-rose-400/70" : ""}`} placeholder="Ej: Sánchez" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: event.target.value })} />
              </div>
            </div>
            {(fieldErrors.nombre || fieldErrors.apellido) ? <p className="text-xs text-rose-300">{fieldErrors.nombre || fieldErrors.apellido}</p> : null}

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Correo institucional (opcional)</label>
              <input className="pf-input" placeholder="Ej: nombre@colegio.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Cargo</label>
                <input className={`pf-input ${fieldErrors.cargo ? "border-rose-400/70" : ""}`} placeholder="Ej: Docente de Matemática" value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Área / Departamento</label>
                <input className="pf-input" placeholder="Ej: Ciencias Exactas" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
              </div>
            </div>
            {fieldErrors.cargo ? <p className="text-xs text-rose-300">{fieldErrors.cargo}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Tipo de perfil</label>
                <select className="pf-select" value={form.tipoEmpleado} onChange={(event) => setForm({ ...form, tipoEmpleado: event.target.value })}>
                  <option value="DOCENTE">Docente</option>
                  <option value="NO_DOCENTE">No docente</option>
                  <option value="DIRECTIVO">Directivo</option>
                  <option value="RRHH">RRHH</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de ingreso</label>
                <input type="date" className="pf-input" value={form.fechaIngreso} onChange={(event) => setForm({ ...form, fechaIngreso: event.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Responsable directo</label>
              <select className="pf-select" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
                <option value="">Sin jefe asignado</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.apellido}, {employee.nombre}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empleado"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="pf-button-secondary w-full">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section className="pf-card p-6">
          <div className="mb-4 rounded-xl border border-white/10 bg-[#0f1f28] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Atajos útiles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView("competencias")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Competencias</button>
              <button type="button" onClick={() => setView("metricas")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Indicadores</button>
              <button type="button" onClick={() => setView("ciclos")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Períodos</button>
              <button type="button" onClick={() => setView("evaluaciones")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Evaluación</button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <input className="pf-input min-w-56 flex-1" placeholder="Buscar por nombre, cargo o mail" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            <select className="pf-select min-w-56" value={filters.schoolId} onChange={(event) => setFilters({ ...filters, schoolId: event.target.value })}>
              <option value="">Todos los colegios</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? <p className="pf-alert-info">Cargando empleados...</p> : null}
            {!isLoading && employees.length ? (
              employees.map((employee) => {
                const manager = employeesById.get(employee.managerId);
                return (
                  <article key={employee._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                    <p className="text-base font-semibold text-white">
                      {employee.apellido}, {employee.nombre}
                    </p>
                    <p className="mt-1 text-sm text-[#9fb6c4]">
                      {employee.cargo || "-"} - {employee.area || "Sin área"} - {employee.tipoEmpleado || "-"}
                    </p>
                    <p className="mt-1 text-xs text-[#7f99a8]">
                      Ingreso: {formatDate(employee.fechaIngreso)} - Jefe: {manager ? `${manager.apellido}, ${manager.nombre}` : "Sin jefe"}
                    </p>
                    <button type="button" onClick={() => handleEdit(employee)} className="mt-3 rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                      Editar
                    </button>
                  </article>
                );
              })
            ) : null}
            {!isLoading && !employees.length ? <p className="pf-alert-warning">No hay empleados cargados para los filtros actuales.</p> : null}
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

