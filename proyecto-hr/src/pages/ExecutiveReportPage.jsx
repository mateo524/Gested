import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser } from "../lib/roleHelpers";

const PRIMARY_TABS = [
  { key: "general", label: "Reporte general" },
  { key: "individual", label: "Reporte individual" },
];

const severityTone = {
  high: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  low: "border-sky-300/30 bg-sky-500/10 text-sky-100",
};

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function average(values = []) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
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
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#122530] px-5 py-6 text-sm text-[#9fb6c4]">
      {text}
    </div>
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
  return "";
}

function buildGeneralActionSummary(actions = []) {
  return {
    high: actions.filter((item) => item.severity === "high").length,
    medium: actions.filter((item) => item.severity === "medium").length,
    low: actions.filter((item) => item.severity === "low").length,
  };
}

function buildEvaluationTypeChart(evaluations = []) {
  const auto = evaluations.filter((item) => item.tipo === "AUTOEVALUACION").map((item) => item.resultadoFinal);
  const manager = evaluations.filter((item) => item.tipo === "JEFATURA").map((item) => item.resultadoFinal);
  const final = evaluations.filter((item) => item.tipo === "FINAL").map((item) => item.resultadoFinal);
  return [
    { label: "Autoevaluación", value: Number((average(auto) || 0).toFixed(1)), tone: "bg-sky-400" },
    { label: "Superior", value: Number((average(manager) || 0).toFixed(1)), tone: "bg-emerald-400" },
    { label: "Cierre final", value: Number((average(final) || 0).toFixed(1)), tone: "bg-violet-400" },
  ];
}

