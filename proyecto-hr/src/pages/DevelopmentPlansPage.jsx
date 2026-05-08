import { useCallback, useEffect, useState } from "react";
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
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const roleScope = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
  const baseCacheKey = `pf_plans_base_${roleScope}`;
  const plansCacheKey = `pf_plans_list_${roleScope}_${filters.employeeId || "all"}_${filters.estado || "all"}`;

  const loadPlans = useCallback(async (signal) => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.estado) params.set("estado", filters.estado);
    const query = params.toString() ? `?${params.toString()}` : "";
    setIsLoadingPlans(true);
    try {
      const plansData = await apiFetch(`/development-plans${query}`, {
        token,
        signal,
        timeoutMs: 20000,
      });
      setPlans(plansData);
      sessionStorage.setItem(plansCacheKey, JSON.stringify(plansData));
    } finally {
      setIsLoadingPlans(false);
    }
  }, [filters.employeeId, filters.estado, token, plansCacheKey]);

  const loadBaseData = useCallback(async (signal) => {
    setIsLoadingBase(true);
    try {
      const [employeesData, evaluationsData] = await Promise.all([
        apiFetch("/employees", { token, signal, timeoutMs: 20000 }),
        apiFetch("/evaluations", { token, signal, timeoutMs: 20000 }),
      ]);
      setEmployees(employeesData);
      setEvaluations(evaluationsData);
      sessionStorage.setItem(
        baseCacheKey,
        JSON.stringify({ employees: employeesData, evaluations: evaluationsData })
      );
    } finally {
      setIsLoadingBase(false);
    }
  }, [baseCacheKey, token]);

  useEffect(() => {
    const cachedBase = sessionStorage.getItem(baseCacheKey);
    if (cachedBase) {
      try {
        const parsed = JSON.parse(cachedBase);
        setEmployees(parsed.employees || []);
        setEvaluations(parsed.evaluations || []);
      } catch {
        sessionStorage.removeItem(baseCacheKey);
      }
    }

    const controller = new AbortController();
    loadBaseData(controller.signal).catch((error) => {
      if (!controller.signal.aborted) setMessage(error.message);
    });
    return () => controller.abort();
  }, [baseCacheKey, loadBaseData]);

  useEffect(() => {
    const cachedPlans = sessionStorage.getItem(plansCacheKey);
    if (cachedPlans) {
      try {
        setPlans(JSON.parse(cachedPlans) || []);
      } catch {
        sessionStorage.removeItem(plansCacheKey);
      }
    }

    const controller = new AbortController();
    loadPlans(controller.signal).catch((error) => {
      if (!controller.signal.aborted) setMessage(error.message);
    });
    return () => controller.abort();
  }, [loadPlans, plansCacheKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.employeeId || !form.aspectoDesarrollar) {
      setMessage("Selecciona empleado y define el aspecto a desarrollar.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/development-plans", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fortalezas: form.fortalezas.split(",").map((item) => item.trim()).filter(Boolean),
          evaluationId: form.evaluationId || null,
          fechaSeguimiento: form.fechaSeguimiento || null,
        }),
      });
      setForm(emptyForm);
      setMessage("Plan de desarrollo creado.");
      await loadPlans();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Seguimiento profesional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Planes de desarrollo</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">Define fortalezas, objetivo de mejora, medicion y fecha de seguimiento.</p>
        {isLoadingBase || isLoadingPlans ? (
          <p className="mt-3 text-xs text-[#9fb6c4]">Actualizando datos...</p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">Nuevo plan</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Empleado</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 2: Objetivo</span>
            <span className="rounded-full border border-white/20 bg-[#0f1f28] px-3 py-1 text-xs text-[#c5d5de]">Paso 3: Seguimiento</span>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">1. Relacion base</p>
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
              <option value="">Selecciona empleado</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>

            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.evaluationId} onChange={(event) => setForm({ ...form, evaluationId: event.target.value })}>
              <option value="">Sin evaluacion base</option>
              {evaluations.map((evaluation) => (
                <option key={evaluation._id} value={evaluation._id}>
                  {evaluation.tipo} - {evaluation.employeeId?.apellido}, {evaluation.employeeId?.nombre}
                </option>
              ))}
            </select>

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">2. Definicion del plan</p>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Fortalezas (separadas por coma)" value={form.fortalezas} onChange={(event) => setForm({ ...form, fortalezas: event.target.value })} />
            <textarea className="min-h-24 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Aspecto a desarrollar" value={form.aspectoDesarrollar} onChange={(event) => setForm({ ...form, aspectoDesarrollar: event.target.value })} />
            <textarea className="min-h-20 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Como se va a medir" value={form.medicion} onChange={(event) => setForm({ ...form, medicion: event.target.value })} />

            <p className="pt-1 text-xs uppercase tracking-[0.16em] text-[#7f99a8]">3. Seguimiento</p>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.fechaSeguimiento} onChange={(event) => setForm({ ...form, fechaSeguimiento: event.target.value })} />
              <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white">
              {isSubmitting ? "Guardando..." : "Crear plan"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap gap-3">
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.employeeId} onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}>
              <option value="">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.apellido}, {employee.nombre}
                </option>
              ))}
            </select>
            <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value })}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {plans.length ? (
              plans.map((plan) => (
                <article key={plan._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{plan.employeeId?.apellido}, {plan.employeeId?.nombre}</p>
                    <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">{plan.estado}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#c5d5de]">{plan.aspectoDesarrollar}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">Medicion: {plan.medicion || "-"}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">Seguimiento: {plan.fechaSeguimiento ? new Date(plan.fechaSeguimiento).toLocaleDateString("es-AR") : "-"}</p>
                </article>
              ))
            ) : (
              <p className="text-[#9fb6c4]">
                {user?.roleCode === "EMPLEADO" ? "Todavia no tienes planes asociados." : "Todavia no hay planes cargados."}
              </p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#c5d5de]">{message}</p> : null}
    </div>
  );
}

