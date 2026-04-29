import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  schoolId: "",
  nombre: "",
  apellido: "",
  email: "",
  cargo: "",
  area: "",
  tipoEmpleado: "DOCENTE",
  managerId: "",
};

export default function EmployeesPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filters, setFilters] = useState({ q: "", schoolId: "" });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadBase() {
    const schoolParams = user?.isSuperAdmin && filters.schoolId ? `?schoolId=${filters.schoolId}` : "";
    const [schoolsData, employeesData] = await Promise.all([
      apiFetch("/schools", { token }),
      apiFetch(
        `/employees${buildEmployeeQuery(filters, user?.isSuperAdmin)}`,
        { token }
      ),
    ]);
    setSchools(schoolsData);
    setEmployees(employeesData);
    if (!form.schoolId && schoolsData[0]?._id) {
      setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
    }
    return schoolParams;
  }

  function buildEmployeeQuery(nextFilters, isSuperAdmin) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    if (!isSuperAdmin && nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  useEffect(() => {
    loadBase().catch((error) => setMessage(error.message));
  }, [token, filters.q, filters.schoolId]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/employees", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({
        ...emptyForm,
        schoolId: current.schoolId,
      }));
      setMessage("Empleado creado");
      await loadBase();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Talento institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Empleados y docentes</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Gestiona la base de personas por colegio, cargo, área y responsable directo para
          habilitar evaluaciones, reportes y seguimiento real.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nuevo empleado</h4>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.schoolId}
              onChange={(event) => setForm({ ...form, schoolId: event.target.value })}
            >
              <option value="">Selecciona colegio</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Nombre"
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              />
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Apellido"
                value={form.apellido}
                onChange={(event) => setForm({ ...form, apellido: event.target.value })}
              />
            </div>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Cargo"
                value={form.cargo}
                onChange={(event) => setForm({ ...form, cargo: event.target.value })}
              />
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Área"
                value={form.area}
                onChange={(event) => setForm({ ...form, area: event.target.value })}
              />
            </div>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.tipoEmpleado}
              onChange={(event) => setForm({ ...form, tipoEmpleado: event.target.value })}
            >
              <option value="DOCENTE">Docente</option>
              <option value="NO_DOCENTE">No docente</option>
              <option value="DIRECTIVO">Directivo</option>
              <option value="RRHH">RRHH</option>
              <option value="OTRO">Otro</option>
            </select>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.managerId}
              onChange={(event) => setForm({ ...form, managerId: event.target.value })}
            >
              <option value="">Sin jefe asignado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
            >
              {isSubmitting ? "Guardando..." : "Crear empleado"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <input
              className="min-w-56 flex-1 rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Buscar por nombre, cargo o mail"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
            <select
              className="min-w-56 rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.schoolId}
              onChange={(event) => setFilters({ ...filters, schoolId: event.target.value })}
            >
              <option value="">Todos los colegios</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {employees.length ? (
              employees.map((employee) => (
                <article key={employee._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <p className="text-lg font-semibold text-slate-950">
                    {employee.apellido}, {employee.nombre}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {employee.cargo} · {employee.area || "Sin área"} · {employee.tipoEmpleado}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{employee.email || "Sin email"}</p>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavía no hay empleados cargados.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
