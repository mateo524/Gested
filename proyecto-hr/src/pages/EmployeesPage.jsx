import { useEffect, useMemo, useState } from "react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [wizardStep, setWizardStep] = useState(1);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee._id, employee])),
    [employees]
  );

  function buildEmployeeQuery(nextFilters) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function loadBase() {
    const [schoolsData, employeesData] = await Promise.all([
      apiFetch("/schools", { token }),
      apiFetch(`/employees${buildEmployeeQuery(filters)}`, { token }),
    ]);
    setSchools(schoolsData);
    setEmployees(employeesData);
    if (!form.schoolId && schoolsData[0]?._id) {
      setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
    }
  }

  useEffect(() => {
    loadBase().catch((error) => setMessage(error.message));
  }, [token, filters.q, filters.schoolId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.schoolId || !form.nombre || !form.apellido || !form.cargo) {
      setMessage("Completa colegio, nombre, apellido y cargo para guardar.");
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
      setMessage(isEditing ? "Empleado actualizado correctamente." : "Empleado creado correctamente.");
      await loadBase();
    } catch (error) {
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
    setMessage("Editando empleado seleccionado.");
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
    setMessage("Edicion cancelada.");
  }

  function stepReady(step) {
    if (step === 1) return Boolean(form.schoolId);
    if (step === 2) return Boolean(form.nombre && form.apellido && form.email);
    if (step === 3) return Boolean(form.cargo && form.area);
    return true;
  }

  function goNextStep() {
    if (!stepReady(wizardStep)) {
      setMessage("Completa los campos requeridos del paso actual para continuar.");
      return;
    }
    setMessage("");
    setWizardStep((s) => Math.min(4, s + 1));
  }

  function goPrevStep() {
    setWizardStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Talento institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Empleados y docentes</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Carga y actualiza personas de tu organizacion. Esto impacta evaluaciones, reportes y decisiones.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar empleado" : "Nuevo empleado"}</h4>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#0f1f28] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Asistente de alta inicial</p>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              {[
                { id: 1, label: "Colegio" },
                { id: 2, label: "Persona" },
                { id: 3, label: "Rol interno" },
                { id: 4, label: "Confirmar" },
              ].map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setWizardStep(step.id)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    wizardStep === step.id
                      ? "bg-[#1e3a8a] text-white"
                      : stepReady(step.id)
                        ? "border border-emerald-300/40 bg-emerald-900/20 text-emerald-300"
                        : "border border-white/15 bg-[#122530] text-[#9fb6c4]"
                  }`}
                >
                  {step.id}. {step.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Colegio</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Datos personales</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Rol y responsable</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 4: Guardar</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Seleccion institucional</p>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.schoolId} onChange={(event) => setForm({ ...form, schoolId: event.target.value })}>
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">2. Identidad del empleado</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Nombre" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Apellido" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: event.target.value })} />
            </div>

            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Email institucional" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">3. Contexto laboral</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Cargo (ej: Docente de Matematica)" value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} />
              <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Area / Departamento" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.tipoEmpleado} onChange={(event) => setForm({ ...form, tipoEmpleado: event.target.value })}>
                <option value="DOCENTE">Docente</option>
                <option value="NO_DOCENTE">No docente</option>
                <option value="DIRECTIVO">Directivo</option>
                <option value="RRHH">RRHH</option>
                <option value="OTRO">Otro</option>
              </select>
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaIngreso} onChange={(event) => setForm({ ...form, fechaIngreso: event.target.value })} />
            </div>

            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
              <option value="">Sin jefe asignado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>

            <div className="grid gap-2 md:grid-cols-2">
              <button type="button" onClick={goPrevStep} className="rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Paso anterior
              </button>
              <button type="button" onClick={goNextStep} className="rounded-2xl border border-emerald-300/40 bg-emerald-900/20 py-3 font-semibold text-emerald-300">
                Siguiente paso
              </button>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white hover:bg-[#1a3278]">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empleado"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]">
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="mb-4 rounded-xl border border-white/10 bg-[#0f1f28] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Siguiente bloque recomendado</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView("competencias")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Ir a Competencias</button>
              <button type="button" onClick={() => setView("metricas")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Ir a Indicadores</button>
              <button type="button" onClick={() => setView("ciclos")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Ir a Períodos</button>
              <button type="button" onClick={() => setView("evaluaciones")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Ir a Evaluación</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <input className="min-w-56 flex-1 rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Buscar por nombre, cargo o mail" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            <select className="min-w-56 rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.schoolId} onChange={(event) => setFilters({ ...filters, schoolId: event.target.value })}>
              <option value="">Todos los colegios</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 space-y-3">
            {employees.length ? (
              employees.map((employee) => {
                const manager = employeesById.get(employee.managerId);
                return (
                  <article key={employee._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                    <p className="text-base font-semibold text-white">
                      {employee.apellido}, {employee.nombre}
                    </p>
                    <p className="mt-1 text-sm text-[#9fb6c4]">
                      {employee.cargo || "-"} - {employee.area || "Sin area"} - {employee.tipoEmpleado || "-"}
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
            ) : (
              <p className="text-[#9fb6c4]">Todavia no hay empleados cargados.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#c5d5de]">{message}</p> : null}
    </div>
  );
}