function buildStatusChart(items = [], statusKey = "status") {
  const buckets = new Map();
  items.forEach((item) => {
    const key = String(item?.[statusKey] || "Sin estado").trim() || "Sin estado";
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()].map(([label, value], index) => ({
    label,
    value,
    tone: ["bg-sky-400", "bg-amber-400", "bg-rose-400", "bg-emerald-400", "bg-violet-400"][index % 5],
  }));
}

function buildMetricSignalRows(metricSignals = []) {
  return metricSignals
    .slice()
    .sort((left, right) => Number(right.averageScore || 0) - Number(left.averageScore || 0))
    .slice(0, 8)
    .map((item) => ({
      label: item.competencyName || item.metricName || "Competencia",
      value: Number(item.averageScore || 0),
      tone: "bg-sky-400",
    }));
}

export default function ExecutiveReportPage() {
  const { token, user } = useAuth();
  const { setView, searchQuery } = useView();
  const [activeTab, setActiveTab] = useState("general");
  const [filters, setFilters] = useState({ cycleId: "", department: "", employeeId: "" });
  const [draftFilters, setDraftFilters] = useState({ cycleId: "", department: "", employeeId: "" });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const detailRef = useRef(null);
  const pendingDetailScrollRef = useRef(false);

  const canViewExecutive =
    user?.isSuperAdmin ||
    user?.permisos?.includes("view_reports") ||
    user?.permisos?.includes("download_reports") ||
    user?.permisos?.includes("download_team_reports") ||
    user?.permisos?.includes("view_audit");

  const isEmployee = isEmployeeUser(user);

  const scrollDetailIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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
      const data = await apiFetch(`/reports/executive/overview${query}`, { token, timeoutMs: 30000 });
      setOverview(data);

      const normalizedFilters = {
        cycleId: data?.filters?.selectedCycleId || filters.cycleId || "",
        department: data?.filters?.selectedDepartment || filters.department || "",
        employeeId: filters.employeeId || "",
      };
      setFilters((current) =>
        current.cycleId === normalizedFilters.cycleId &&
        current.department === normalizedFilters.department &&
        current.employeeId === normalizedFilters.employeeId
          ? current
          : normalizedFilters
      );
      setDraftFilters((current) =>
        current.cycleId === normalizedFilters.cycleId &&
        current.department === normalizedFilters.department &&
        current.employeeId === normalizedFilters.employeeId
          ? current
          : normalizedFilters
      );

      if (!selectedEmployeeId) {
        setDetail(null);
      }
    } catch (nextError) {
      setOverview(null);
      setDetail(null);
      setError(nextError.message);
    } finally {
      setLoadingOverview(false);
    }
  }, [canViewExecutive, filters.cycleId, filters.department, filters.employeeId, isEmployee, selectedEmployeeId, token]);

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
        if (pendingDetailScrollRef.current) {
          pendingDetailScrollRef.current = false;
          scrollDetailIntoView();
        }
      } catch (nextError) {
        setDetail(null);
        setError(nextError.message);
        pendingDetailScrollRef.current = false;
      } finally {
        setLoadingDetail(false);
      }
    },
    [canViewExecutive, filters.cycleId, isEmployee, scrollDetailIntoView, token]
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeDetail(selectedEmployeeId);
    } else {
      setDetail(null);
    }
  }, [loadEmployeeDetail, selectedEmployeeId]);

  const employees = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((employee) =>
      [employee.fullName, employee.cargo, employee.area]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [overview?.catalogs?.employees, searchQuery]);

  const cycles = overview?.catalogs?.cycles || [];
  const departments = overview?.catalogs?.departments || [];
  const selectedEmployee =
    detail?.employee ||
    employees.find((employee) => employee._id === selectedEmployeeId) ||
    overview?.selectedEmployee ||
    null;

  const focusEmployeeDetail = useCallback(
    (employeeId, options = {}) => {
      if (!employeeId) return;
      const { activateTab = true } = options;
      if (activateTab) {
        setActiveTab("individual");
      }
      setDraftFilters((current) => (current.employeeId === employeeId ? current : { ...current, employeeId }));
      if (selectedEmployeeId === employeeId) {
        pendingDetailScrollRef.current = false;
        scrollDetailIntoView();
        return;
      }
      pendingDetailScrollRef.current = true;
      setSelectedEmployeeId(employeeId);
    },
    [scrollDetailIntoView, selectedEmployeeId]
  );

  function applyFilters() {
    setFilters({ ...draftFilters });
  }

  const overviewActions = useMemo(() => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return [...(overview?.actions || [])].sort((a, b) => {
      const weight = (severityOrder[a?.severity] ?? 9) - (severityOrder[b?.severity] ?? 9);
      if (weight !== 0) return weight;
      return Number(b?.count || 0) - Number(a?.count || 0);
    });
  }, [overview?.actions]);

  const actionPrioritySummary = useMemo(() => buildGeneralActionSummary(overviewActions), [overviewActions]);

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

  const individualEvaluationChart = useMemo(
    () => buildEvaluationTypeChart(detail?.evaluations || []),
    [detail?.evaluations]
  );

  const individualMetricSignalChart = useMemo(
    () => buildMetricSignalRows(detail?.metricSignals || []),
    [detail?.metricSignals]
  );

  const individualKpiChart = useMemo(
    () => buildStatusChart(detail?.kpis?.items || []),
    [detail?.kpis?.items]
  );

  const individualOkrChart = useMemo(
    () => buildStatusChart(detail?.okrs?.items || []),
    [detail?.okrs?.items]
  );

  const individualPlanChart = useMemo(
    () => buildStatusChart(detail?.developmentPlans || [], "estado"),
    [detail?.developmentPlans]
  );

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
              Leé el estado general de la organización y, cuando haga falta, bajá al detalle individual de cada persona.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            disabled={loadingOverview}
            className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
          >
            {loadingOverview ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#1e3a8a] text-white shadow-[0_12px_30px_rgba(30,58,138,0.22)]"
                  : "border border-white/10 bg-[#122530] text-[#c5d5de]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <SurfaceCard title="Filtros del reporte" subtitle="Cambiá ciclo, área o persona sin salir de la pantalla.">
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
            <span className="mb-2 block text-sm text-[#c5d5de]">Área / departamento</span>
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
              <option value="">Todas las áreas visibles</option>
              {departments.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Persona</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.employeeId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">Selección automática</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName} {employee.area ? `· ${employee.area}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </SurfaceCard>

      {error ? <div className="pf-alert-error">{error}</div> : null}

      {loadingOverview ? (
        <EmptyPanel text="Estamos preparando el reporte ejecutivo con el alcance visible para este perfil." />
      ) : !overview ? (
        <EmptyPanel text="No pudimos cargar el reporte en este momento." />
      ) : activeTab === "general" ? (
        <div className="min-h-[36rem] space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Personas visibles" value={overview.summary?.employeesTotal || 0} hint="Dentro del alcance actual" />
            <StatCard label="Desempeño promedio" value={overview.summary?.averageScore || 0} hint="Resultado visible" tone="success" />
            <StatCard label="Evaluaciones pendientes" value={overview.summary?.evaluationsPending || 0} hint="Requieren seguimiento" tone="warning" />
            <StatCard label="KPIs visibles" value={overview.kpis?.total || 0} hint="Indicadores agregados" />
            <StatCard label="Planes abiertos" value={overview.development?.active || 0} hint={`${overview.development?.overdue || 0} vencidos`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <SurfaceCard title="Panorama general" subtitle="Lectura rápida del estado actual del desempeño y el seguimiento.">
              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Ciclo activo</p>
                  <p className="mt-2 text-base font-semibold text-white">{overview.selectedCycle?.label || "Todos los ciclos visibles"}</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">Estado {overview.selectedCycle?.estado || "Sin filtro"}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Cobertura de evaluación</p>
                  <p className="mt-2 text-base font-semibold text-white">{overview.summary?.evaluationsTotal || 0} registros</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{overview.summary?.completedEvaluations || 0} cerradas o revisadas</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Desarrollo</p>
                  <p className="mt-2 text-base font-semibold text-white">{overview.development?.active || 0} planes activos</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{overview.development?.overdue || 0} con seguimiento vencido</p>
                </article>
              </div>
            </SurfaceCard>

            <SurfaceCard title="Acciones recomendadas" subtitle="Prioridades generales según los datos visibles hoy.">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard label="Alta" value={actionPrioritySummary.high} tone="danger" />
                <StatCard label="Media" value={actionPrioritySummary.medium} tone="warning" />
                <StatCard label="Baja" value={actionPrioritySummary.low} />
              </div>
              <div className="mt-4 space-y-3">
                {overviewActions.length ? (
                  overviewActions.slice(0, 4).map((action, index) => {
                    const destination = mapActionDestination(action);
                    return (
                      <article key={`${action.key || action.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{action.title}</p>
                              <ActionBadge severity={action.severity} />
                            </div>
                            <p className="mt-2 text-sm text-[#9fb6c4]">{action.description}</p>
                          </div>
                          {"count" in action ? (
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                              {action.count}
                            </span>
                          ) : null}
                        </div>
                        {destination ? (
                          <button
                            type="button"
                            onClick={() => setView(destination)}
                            className="mt-4 rounded-2xl border border-white/15 px-3 py-2 text-sm text-white"
                          >
                            Ir al módulo
                          </button>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <EmptyPanel text="No hay acciones generales para destacar con los filtros actuales." />
                )}
              </div>
            </SurfaceCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <MiniBarChart title="Estado de evaluaciones" items={evaluationChart} emptyText="No hay evaluaciones visibles." />
            <MiniBarChart title="Planes de desarrollo" items={developmentChart} emptyText="No hay planes visibles." />
            <MiniBarChart title="KPIs agregados" items={kpiChart} emptyText={overview?.kpis?.message || "No hay KPIs visibles."} />
            <MiniBarChart title="OKRs agregados" items={okrChart} emptyText={overview?.okrs?.message || "No hay OKRs visibles."} />
          </div>

          <SurfaceCard title="Distribución por departamento / equipo" subtitle="Cómo se reparte el seguimiento entre áreas visibles.">
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

          <SurfaceCard title="Personas visibles" subtitle="Desde acá podés saltar directo al reporte individual de cada persona.">
            {employees.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {employees.map((employee) => (
                  <article key={employee._id} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
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
            ) : (
              <EmptyPanel text="No hay personas visibles para los filtros seleccionados." />
            )}
          </SurfaceCard>
        </div>
      ) : (
        <div className="min-h-[36rem] space-y-5">
          <SurfaceCard title="Reporte individual" subtitle="Elegí una persona para ver su desempeño, sus evaluaciones, objetivos y desarrollo en un solo lugar.">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_auto]">
              <label className="block">
                <span className="mb-2 block text-sm text-[#c5d5de]">Persona</span>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
                  value={selectedEmployeeId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setDraftFilters((current) => ({ ...current, employeeId: nextId }));
                    if (!nextId) {
                      pendingDetailScrollRef.current = false;
                      setSelectedEmployeeId("");
                      return;
                    }
                    focusEmployeeDetail(nextId, { activateTab: false });
                  }}
                >
                  <option value="">Elegí una persona</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.fullName} {employee.area ? `· ${employee.area}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => selectedEmployeeId && scrollDetailIntoView()}
                  disabled={!selectedEmployeeId}
                  className="w-full rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver detalle
                </button>
              </div>
            </div>
          </SurfaceCard>

          {!selectedEmployeeId ? (
            <EmptyPanel text="Elegí una persona para ver su reporte individual." />
          ) : (
            <div ref={detailRef} className="min-h-[24rem] space-y-5">
              <SurfaceCard
                title="Detalle individual"
                subtitle={
                  selectedEmployee
                    ? `${selectedEmployee.fullName} · ${selectedEmployee.cargo || "Sin cargo"}${selectedEmployee.area ? ` · ${selectedEmployee.area}` : ""}`
                    : "Cargando detalle individual"
                }
                actions={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setView("evaluaciones")}
                      className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white"
                    >
                      Ir a Evaluaciones
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("planes")}
                      className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white"
                    >
                      Ir a Desarrollo
                    </button>
                  </div>
                }
              >
                {loadingDetail ? (
                  <EmptyPanel text="Cargando el detalle de la persona seleccionada..." />
                ) : !detail ? (
                  <EmptyPanel text="No hay detalle disponible para esta persona en el alcance actual." />
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Evaluaciones" value={detail.summary?.evaluationCount || 0} />
                      <StatCard label="Pendientes" value={detail.summary?.pendingEvaluations || 0} tone="warning" />
                      <StatCard label="Promedio" value={detail.summary?.averageScore || 0} tone="success" />
                      <StatCard label="Planes abiertos" value={detail.summary?.openPlans || 0} hint={`${detail.summary?.overduePlans || 0} vencidos`} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Nombre</p>
                        <p className="mt-2 text-sm font-semibold text-white">{detail.employee?.fullName || selectedEmployee?.fullName || "Sin dato visible"}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Cargo / rol</p>
                        <p className="mt-2 text-sm font-semibold text-white">{detail.employee?.cargo || selectedEmployee?.cargo || "Sin dato visible"}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Departamento / equipo</p>
                        <p className="mt-2 text-sm font-semibold text-white">{detail.employee?.area || selectedEmployee?.area || "Sin dato visible"}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Ciclo / período</p>
                        <p className="mt-2 text-sm font-semibold text-white">{overview?.selectedCycle?.label || "Sin ciclo visible"}</p>
                      </article>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <MiniBarChart
                        title="Desempeño por competencia"
                        items={individualMetricSignalChart}
                        emptyText="Todavía no hay competencias con puntaje visible para esta persona."
                      />
                      <MiniBarChart
                        title="Autoevaluación vs superior"
                        items={individualEvaluationChart}
                        emptyText="Todavía no hay evaluaciones suficientes para comparar."
                      />
                      <MiniBarChart
                        title="KPIs / OKRs por estado"
                        items={[...individualKpiChart.slice(0, 3), ...individualOkrChart.slice(0, 2)]}
                        emptyText="No hay KPIs u OKRs visibles para esta persona."
                      />
                      <MiniBarChart
                        title="Planes de desarrollo"
                        items={individualPlanChart}
                        emptyText="No hay planes de desarrollo visibles para esta persona."
                      />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <SurfaceCard title="Evaluaciones" subtitle="Autoevaluación, evaluación superior y cierre final cuando existan.">
                        {detail.evaluations?.length ? (
                          <div className="space-y-3">
                            {detail.evaluations.map((evaluation) => (
                              <article key={evaluation._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
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
                        ) : (
                          <EmptyPanel text="No hay evaluaciones visibles para esta persona." />
                        )}
                      </SurfaceCard>

                      <SurfaceCard title="KPIs y OKRs asignados" subtitle="Objetivos e indicadores visibles dentro del alcance actual.">
                        {detail.kpis?.items?.length || detail.okrs?.items?.length ? (
                          <div className="space-y-3">
                            {detail.kpis?.items?.map((item) => (
                              <article key={`kpi-${item._id}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                                <p className="font-semibold text-white">{item.name}</p>
                                <p className="mt-1 text-sm text-[#8FA9B7]">
                                  KPI {item.code || "sin código"} · {item.status || "Sin estado"}
                                </p>
                                <p className="mt-2 text-sm text-[#c8d8df]">
                                  Actual {item.currentValue ?? "-"} / Meta {item.targetValue ?? "-"} {item.unit || ""}
                                </p>
                              </article>
                            ))}
                            {detail.okrs?.items?.map((item) => (
                              <article key={`okr-${item._id}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                                <p className="font-semibold text-white">{item.objectiveTitle}</p>
                                <p className="mt-1 text-sm text-[#8FA9B7]">{item.keyResultTitle || "Sin resultado clave visible"}</p>
                                <p className="mt-2 text-sm text-[#c8d8df]">
                                  Actual {item.currentValue ?? "-"} / Meta {item.targetValue ?? "-"}
                                </p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <EmptyPanel text="No hay KPIs u OKRs visibles para esta persona." />
                        )}
                      </SurfaceCard>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <SurfaceCard title="Desarrollo" subtitle="Planes activos, vencidos o completados para esta persona.">
                        {detail.developmentPlans?.length ? (
                          <div className="space-y-3">
                            {detail.developmentPlans.map((plan) => (
                              <article key={plan._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
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
                                {plan.medicion ? <p className="mt-2 text-sm text-[#c8d8df]">Medición: {plan.medicion}</p> : null}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <EmptyPanel text="No hay planes de desarrollo visibles para esta persona." />
                        )}
                      </SurfaceCard>

                      <SurfaceCard title="Acciones pendientes" subtitle="Qué conviene atender ahora según lo visible en el reporte individual.">
                        {detail.actions?.length ? (
                          <div className="space-y-3">
                            {detail.actions.map((action, index) => (
                              <article key={`${action.title}-${index}`} className={`rounded-2xl border p-4 ${severityTone[action.severity] || severityTone.low}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{action.title}</p>
                                  <ActionBadge severity={action.severity} />
                                </div>
                                <p className="mt-2 text-sm opacity-90">{action.description}</p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <EmptyPanel text="No hay acciones pendientes para esta persona con los datos visibles hoy." />
                        )}
                      </SurfaceCard>
                    </div>
                  </div>
                )}
              </SurfaceCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
