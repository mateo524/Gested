import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser } from "../lib/roleHelpers";

const tabs = [
  { key: "resumen", label: "Resumen" },
  { key: "personas", label: "Personas" },
  { key: "kpis", label: "KPIs" },
  { key: "okrs", label: "OKRs" },
  { key: "evaluaciones", label: "Evaluaciones" },
  { key: "desarrollo", label: "Desarrollo" },
  { key: "acciones", label: "Acciones" },
];

const severityTone = {
  high: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  low: "border-sky-300/30 bg-sky-500/10 text-sky-100",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function SurfaceCard({ title, subtitle, actions, children }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#93acbb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-rose-300/20 bg-rose-500/10"
          : "border-white/10 bg-[#0f1f28]";
  return (
    <article className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#9ab0bc]">{hint}</p> : null}
    </article>
  );
}

function EmptyPanel({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-[#122530] px-5 py-6 text-sm text-[#9fb6c4]">{text}</div>;
}

function InsightBox({ title, text, tone = "default" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300/20 bg-amber-500/10"
      : tone === "danger"
        ? "border-rose-300/20 bg-rose-500/10"
        : "border-white/10 bg-[#0f1f28]";
  return (
    <article className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#a8bdc8]">{text}</p>
    </article>
  );
}

function ActionBadge({ severity }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityTone[severity] || severityTone.low}`}>
      {severity === "high" ? "Alta" : severity === "medium" ? "Media" : "Baja"}
    </span>
  );
}

function MiniBarChart({ title, items, emptyText = "Sin datos para mostrar." }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 0);
  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-3">
        {items.some((item) => Number(item.value || 0) > 0) ? (
          items.map((item) => {
            const width = maxValue > 0 ? Math.max(6, Math.round((Number(item.value || 0) / maxValue) * 100)) : 0;
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9fb6c4]">
                  <span>{item.label}</span>
                  <span className="font-semibold text-white">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${item.tone || "bg-sky-400"}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[#8fa9b7]">{emptyText}</p>
        )}
      </div>
    </article>
  );
}

function mapActionDestination(action) {
  const text = `${action?.key || ""} ${action?.title || ""} ${action?.description || ""}`.toLowerCase();
  if (text.includes("evalu")) return "evaluaciones";
  if (text.includes("manager") || text.includes("persona") || text.includes("emplead")) return "empleados";
  if (text.includes("plan") || text.includes("desarrollo")) return "planes";
  if (text.includes("ciclo")) return "ciclos";
  if (text.includes("reporte")) return "reporte-ejecutivo";
  return "";
}

export default function ExecutiveReportPage() {
  const { token, user } = useAuth();
  const { setView, searchQuery } = useView();
  const [activeTab, setActiveTab] = useState("resumen");
  const [filters, setFilters] = useState({ cycleId: "", department: "", employeeId: "" });
  const [draftFilters, setDraftFilters] = useState({ cycleId: "", department: "", employeeId: "" });
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const detailRef = useRef(null);

  const canViewExecutive =
    user?.isSuperAdmin ||
    user?.permisos?.includes("view_reports") ||
    user?.permisos?.includes("download_reports") ||
    user?.permisos?.includes("download_team_reports") ||
    user?.permisos?.includes("view_audit");

  const isEmployee = isEmployeeUser(user);

  const loadOverview = useCallback(async () => {
    if (!token || !canViewExecutive || isEmployee) return;
    try {
      setLoadingOverview(true);
      setError("");
      const params = new URLSearchParams();
      if (filters.cycleId) params.set("cycleId", filters.cycleId);
      if (filters.department) params.set("department", filters.department);
      if (filters.employeeId) params.set("employeeId", filters.employeeId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch(`/reports/executive/overview${query}`, {
        token,
        timeoutMs: 30000,
      });
      setOverview(data);

      const normalizedFilters = {
        cycleId: data?.filters?.selectedCycleId || filters.cycleId || "",
        department: data?.filters?.selectedDepartment || filters.department || "",
        employeeId: data?.filters?.selectedEmployeeId || filters.employeeId || "",
      };

      setFilters((current) =>
        current.cycleId === normalizedFilters.cycleId &&
        current.department === normalizedFilters.department &&
        current.employeeId === normalizedFilters.employeeId
          ? current
          : normalizedFilters
      );
      setDraftFilters(normalizedFilters);

      if (!normalizedFilters.employeeId) {
        setDetail(null);
      }
    } catch (nextError) {
      setOverview(null);
      setDetail(null);
      setError(nextError.message);
    } finally {
      setLoadingOverview(false);
    }
  }, [canViewExecutive, filters, isEmployee, token]);

  const loadEmployeeDetail = useCallback(
    async (currentEmployeeId) => {
      if (!token || !currentEmployeeId || !canViewExecutive || isEmployee) return;
      try {
        setLoadingDetail(true);
        setError("");
        const params = new URLSearchParams();
        if (filters.cycleId) params.set("cycleId", filters.cycleId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await apiFetch(`/reports/executive/employees/${currentEmployeeId}${query}`, {
          token,
          timeoutMs: 30000,
        });
        setDetail(data);
      } catch (nextError) {
        setDetail(null);
        setError(nextError.message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [canViewExecutive, filters.cycleId, isEmployee, token]
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (overview?.filters?.selectedEmployeeId) {
      loadEmployeeDetail(overview.filters.selectedEmployeeId);
    }
  }, [loadEmployeeDetail, overview?.filters?.selectedEmployeeId]);

  const employees = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    const items = overview?.catalogs?.employees || [];
    if (!term) return items;
    return items.filter((employee) =>
      [employee.fullName, employee.cargo, employee.area]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [overview?.catalogs?.employees, searchQuery]);
  const cycles = overview?.catalogs?.cycles || [];
  const departments = overview?.catalogs?.departments || [];
  const selectedEmployeeId = overview?.filters?.selectedEmployeeId || filters.employeeId;
  const selectedEmployeeIndex = employees.findIndex((item) => item._id === selectedEmployeeId);
  const selectedEmployee = detail?.employee || overview?.selectedEmployee || null;

  const focusEmployeeDetail = useCallback((employeeId) => {
    setActiveTab("resumen");
    setDraftFilters((current) => ({ ...current, employeeId }));
    setFilters((current) => ({ ...current, employeeId }));
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const actionList = useMemo(() => {
    const items = [...(overview?.actions || []), ...(detail?.actions || [])];
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((action) =>
      [action?.title, action?.description, action?.key]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [detail?.actions, overview?.actions, searchQuery]);

  const executiveNarrative = useMemo(() => {
    const pending = Number(overview?.summary?.evaluationsPending || 0);
    const overduePlans = Number(overview?.summary?.overduePlans || 0);
    const withoutManager = Number(overview?.summary?.employeesWithoutManager || 0);
    const cyclesOpen = Number(overview?.summary?.cyclesOpen || 0);

    return {
      what:
        pending > 0
          ? `Hay ${pending} evaluaciones pendientes dentro del alcance actual.`
          : cyclesOpen > 0
            ? `Hay ${cyclesOpen} ciclos abiertos visibles en este momento.`
            : "El reporte no muestra pendientes operativos fuertes en este momento.",
      why:
        overduePlans > 0
          ? `${overduePlans} planes de desarrollo quedaron vencidos y pueden frenar el seguimiento.`
          : withoutManager > 0
            ? `${withoutManager} personas siguen sin manager asignado y eso impacta el seguimiento del ciclo.`
            : "Conviene igual revisar el avance del ciclo y la cobertura de evaluaciones.",
      now:
        actionList[0]?.description ||
        "Revisa evaluaciones, managers y planes para cerrar el ciclo con mejor trazabilidad.",
    };
  }, [actionList, overview]);

  const tabGuidance = overview?.tabGuidance || {};

  const evaluationChart = useMemo(
    () => [
      {
        label: "Completadas",
        value: Number(overview?.summary?.completedEvaluations || 0),
        tone: "bg-emerald-400",
      },
      {
        label: "Pendientes",
        value: Number(overview?.summary?.evaluationsPending || 0),
        tone: "bg-amber-400",
      },
      {
        label: "Ciclos abiertos",
        value: Number(overview?.summary?.cyclesOpen || 0),
        tone: "bg-sky-400",
      },
    ],
    [overview]
  );

  const kpiChart = useMemo(() => {
    const summary = overview?.kpis?.summaryByStatus || {};
    return [
      { label: "Cumplidos", value: Number(summary.completed || 0), tone: "bg-emerald-400" },
      { label: "En curso", value: Number(summary.inProgress || 0), tone: "bg-amber-400" },
      { label: "En riesgo", value: Number(summary.atRisk || 0), tone: "bg-rose-400" },
      { label: "Sin datos", value: Number(summary.noData || 0), tone: "bg-slate-400" },
    ];
  }, [overview]);

  const okrChart = useMemo(() => {
    const summary = overview?.okrs?.summaryByStatus || {};
    return [
      { label: "Cumplidos", value: Number(summary.completed || 0), tone: "bg-emerald-400" },
      { label: "En curso", value: Number(summary.inProgress || 0), tone: "bg-amber-400" },
      { label: "En riesgo", value: Number(summary.atRisk || 0), tone: "bg-rose-400" },
      { label: "Sin datos", value: Number(summary.noData || 0), tone: "bg-slate-400" },
    ];
  }, [overview]);

  const developmentChart = useMemo(
    () => [
      { label: "Activos", value: Number(overview?.development?.active || 0), tone: "bg-sky-400" },
      { label: "Vencidos", value: Number(overview?.development?.overdue || 0), tone: "bg-rose-400" },
      { label: "Completados", value: Number(overview?.development?.completed || 0), tone: "bg-emerald-400" },
    ],
    [overview]
  );

  function moveEmployee(offset) {
    if (!employees.length || selectedEmployeeIndex < 0) return;
    const nextIndex = selectedEmployeeIndex + offset;
    if (nextIndex < 0 || nextIndex >= employees.length) return;
    const nextId = employees[nextIndex]._id;
    setDraftFilters((current) => ({ ...current, employeeId: nextId }));
    setFilters((current) => ({ ...current, employeeId: nextId }));
  }

  function applyFilters() {
    setFilters({ ...draftFilters });
  }

  if (!canViewExecutive || isEmployee) {
    return (
      <div className="space-y-5">
        <section className="pf-surface pf-surface-pad">
          <p className="pf-section-title">Reportes &gt; Reporte ejecutivo</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Reporte ejecutivo</h1>
          <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            No tienes permisos para ver este reporte organizacional.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="pf-section-title">Reportes &gt; Reporte ejecutivo</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Reporte ejecutivo</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
              Analizá desempeño, objetivos, evaluaciones y desarrollo en una vista interactiva para tomar mejores decisiones.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Vista recomendada para dirección y RR. HH.
              </span>
              <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs font-medium text-[#d6e2e8]">
                Cierre principal del recorrido institucional
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadOverview}
              disabled={loadingOverview}
              className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
            >
              {loadingOverview ? "Actualizando..." : "Actualizar"}
            </button>
            <button
              type="button"
              disabled
              className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm font-medium text-[#718693] opacity-70"
              title="Placeholder visual"
            >
              Guardar vista
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm font-semibold text-[#718693] opacity-75"
              title="Guia disponible proximamente"
            >
              Ver guia
            </button>
          </div>
        </div>
      </section>

      <SurfaceCard title="Filtros" subtitle="Cambia ciclo, área o empleado sin salir de la pantalla.">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Ciclo</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.cycleId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, cycleId: event.target.value }))}
            >
              <option value="">Todos los ciclos visibles</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Area / departamento</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.department}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  department: event.target.value,
                  employeeId: "",
                }))
              }
            >
              <option value="">Todas las areas visibles</option>
              {departments.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Empleado</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.employeeId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">Seleccion automatica</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName} {employee.area ? `- ${employee.area}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white xl:w-auto"
            >
              Aplicar filtros
            </button>
          </div>
        </div>

        {!cycles.length || !employees.length ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#8fa9b7]">
            Algunos filtros tienen datos parciales o todavia no muestran registros suficientes.
          </div>
        ) : null}
      </SurfaceCard>

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Hubo un problema cargando el reporte. Intenta nuevamente.</p>
            <button
              type="button"
              onClick={() => {
                loadOverview();
                if (selectedEmployeeId) loadEmployeeDetail(selectedEmployeeId);
              }}
              className="rounded-2xl border border-rose-200/30 px-4 py-2 text-sm font-semibold text-rose-50"
            >
              Reintentar
            </button>
          </div>
          <p className="mt-2 text-xs text-rose-100/80">{error}</p>
        </div>
      ) : null}

      {loadingOverview ? (
        <EmptyPanel text="Cargando reporte ejecutivo..." />
      ) : !overview ? (
        <EmptyPanel text="No pudimos cargar el reporte ejecutivo para este alcance." />
      ) : (
        <>
          <SurfaceCard title="Navegacion del reporte" subtitle="Explora tabs y cambia de persona sin perder el contexto actual.">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-2xl px-4 py-2.5 text-sm transition ${
                      activeTab === tab.key
                        ? "bg-[#1e3a8a] text-white"
                        : "border border-white/10 bg-[#122530] text-[#AFC3CE]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveEmployee(-1)}
                  disabled={selectedEmployeeIndex <= 0}
                  className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => moveEmployee(1)}
                  disabled={selectedEmployeeIndex < 0 || selectedEmployeeIndex >= employees.length - 1}
                  className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#9fb6c4]">
              {tabGuidance[activeTab] || "Vista rapida del estado general y del seguimiento disponible."}
            </div>
          </SurfaceCard>

          {activeTab === "resumen" ? (
            <div className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <StatCard label="Desempeño promedio" value={overview.summary?.averageScore || 0} hint="Resultado visible en el alcance" />
                <StatCard label="Participacion en evaluaciones" value={overview.summary?.evaluationsTotal || 0} hint="Total registradas" tone="success" />
                <StatCard label="Evaluaciones pendientes" value={overview.summary?.evaluationsPending || 0} hint="Requieren seguimiento" tone="warning" />
                <StatCard label="Planes activos" value={overview.summary?.openPlans || 0} hint={`${overview.summary?.overduePlans || 0} vencidos`} />
                <StatCard label="Acciones pendientes" value={actionList.length || 0} hint="Recomendaciones visibles" tone="warning" />
                <StatCard label="Ciclo actual" value={overview.selectedCycle?.label || "Sin filtro"} hint={`${overview.summary?.cyclesOpen || 0} abiertos`} />
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <SurfaceCard title="Vista actual" subtitle="Resumen de filtros y persona seleccionada.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Ciclo</p>
                      <p className="mt-2 text-base font-semibold text-white">{overview.selectedCycle?.label || "Todos los ciclos visibles"}</p>
                      <p className="mt-1 text-sm text-[#8FA9B7]">
                        {overview.selectedCycle?.estado || "Sin filtro"} · cierre {formatDate(overview.selectedCycle?.fechaFin)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Persona seleccionada</p>
                      <p className="mt-2 text-base font-semibold text-white">{selectedEmployee?.fullName || "Sin persona seleccionada"}</p>
                      <p className="mt-1 text-sm text-[#8FA9B7]">
                        {selectedEmployee?.cargo || "-"} {selectedEmployee?.area ? `· ${selectedEmployee.area}` : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">KPIs</p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {detail?.kpis?.available ? detail.kpis.items?.length || 0 : "Sin dominio persistido"}
                      </p>
                      <p className="mt-1 text-sm text-[#8FA9B7]">
                        {detail?.kpis?.available ? "Registros visibles" : "Todavía no hay KPIs/OKRs persistidos para este período."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">OKRs</p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {detail?.okrs?.available ? detail.okrs.items?.length || 0 : "Sin dominio persistido"}
                      </p>
                      <p className="mt-1 text-sm text-[#8FA9B7]">
                        {detail?.okrs?.available ? "Registros visibles" : "Todavía no hay KPIs/OKRs persistidos para este período."}
                      </p>
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Insights ejecutivos" subtitle="Que esta pasando, por que importa y que conviene hacer ahora.">
                  <div className="space-y-3">
                    <InsightBox title="Que esta pasando" text={executiveNarrative.what} />
                    <InsightBox title="Por que importa" text={executiveNarrative.why} tone="warning" />
                    <InsightBox title="Que hacer ahora" text={executiveNarrative.now} tone="danger" />
                  </div>
                </SurfaceCard>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <MiniBarChart title="Avance de evaluaciones" items={evaluationChart} />
                <MiniBarChart title="KPIs por estado" items={kpiChart} emptyText={overview?.kpis?.message || "No hay KPIs visibles."} />
                <MiniBarChart title="OKRs por estado" items={okrChart} emptyText={overview?.okrs?.message || "No hay OKRs visibles."} />
                <MiniBarChart title="Planes de desarrollo" items={developmentChart} />
              </section>

              <SurfaceCard title="Distribucion por departamento" subtitle="Cantidad de personas, objetivos y planes pendientes dentro del alcance actual.">
                {overview?.departments?.length ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {overview.departments.map((item) => (
                      <article key={item.code} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{item.label}</p>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                            {item.count} personas
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">KPIs</p>
                            <p className="mt-2 text-base font-semibold text-white">{item.kpis || 0}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">OKRs</p>
                            <p className="mt-2 text-base font-semibold text-white">{item.okrs || 0}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Planes pendientes</p>
                            <p className="mt-2 text-base font-semibold text-white">{item.pendingPlans || 0}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel text="No hay departamentos con datos suficientes para resumir." />
                )}
              </SurfaceCard>

              {selectedEmployee ? (
                <div ref={detailRef}>
                  <SurfaceCard
                    title="Detalle de la persona seleccionada"
                    subtitle={`${selectedEmployee.fullName} · ${selectedEmployee.cargo || "Sin cargo"}${selectedEmployee.area ? ` · ${selectedEmployee.area}` : ""}`}
                    actions={
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setView("evaluaciones")} className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white">
                          Ir a Evaluaciones
                        </button>
                        <button type="button" onClick={() => setView("planes")} className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white">
                          Ir a Desarrollo
                        </button>
                      </div>
                    }
                  >
                    {loadingDetail ? (
                      <EmptyPanel text="Cargando detalle del empleado..." />
                    ) : detail ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <StatCard label="Evaluaciones" value={detail.summary?.evaluationCount || 0} />
                          <StatCard label="Pendientes" value={detail.summary?.pendingEvaluations || 0} tone="warning" />
                          <StatCard label="Planes abiertos" value={detail.summary?.openPlans || 0} />
                          <StatCard label="Promedio" value={detail.summary?.averageScore || 0} tone="success" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Departamento / equipo</p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {selectedEmployee.area || detail.employee?.area || "Sin dato visible"}
                            </p>
                          </article>
                          <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">KPIs asignados</p>
                            <p className="mt-2 text-sm font-semibold text-white">{detail.kpis?.items?.length || 0}</p>
                          </article>
                          <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">OKRs asignados</p>
                            <p className="mt-2 text-sm font-semibold text-white">{detail.okrs?.items?.length || 0}</p>
                          </article>
                          <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Acciones pendientes</p>
                            <p className="mt-2 text-sm font-semibold text-white">{detail.actions?.length || 0}</p>
                          </article>
                        </div>
                      </div>
                    ) : (
                      <EmptyPanel text="No hay detalle adicional para esta persona." />
                    )}
                  </SurfaceCard>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "personas" ? (
            employees.length ? (
                <SurfaceCard title="Personas visibles" subtitle="Cambia de persona sin salir del reporte.">
                  <div className="grid gap-3 xl:grid-cols-2">
                  {employees.map((employee) => (
                    <article
                      key={employee._id}
                      className={`rounded-3xl border p-4 transition ${
                        employee._id === selectedEmployeeId ? "border-[#3B82F6] bg-[#10233A]" : "border-white/10 bg-[#0f1f28]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{employee.fullName}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {employee.cargo || "Sin cargo"} {employee.area ? `· ${employee.area}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                            Eval: {employee.evaluationCount}
                          </span>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                            Planes: {employee.planCount}
                          </span>
                          {!employee.hasManager ? (
                            <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
                              Sin manager
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => focusEmployeeDetail(employee._id)}
                          className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white"
                        >
                          Ver detalle
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text="No hay personas visibles para los filtros seleccionados." />
            )
          ) : null}

          {activeTab === "kpis" ? (
            loadingDetail ? (
              <EmptyPanel text="Cargando KPIs..." />
            ) : detail?.kpis?.available && detail?.kpis?.items?.length ? (
              <SurfaceCard title="KPIs visibles" subtitle="Indicadores operativos persistidos para la persona y el alcance actual.">
                <div className="space-y-3">
                  {detail.kpis.items.map((item) => (
                    <article key={item._id} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {item.code || "Sin codigo"} {item.departmentCode ? `· ${item.departmentCode}` : ""}
                          </p>
                          <p className="mt-3 text-sm text-[#c8d8df]">
                            Objetivo {item.targetValue ?? "-"} {item.unit || ""}
                            {item.frequency ? ` · ${item.frequency}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.status ? (
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">{item.status}</span>
                          ) : null}
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                            Actualizado {formatDate(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text={detail?.kpis?.message || overview.kpis?.message || "No hay KPIs persistidos para este período."} />
            )
          ) : null}

          {activeTab === "okrs" ? (
            loadingDetail ? (
              <EmptyPanel text="Cargando OKRs..." />
            ) : detail?.okrs?.available && detail?.okrs?.items?.length ? (
              <SurfaceCard title="OKRs visibles" subtitle="Objetivos y resultados clave disponibles para este alcance.">
                <div className="space-y-3">
                  {detail.okrs.items.map((item) => (
                    <article key={item._id} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.objectiveTitle}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {item.keyResultTitle}
                            {item.quarter ? ` · ${item.quarter}` : ""}
                            {item.departmentCode ? ` · ${item.departmentCode}` : ""}
                          </p>
                          <p className="mt-3 text-sm text-[#c8d8df]">Meta {item.targetValue ?? "-"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.status ? (
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">{item.status}</span>
                          ) : null}
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                            Actualizado {formatDate(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text={detail?.okrs?.message || overview.okrs?.message || "No hay OKRs persistidos para este período."} />
            )
          ) : null}

          {activeTab === "evaluaciones" ? (
            loadingDetail ? (
              <EmptyPanel text="Cargando evaluaciones..." />
            ) : detail?.evaluations?.length ? (
              <SurfaceCard title="Evaluaciones" subtitle="Estado actual del ciclo y resultados visibles para la persona seleccionada.">
                <div className="space-y-3">
                  {detail.evaluations.map((evaluation) => (
                    <article key={evaluation._id} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{evaluation.tipo}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {evaluation.cycle?.label || "Sin ciclo"} · {formatDate(evaluation.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">{evaluation.estado}</span>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                            Resultado {evaluation.resultadoFinal || 0}
                          </span>
                        </div>
                      </div>
                      {evaluation.comentariosGenerales ? (
                        <p className="mt-3 text-sm text-[#c8d8df]">{evaluation.comentariosGenerales}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text="No hay evaluaciones para la persona seleccionada en este alcance." />
            )
          ) : null}

          {activeTab === "desarrollo" ? (
            loadingDetail ? (
              <EmptyPanel text="Cargando planes de desarrollo..." />
            ) : detail?.developmentPlans?.length ? (
              <SurfaceCard title="Desarrollo" subtitle="Planes activos, vencidos y proximos visibles para este alcance.">
                <div className="space-y-3">
                  {detail.developmentPlans.map((plan) => (
                    <article key={plan._id} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{plan.aspectoDesarrollar}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            Seguimiento {formatDate(plan.fechaSeguimiento)} · creado {formatDate(plan.createdAt)}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">{plan.estado}</span>
                      </div>
                      {plan.fortalezas?.length ? (
                        <p className="mt-3 text-sm text-[#c8d8df]">Fortalezas: {plan.fortalezas.join(", ")}</p>
                      ) : null}
                      {plan.medicion ? <p className="mt-2 text-sm text-[#c8d8df]">Medicion: {plan.medicion}</p> : null}
                    </article>
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text="No hay planes de desarrollo para la persona seleccionada." />
            )
          ) : null}

          {activeTab === "acciones" ? (
            actionList.length ? (
              <SurfaceCard title="Acciones recomendadas" subtitle="Explicables, priorizadas y sin prediccion sensible.">
                <div className="space-y-3">
                  {actionList.map((action, index) => {
                    const destination = mapActionDestination(action);
                    return (
                      <article
                        key={`${action.key || action.title}-${index}`}
                        className={`rounded-3xl border p-4 ${severityTone[action.severity] || severityTone.low}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{action.title}</p>
                              <ActionBadge severity={action.severity} />
                            </div>
                            <p className="mt-2 text-sm opacity-90">{action.description}</p>
                          </div>
                          {"count" in action ? (
                            <span className="rounded-full border border-current/20 px-3 py-1 text-xs">{action.count}</span>
                          ) : null}
                        </div>
                        <div className="mt-4">
                          {destination ? (
                            <button
                              type="button"
                              onClick={() => setView(destination)}
                              className="rounded-2xl border border-current/20 px-3 py-2 text-sm font-medium"
                            >
                              Ir al modulo
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded-2xl border border-current/20 px-3 py-2 text-sm font-medium opacity-70"
                            >
                              Sin destino directo
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyPanel text="No hay acciones recomendadas para los filtros seleccionados." />
            )
          ) : null}
        </>
      )}
    </div>
  );
}
