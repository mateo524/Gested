import { useEffect, useMemo, useState } from "react";
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
  fechaIngreso: "",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function ProfilePanel({ profile, onClose }) {
  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/20">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Ficha de empleado</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {profile.employee.apellido}, {profile.employee.nombre}
            </h3>
            <p className="mt-1 text-slate-600">
              {profile.employee.cargo} · {profile.employee.area || "Sin área"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Evaluaciones</p>
            <p className="mt-2 text-2xl font-bold">{profile.stats.evaluationCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Promedio</p>
            <p className="mt-2 text-2xl font-bold">{profile.stats.averageScore}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Planes</p>
            <p className="mt-2 text-2xl font-bold">{profile.stats.planCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Planes abiertos</p>
            <p className="mt-2 text-2xl font-bold">{profile.stats.openPlans}</p>
          </article>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-900">Datos base</h4>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <p>Email: {profile.employee.email || "-"}</p>
            <p>Tipo: {profile.employee.tipoEmpleado || "-"}</p>
            <p>Ingreso: {formatDate(profile.employee.fechaIngreso)}</p>
            <p>
              Jefe:{" "}
              {profile.manager
                ? `${profile.manager.apellido}, ${profile.manager.nombre} (${profile.manager.cargo || "-"})`
                : "Sin jefe asignado"}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-slate-900">Evaluaciones recientes</h4>
          <div className="mt-3 space-y-3">
            {profile.evaluations.length ? (
              profile.evaluations.map((item) => (
                <article key={item._id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">
                    {item.tipo} · {item.estado}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Resultado: {item.resultadoFinal ?? "-"} · Fecha: {formatDate(item.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">Sin evaluaciones registradas.</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-slate-900">Planes de desarrollo recientes</h4>
          <div className="mt-3 space-y-3">
            {profile.plans.length ? (
              profile.plans.map((plan) => (
                <article key={plan._id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{plan.aspectoDesarrollar}</p>
                  <p className="mt-1 text-slate-600">
                    Estado: {plan.estado} · Seguimiento: {formatDate(plan.fechaSeguimiento)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">Sin planes cargados.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function EmployeesPage() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filters, setFilters] = useState({ q: "", schoolId: "" });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);

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

  async function openProfile(employeeId) {
    try {
      setMessage("");
      const data = await apiFetch(`/employees/${employeeId}/profile`, { token });
      setProfile(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

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
          Gestiona la base de personas por colegio, cargo, área y responsable directo para habilitar
          evaluaciones, reportes y seguimiento real.
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

            <div className="grid gap-4 md:grid-cols-2">
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
              <input
                type="date"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.fechaIngreso}
                onChange={(event) => setForm({ ...form, fechaIngreso: event.target.value })}
              />
            </div>

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
              employees.map((employee) => {
                const manager = employee.managerId ? employeesById.get(employee.managerId) : null;
                return (
                  <article key={employee._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                    <p className="text-lg font-semibold text-slate-950">
                      {employee.apellido}, {employee.nombre}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {employee.cargo} · {employee.area || "Sin área"} · {employee.tipoEmpleado}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{employee.email || "Sin email"}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Jefe: {manager ? `${manager.apellido}, ${manager.nombre}` : "Sin asignar"}
                    </p>
                    <button
                      type="button"
                      onClick={() => openProfile(employee._id)}
                      className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    >
                      Ver ficha completa
                    </button>
                  </article>
                );
              })
            ) : (
              <p className="text-slate-500">
                {user?.roleCode === "JEFE"
                  ? "Todavía no tienes equipo asignado."
                  : "Todavía no hay empleados cargados."}
              </p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <ProfilePanel profile={profile} onClose={() => setProfile(null)} />
    </div>
  );
}
