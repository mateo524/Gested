import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  employeeId: "",
  evaluationId: "",
  fortalezas: "",
  aspectoDesarrollar: "",
  medicion: "",
  fechaSeguimiento: "",
  estado: "PENDIENTE",
};

export default function DevelopmentPlansPage() {
  const { token, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ employeeId: "", estado: "" });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const params = new URLSearchParams();
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.estado) params.set("estado", filters.estado);
    const query = params.toString() ? `?${params.toString()}` : "";

    const [plansData, employeesData, evaluationsData] = await Promise.all([
      apiFetch(`/development-plans${query}`, { token }),
      apiFetch("/employees", { token }),
      apiFetch("/evaluations", { token }),
    ]);

    setPlans(plansData);
    setEmployees(employeesData);
    setEvaluations(evaluationsData);
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token, filters.employeeId, filters.estado]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/development-plans", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fortalezas: form.fortalezas
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          evaluationId: form.evaluationId || null,
          fechaSeguimiento: form.fechaSeguimiento || null,
        }),
      });

      setForm(emptyForm);
      setMessage("Plan de desarrollo creado");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Seguimiento profesional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Planes de desarrollo</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Define fortalezas, objetivos de mejora, forma de medición y fecha de seguimiento para cada
          persona evaluada.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nuevo plan</h4>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.employeeId}
              onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
            >
              <option value="">Selecciona empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.evaluationId}
              onChange={(event) => setForm({ ...form, evaluationId: event.target.value })}
            >
              <option value="">Sin evaluación base</option>
              {evaluations.map((evaluation) => (
                <option key={evaluation._id} value={evaluation._id}>
                  {evaluation.tipo} · {evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}
                </option>
              ))}
            </select>

            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Fortalezas separadas por coma"
              value={form.fortalezas}
              onChange={(event) => setForm({ ...form, fortalezas: event.target.value })}
            />

            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Aspecto a desarrollar"
              value={form.aspectoDesarrollar}
              onChange={(event) => setForm({ ...form, aspectoDesarrollar: event.target.value })}
            />

            <textarea
              className="min-h-20 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Cómo se va a medir"
              value={form.medicion}
              onChange={(event) => setForm({ ...form, medicion: event.target.value })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="date"
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.fechaSeguimiento}
                onChange={(event) => setForm({ ...form, fechaSeguimiento: event.target.value })}
              />
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value })}
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
            >
              {isSubmitting ? "Guardando..." : "Crear plan"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.employeeId}
              onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}
            >
              <option value="">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.estado}
              onChange={(event) => setFilters({ ...filters, estado: event.target.value })}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {plans.length ? (
              plans.map((plan) => (
                <article key={plan._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-slate-950">
                      {plan.employeeId?.apellido}, {plan.employeeId?.nombre}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {plan.estado}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{plan.aspectoDesarrollar}</p>
                  <p className="mt-1 text-sm text-slate-500">Medición: {plan.medicion || "-"}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Seguimiento:{" "}
                    {plan.fechaSeguimiento
                      ? new Date(plan.fechaSeguimiento).toLocaleDateString("es-AR")
                      : "-"}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-slate-500">
                {user?.roleCode === "EMPLEADO"
                  ? "Todavía no tienes planes asociados."
                  : "Todavía no hay planes cargados."}
              </p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
