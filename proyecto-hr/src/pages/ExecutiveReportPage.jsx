import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser } from "../lib/roleHelpers";
import CollapsibleList from "../components/CollapsibleList";

function ExecChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/15 bg-[#0b1d27] px-4 py-3 shadow-[0_16px_40px_rgba(2,8,23,0.5)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7a9aaa]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.fill }} />
          <span className="text-[#a8bec9]">{entry.name}:</span>
          <span className="ml-auto pl-4 font-semibold text-white">{typeof entry.value === "number" ? entry.value.toFixed(entry.value % 1 === 0 ? 0 : 2) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

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

function pct(value, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(value) / total) * 100)));
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function SurfaceCard({ title, subtitle, actions, children }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[#7a98a8]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, tone = "default", progress, compact }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-gradient-to-br from-emerald-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(34,197,94,0.08)]"
      : tone === "warning"
        ? "border-amber-300/20 bg-gradient-to-br from-amber-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(251,191,36,0.08)]"
        : tone === "danger"
          ? "border-rose-300/20 bg-gradient-to-br from-rose-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(239,68,68,0.08)]"
          : "border-white/[0.09] bg-gradient-to-b from-[#162c39] to-[#0f2028]";
  return (
    <article className={`rounded-2xl border p-4 ${toneClass} ${compact ? "p-3" : ""}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className={`font-semibold text-white ${compact ? "mt-1 text-xl" : "mt-2 text-2xl"}`}>{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#9ab0bc]">{hint}</p> : null}
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              progress >= 80 ? "bg-emerald-400" : progress >= 50 ? "bg-amber-400" : "bg-rose-400"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
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

function ProgressBar({ value, max = 100, tone, label, showPct }) {
  const pctVal = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const gradient = tone
    ? null
    : pctVal >= 80
      ? "from-emerald-400 to-teal-500"
      : pctVal >= 50
        ? "from-amber-400 to-orange-500"
        : "from-rose-400 to-rose-600";
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[#9fb6c4]">
          <span>{label}</span>
          {showPct ? <span className="font-semibold text-white">{Math.round(pctVal)}%</span> : null}
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${tone || `bg-gradient-to-r ${gradient}`}`}
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  );
}

function MiniBarChart({ title, items, emptyText = "Sin datos para mostrar." }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 0);
  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-4">
        {items.some((item) => Number(item.value || 0) > 0) ? (
          items.map((item) => {
            const pct = maxValue > 0 ? Math.max(4, Math.round((Number(item.value || 0) / maxValue) * 100)) : 0;
            return (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[#9fb6c4]">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-white">{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${item.tone || "bg-gradient-to-r from-[#14b8a6] to-[#38bdf8]"}`}
                    style={{ width: `${pct}%` }}
                  />
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

function MiniDonut({ value, total, label, gradientId, colorStart = "#14b8a6", colorEnd = "#38bdf8", size = 72 }) {
  const safeTotal = Math.max(1, total);
  const pctVal = Math.min(100, Math.max(0, (value / safeTotal) * 100));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pctVal / 100) * circumference;
  const gId = gradientId || `donutGrad-${label}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 48 48" className="-rotate-90">
          <defs>
            <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colorStart} />
              <stop offset="100%" stopColor={colorEnd} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4.5" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={`url(#${gId})`}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">{Math.round(pctVal)}%</span>
        </div>
      </div>
      <span className="text-center text-xs leading-tight text-[#9fb6c4]">{label}</span>
    </div>
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

function buildMetricSignalRows(metricSignals = []) {
  return metricSignals
    .slice()
    .sort((left, right) => Number(right.averageScore || 0) - Number(left.averageScore || 0))
    .slice(0, 8)
    .map((item) => ({
      label: item.competencyName || item.metricName || "Competencia",
      value: Number(item.averageScore || 0),
      scoreCount: item.scoreCount,
      tone: "bg-sky-400",
    }));
}

function KpiCard({ item }) {
  const progress = item.targetValue > 0 ? pct(item.currentValue, item.targetValue) : 0;
  const tone = progress >= 80 ? "bg-emerald-500/10 border-emerald-300/20" :
    progress >= 50 ? "bg-amber-500/10 border-amber-300/20" :
    "bg-rose-500/10 border-rose-300/20";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white leading-snug">{item.name}</p>
        <span className="whitespace-nowrap rounded-full border border-white/10 bg-[#122530] px-2 py-0.5 text-[10px] text-[#d8e4ea]">{item.status || "activo"}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white">{safeNum(item.currentValue, "-")}</span>
        <span className="text-sm text-[#9fb6c4]">/ {safeNum(item.targetValue, "-")} {item.unit || ""}</span>
      </div>
      <ProgressBar value={progress} />
    </article>
  );
}

function OkrCard({ item }) {
  const progress = item.targetValue > 0 ? pct(item.currentValue, item.targetValue) : 0;
  const tone = progress >= 80 ? "bg-emerald-500/10 border-emerald-300/20" :
    progress >= 50 ? "bg-amber-500/10 border-amber-300/20" :
    "bg-rose-500/10 border-rose-300/20";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">{item.objectiveTitle}</p>
      <p className="mt-1 text-sm font-semibold text-white leading-snug">{item.keyResultTitle}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-white">{safeNum(item.currentValue, "-")}</span>
        <span className="text-xs text-[#9fb6c4]">/ {safeNum(item.targetValue, "-")}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${progress >= 80 ? "bg-emerald-400" : progress >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
    </article>
  );
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

  const kpiOkrGrouped = useMemo(() => {
    const kpiS = overview?.kpis?.summaryByStatus || {};
    const okrS = overview?.okrs?.summaryByStatus || {};
    return [
      { label: "Cumplidos", kpi: Number(kpiS.completed || 0), okr: Number(okrS.completed || 0) },
      { label: "En curso", kpi: Number(kpiS.inProgress || 0), okr: Number(okrS.inProgress || 0) },
      { label: "En riesgo", kpi: Number(kpiS.atRisk || 0), okr: Number(okrS.atRisk || 0) },
      { label: "Sin datos", kpi: Number(kpiS.noData || 0), okr: Number(okrS.noData || 0) },
    ];
  }, [overview]);

  const evaluationCoverage = useMemo(() => {
    const total = Number(overview?.summary?.evaluationsTotal || 0);
    const completed = Number(overview?.summary?.completedEvaluations || 0);
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [overview]);

  const priorityEmployees = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    return items
      .filter((employee) => employee.needsAttention)
      .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
  }, [overview]);

  const departmentScores = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    const groups = {};
    items.forEach((employee) => {
      const area = employee.area || "Sin \u00e1rea";
      if (!groups[area]) groups[area] = { scores: [], count: 0 };
      if (employee.averageScore > 0) groups[area].scores.push(employee.averageScore);
      groups[area].count++;
    });
    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        count: data.count,
        averageScore: data.scores.length
          ? data.scores.reduce((sum, v) => sum + v, 0) / data.scores.length
          : 0,
      }))
      .sort((a, b) => a.averageScore - b.averageScore);
  }, [overview]);

  const topPerformers = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    return items
      .filter((employee) => employee.averageScore > 0)
      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
      .slice(0, 3);
  }, [overview]);

  const individualEvaluationChart = useMemo(
    () => buildEvaluationTypeChart(detail?.evaluations || []),
    [detail?.evaluations]
  );

  const individualMetricSignalChart = useMemo(
    () => buildMetricSignalRows(detail?.metricSignals || []),
    [detail?.metricSignals]
  );

  const execSummaryLines = useMemo(() => {
    if (!overview) return [];
    const avg = overview.summary?.averageScore || 0;
    const total = overview.summary?.employeesTotal || 0;
    const pending = overview.summary?.evaluationsPending || 0;
    const coverage = evaluationCoverage.pct;
    const atRisk = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);
    const overdue = overview.development?.overdue || 0;
    const needsAttention = priorityEmployees.length;
    const lines = [];

    if (avg >= 4) {
      lines.push(`El equipo muestra un desempeño sólido: promedio de ${avg.toFixed(2)} sobre 5.${total > 0 ? ` Hay ${total.toLocaleString("es-AR")} personas en el alcance actual.` : ""}`);
    } else if (avg >= 3) {
      lines.push(`El desempeño promedio del equipo es ${avg.toFixed(2)} sobre 5${total > 0 ? ` en ${total.toLocaleString("es-AR")} personas` : ""}, con espacio de mejora identificado.`);
    } else if (avg > 0) {
      lines.push(`El promedio de desempeño es ${avg.toFixed(2)} sobre 5. Se recomienda revisar los planes de acción en las áreas con menor puntaje.`);
    } else if (total > 0) {
      lines.push(`Hay ${total.toLocaleString("es-AR")} personas en el alcance. Todavía no hay suficientes datos de desempeño para calcular un promedio.`);
    }

    if (pending > 0 && evaluationCoverage.total > 0) {
      lines.push(`Cobertura de evaluaciones: ${coverage}% completada. Quedan ${pending.toLocaleString("es-AR")} evaluaciones sin cerrar en este período.`);
    } else if (coverage >= 80 && evaluationCoverage.total > 0) {
      lines.push(`La cobertura de evaluaciones está en ${coverage}%, indicando seguimiento activo del ciclo.`);
    }

    const alerts = [];
    if (needsAttention > 0) alerts.push(`${needsAttention} ${needsAttention === 1 ? "persona requiere" : "personas requieren"} atención prioritaria`);
    if (atRisk > 0) alerts.push(`${atRisk} KPI/OKR en riesgo`);
    if (overdue > 0) alerts.push(`${overdue} ${overdue === 1 ? "plan con seguimiento vencido" : "planes con seguimiento vencido"}`);
    if (alerts.length) {
      lines.push(`Puntos de seguimiento: ${alerts.join(" · ")}.`);
    } else if (avg >= 4 && coverage >= 80) {
      lines.push("No se detectan alertas críticas en el alcance actual.");
    }

    return lines;
  }, [overview, evaluationCoverage, priorityEmployees]);

  const execSignals = useMemo(() => {
    if (!overview) return [];
    const avg = overview.summary?.averageScore || 0;
    const coverage = evaluationCoverage.pct;
    const atRiskTotal = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);
    const alertCount = priorityEmployees.length + atRiskTotal + (overview.development?.overdue || 0);
    return [
      {
        label: "Promedio de equipo",
        value: avg > 0 ? avg.toFixed(2) : "—",
        hint: "Escala 1 – 5",
        tone: avg >= 4 ? "success" : avg >= 3 ? "warning" : avg > 0 ? "danger" : "default",
      },
      {
        label: "Cobertura evaluaciones",
        value: `${coverage}%`,
        hint: `${evaluationCoverage.completed} de ${evaluationCoverage.total} completadas`,
        tone: coverage >= 80 ? "success" : coverage >= 50 ? "warning" : "danger",
      },
      {
        label: "Alertas activas",
        value: alertCount.toLocaleString("es-AR"),
        hint: `${priorityEmployees.length} personas · ${atRiskTotal} obj. en riesgo`,
        tone: alertCount === 0 ? "success" : alertCount <= 3 ? "warning" : "danger",
      },
      {
        label: "Planes en curso",
        value: (overview.development?.active || 0).toLocaleString("es-AR"),
        hint: `${(overview.development?.overdue || 0).toLocaleString("es-AR")} vencidos`,
        tone: (overview.development?.overdue || 0) > 0 ? "warning" : "default",
      },
    ];
  }, [overview, evaluationCoverage, priorityEmployees]);

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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white">Reporte ejecutivo</h1>
              {overview?.selectedCycle ? (
                <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                  {overview.selectedCycle.label}
                  {overview.selectedCycle.estado ? ` · ${overview.selectedCycle.estado}` : ""}
                </span>
              ) : null}
              {overview?.summary?.employeesTotal > 0 ? (
                <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                  {overview.summary.employeesTotal.toLocaleString("es-AR")} personas
                </span>
              ) : null}
            </div>
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
                  ? "bg-[#14b8a6] text-[#0f172a] shadow-[0_12px_30px_rgba(20,184,166,0.22)]"
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
              className="w-full rounded-2xl bg-[#14b8a6] px-4 py-3 text-sm font-semibold text-[#0f172a]"
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
        <div className="space-y-3">
          {/* Executive summary */}
          {overview ? (
            <SurfaceCard
              title="Resumen ejecutivo"
              subtitle={`Síntesis generada a partir de los datos del período visible.`}
              actions={
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5 no-print"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#7a9aaa]">
                    <path d="M6 9V2h12v7" />
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                    <path d="M6 14h12v8H6z" />
                  </svg>
                  Imprimir / PDF
                </button>
              }
            >
              <div className="space-y-2">
                {execSummaryLines.length ? (
                  execSummaryLines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[#c5d5de]">{line}</p>
                  ))
                ) : (
                  <p className="text-sm text-[#8fa9b7]">Actualizá el reporte para ver el resumen ejecutivo.</p>
                )}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {execSignals.map((signal) => {
                  const toneClass =
                    signal.tone === "success" ? "border-emerald-300/20 bg-gradient-to-br from-emerald-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(34,197,94,0.08)]"
                    : signal.tone === "warning" ? "border-amber-300/20 bg-gradient-to-br from-amber-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(251,191,36,0.08)]"
                    : signal.tone === "danger" ? "border-rose-300/20 bg-gradient-to-br from-rose-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(239,68,68,0.08)]"
                    : "border-white/[0.09] bg-gradient-to-b from-[#162c39] to-[#0f2028]";
                  return (
                    <div key={signal.label} className={`rounded-2xl border p-4 ${toneClass}`}>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#7f99a8]">{signal.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{signal.value}</p>
                      <p className="mt-1 text-xs text-[#9fb6c4]">{signal.hint}</p>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          ) : null}

          {/* Top stat cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Personas visibles"
              value={(overview.summary?.employeesTotal || 0).toLocaleString("es-AR")}
              hint="Dentro del alcance actual"
            />
            <StatCard
              label="Desempeño promedio"
              value={(overview.summary?.averageScore || 0).toFixed(2)}
              hint="Sobre 5.0"
              tone={overview.summary?.averageScore >= 4 ? "success" : overview.summary?.averageScore >= 3 ? "warning" : "danger"}
            />
            <StatCard
              label="Evaluaciones pendientes"
              value={(overview.summary?.evaluationsPending || 0).toLocaleString("es-AR")}
              hint={overview.summary?.evaluationsTotal > 0 ? `${evaluationCoverage.pct}% completadas` : "Sin datos"}
              tone={overview.summary?.evaluationsPending > 0 ? "warning" : "success"}
              progress={evaluationCoverage.pct}
            />
            <StatCard
              label="KPIs/OKRs en riesgo"
              value={(safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0)).toLocaleString("es-AR")}
              hint={`${safeNum(overview?.kpis?.total, 0).toLocaleString("es-AR")} KPIs · ${safeNum(overview?.okrs?.total, 0).toLocaleString("es-AR")} OKRs`}
              tone={safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0) > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Planes activos"
              value={(overview.development?.active || 0).toLocaleString("es-AR")}
              hint={`${(overview.development?.overdue || 0).toLocaleString("es-AR")} vencidos · ${(overview.development?.completed || 0).toLocaleString("es-AR")} completados`}
              tone={overview.development?.overdue > 0 ? "warning" : "default"}
            />
          </div>

          {/* Coaching signals: priority people + top performers + dept pulse */}
          {priorityEmployees.length > 0 || topPerformers.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
              {priorityEmployees.length > 0 ? (
                <SurfaceCard title="Personas que necesitan atenci\u00f3n" subtitle="Ordenadas por puntaje m\u00e1s bajo. Estas personas se beneficiar\u00edan de una conversaci\u00f3n pronto.">
                  <div className="grid gap-2">
                    {priorityEmployees.slice(0, 6).map((employee) => (
                      <article key={employee._id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-500/5 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{employee.fullName}</p>
                          <p className="text-xs text-[#9fb6c4] truncate">{employee.area || "Sin \u00e1rea"} \u00b7 {employee.cargo || "Sin cargo"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {employee.pendingEvaluations > 0 ? (
                            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">{employee.pendingEvaluations} eval. pend.</span>
                          ) : null}
                          {employee.overduePlans > 0 ? (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">{employee.overduePlans} planes venc.</span>
                          ) : null}
                          {employee.averageScore > 0 ? (
                            <span className={`text-xs font-semibold ${employee.averageScore >= 4 ? "text-emerald-300" : employee.averageScore >= 3 ? "text-amber-300" : "text-rose-300"}`}>
                              {employee.averageScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-[#7f99a8]">Sin score</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </SurfaceCard>
              ) : null}

              <div className="space-y-5">
                {topPerformers.length > 0 ? (
                  <SurfaceCard title="Mejores puntajes" subtitle="Personas con desempe\u00f1o destacado en el per\u00edodo visible.">
                    <div className="space-y-2">
                      {topPerformers.map((employee, index) => (
                        <div key={employee._id} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-500/5 px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="shrink-0 text-lg font-bold text-emerald-300">#{index + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{employee.fullName}</p>
                              <p className="text-xs text-[#9fb6c4] truncate">{employee.area || "Sin \u00e1rea"}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-white">{employee.averageScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                ) : null}

                {departmentScores.length > 1 && departmentScores.some((d) => d.averageScore > 0) ? (
                  <SurfaceCard title="Rendimiento por \u00e1rea" subtitle="Promedio visible por equipo, ordenado de menor a mayor.">
                    <div className="space-y-2">
                      {departmentScores.filter((d) => d.averageScore > 0).slice(0, 5).map((dept) => (
                        <div key={dept.name} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-xs text-[#9fb6c4]">{dept.name}</span>
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${dept.averageScore >= 4 ? "bg-emerald-400" : dept.averageScore >= 3 ? "bg-amber-400" : "bg-rose-400"}`}
                              style={{ width: `${(dept.averageScore / 5) * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-semibold text-white">{dept.averageScore.toFixed(1)}</span>
                          <span className="w-8 text-right text-[10px] text-[#7f99a8]">{dept.count}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Acciones compactas */}
          {overviewActions.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-5 py-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-sm font-semibold text-white">Acciones recomendadas</p>
                <div className="flex gap-2">
                  <span className="rounded-full border border-rose-300/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-200">Alta {actionPrioritySummary.high}</span>
                  <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200">Media {actionPrioritySummary.medium}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[#c5d5de]">Baja {actionPrioritySummary.low}</span>
                </div>
              </div>
              <div className="space-y-2">
                {overviewActions.slice(0, 4).map((action, index) => {
                  const destination = mapActionDestination(action);
                  return (
                    <div key={`${action.key || action.title}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0c1e28] px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ActionBadge severity={action.severity} />
                        <p className="text-sm text-white truncate">{action.title}</p>
                      </div>
                      {destination ? (
                        <button type="button" onClick={() => setView(destination)} className="shrink-0 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-[#c5d5de] hover:bg-white/5 transition">
                          Ir
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Progress charts */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <MiniBarChart title="Estado de evaluaciones" items={evaluationChart} emptyText="No hay evaluaciones visibles." />

            <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-white">Planes de desarrollo</p>
              {Number(overview.development?.total) > 0 ? (
                <>
                  <div className="mt-4 flex items-center justify-around">
                    <MiniDonut value={overview.development?.completed || 0} total={overview.development?.total} label="Completados" gradientId="donut-completed" colorStart="#14b8a6" colorEnd="#34d399" />
                    <MiniDonut value={overview.development?.active || 0} total={overview.development?.total} label="Activos" gradientId="donut-active" colorStart="#38bdf8" colorEnd="#818cf8" />
                    <MiniDonut value={overview.development?.overdue || 0} total={overview.development?.total} label="Vencidos" gradientId="donut-overdue" colorStart="#fb7185" colorEnd="#f43f5e" />
                  </div>
                  <div className="mt-4 text-center text-sm text-[#9fb6c4]">
                    {overview.development?.total} planes en total
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-[#8fa9b7]">No hay planes de desarrollo visibles.</p>
              )}
            </article>

            <article className="col-span-full rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
              <p className="text-sm font-semibold text-white">KPIs y OKRs por estado</p>
              <p className="mt-0.5 text-xs text-[#7a9aaa]">Comparación directa entre objetivos y métricas clave.</p>
              {kpiOkrGrouped.some((r) => r.kpi > 0 || r.okr > 0) ? (
                <div className="mt-4 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpiOkrGrouped} barCategoryGap="30%" barGap={4}>
                      <defs>
                        <linearGradient id="gradKpi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity={0.55} />
                        </linearGradient>
                        <linearGradient id="gradOkr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8fa9b7" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#8fa9b7" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                      <Tooltip content={<ExecChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)", radius: 6 }} />
                      <Bar dataKey="kpi" name="KPIs" fill="url(#gradKpi)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                      <Bar dataKey="okr" name="OKRs" fill="url(#gradOkr)" radius={[5, 5, 0, 0]} maxBarSize={38} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#8fa9b7]">No hay KPIs ni OKRs con datos visibles.</p>
              )}
              <div className="mt-3 flex gap-5">
                <div className="flex items-center gap-1.5 text-xs text-[#8fa9b7]">
                  <span className="h-2 w-4 rounded-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488]" />
                  KPIs
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#8fa9b7]">
                  <span className="h-2 w-4 rounded-full bg-gradient-to-r from-[#a78bfa] to-[#7c3aed]" />
                  OKRs
                </div>
              </div>
            </article>
          </div>

          {/* Department average score chart */}
          {departmentScores.length > 0 && departmentScores.some((d) => d.averageScore > 0) ? (
            <SurfaceCard title="Puntaje promedio por área" subtitle="Ordenado de menor a mayor. Escala 0–5.">
              <div style={{ height: Math.max(180, departmentScores.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentScores} layout="vertical" barCategoryGap="22%">
                    <defs>
                      <linearGradient id="gradDeptScore" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "#8fa9b7" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#8fa9b7" }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<ExecChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 }} />
                    <Bar dataKey="averageScore" name="Puntaje promedio" fill="url(#gradDeptScore)" radius={[0, 5, 5, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SurfaceCard>
          ) : null}

          {/* Department distribution */}
          <SurfaceCard title="Distribución por departamento / equipo" subtitle="Cómo se reparte el seguimiento entre áreas visibles.">
            {overview?.departments?.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                {overview.departments.map((item) => {
                  const deptEmployeeCount = item.employees || item.count || 0;
                  const maxEmployeeCount = Math.max(...overview.departments.map((d) => d.employees || d.count || 0), 1);
                  const deptWidth = Math.max(8, Math.round((deptEmployeeCount / maxEmployeeCount) * 100));
                  return (
                    <article key={item.code} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-white">{item.label}</p>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-sky-400" style={{ width: `${deptWidth}%` }} />
                          </div>
                        </div>
                        <span className="whitespace-nowrap rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                          {deptEmployeeCount} personas
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
                  );
                })}
              </div>
            ) : (
              <EmptyPanel text="No hay departamentos con datos suficientes para resumir." />
            )}
          </SurfaceCard>

          {/* Employee list */}
          <SurfaceCard title="Personas visibles" subtitle="Desde acá podés saltar directo al reporte individual de cada persona.">
            {employees.length ? (
              <CollapsibleList
                items={employees}
                initialCount={5}
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-2"
                renderItem={(employee) => (
                  <article
                    key={employee._id}
                    className={`cursor-pointer rounded-3xl border p-4 transition hover:brightness-110 ${employee.needsAttention ? "border-amber-300/20 bg-amber-500/5" : "border-white/10 bg-[#0f1f28]"}`}
                    onClick={() => focusEmployeeDetail(employee._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") focusEmployeeDetail(employee._id); }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white truncate">{employee.fullName}</p>
                          {employee.needsAttention ? (
                            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-200">Atención</span>
                          ) : null}
                          {employee.hasManager ? null : (
                            <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-200">Sin manager</span>
                          )}
                        </div>
                        <p className="text-xs text-[#8FA9B7] truncate">{employee.cargo || "Sin cargo"}</p>
                        <p className="text-xs text-[#6a8a9a] truncate">{employee.area || "Sin área"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs shrink-0">
                        <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                          Eval: {employee.evaluationCount}
                        </span>
                        <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                          Planes: {employee.planCount}
                        </span>
                      </div>
                    </div>
                    {employee.averageScore > 0 ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-[#9fb6c4]">Promedio</span>
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${employee.averageScore >= 4 ? "bg-emerald-400" : employee.averageScore >= 3 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${(employee.averageScore / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-white">{employee.averageScore.toFixed(1)}</span>
                      </div>
                    ) : null}
                  </article>
                )}
              />
            ) : (
              <EmptyPanel text="No hay personas visibles para los filtros seleccionados." />
            )}
          </SurfaceCard>
        </div>
      ) : (
        <div className="space-y-3">
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
                  className="w-full rounded-2xl bg-[#14b8a6] px-4 py-3 text-sm font-semibold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ver detalle
                </button>
              </div>
            </div>
          </SurfaceCard>

          {!selectedEmployeeId ? (
            <EmptyPanel text="Elegí una persona para ver su reporte individual." />
          ) : (
            <div ref={detailRef} className="space-y-3">
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
                      className="rounded-2xl bg-[#14b8a6] px-3 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
                    >
                      Evaluaciones
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("planes")}
                      className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5"
                    >
                      Desarrollo
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
                    {/* Summary stat cards */}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Evaluaciones" value={detail.summary?.evaluationCount || 0} />
                      <StatCard
                        label="Pendientes"
                        value={detail.summary?.pendingEvaluations || 0}
                        tone={detail.summary?.pendingEvaluations > 0 ? "warning" : "success"}
                      />
                      <StatCard
                        label="Promedio"
                        value={detail.summary?.averageScore || 0}
                        tone={detail.summary?.averageScore >= 4 ? "success" : detail.summary?.averageScore >= 3 ? "warning" : "danger"}
                        progress={detail.summary?.averageScore > 0 ? (detail.summary.averageScore / 5) * 100 : 0}
                      />
                      <StatCard label="Planes abiertos" value={detail.summary?.openPlans || 0} hint={`${detail.summary?.overduePlans || 0} vencidos`} />
                    </div>

                    {/* Person info */}
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

                    {/* Charts: Competency + Auto vs Manager */}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
                    </div>

                    {/* KPI / OKR cards */}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                      <SurfaceCard title="KPIs asignados" subtitle="Indicadores medibles y avance contra metas.">
                        {detail.kpis?.items?.length ? (
                          <div className="grid gap-3">
                            <CollapsibleList
                              items={detail.kpis.items}
                              initialCount={2}
                              className="grid gap-3"
                              buttonLabelMore={`Ver más KPIs (+${(detail.kpis.items.length - 2)})`}
                              renderItem={(item) => <KpiCard item={item} />}
                            />
                          </div>
                        ) : (
                          <EmptyPanel text={detail.kpis?.message || "No hay KPIs visibles para esta persona."} />
                        )}
                      </SurfaceCard>

                      <SurfaceCard title="OKRs asignados" subtitle="Objetivos y resultados clave.">
                        {detail.okrs?.items?.length ? (
                          <div className="grid gap-3">
                            <CollapsibleList
                              items={detail.okrs.items}
                              initialCount={2}
                              className="grid gap-3"
                              buttonLabelMore={`Ver más OKRs (+${(detail.okrs.items.length - 2)})`}
                              renderItem={(item) => <OkrCard item={item} />}
                            />
                          </div>
                        ) : (
                          <EmptyPanel text={detail.okrs?.message || "No hay OKRs visibles para esta persona."} />
                        )}
                      </SurfaceCard>
                    </div>

                    {/* Evaluations + Development plans */}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                      <SurfaceCard title="Evaluaciones" subtitle="Autoevaluación, evaluación superior y cierre final cuando existan.">
                        {detail.evaluations?.length ? (
                          <CollapsibleList
                            items={detail.evaluations}
                            initialCount={3}
                            className="space-y-3"
                            renderItem={(evaluation) => (
                              <article key={evaluation._id} className={`rounded-2xl border p-4 ${
                                evaluation.estado === "CERRADA" || evaluation.estado === "REVISADA"
                                  ? "border-emerald-300/20 bg-emerald-500/5"
                                  : "border-amber-300/20 bg-amber-500/5"
                              }`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-white">{evaluation.tipo}</p>
                                    <p className="mt-1 text-sm text-[#8FA9B7]">
                                      {evaluation.cycle?.label || "Sin ciclo"} · {formatDate(evaluation.createdAt)}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    <span className={`rounded-full border px-3 py-1 ${
                                      evaluation.estado === "CERRADA" || evaluation.estado === "REVISADA"
                                        ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                        : "border-amber-300/30 bg-amber-500/10 text-amber-100"
                                    }`}>{evaluation.estado}</span>
                                    <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                                      {evaluation.resultadoFinal || 0}/5
                                    </span>
                                  </div>
                                </div>
                                {evaluation.comentariosGenerales ? (
                                  <p className="mt-3 text-sm text-[#c8d8df]">{evaluation.comentariosGenerales}</p>
                                ) : null}
                              </article>
                            )}
                          />
                        ) : (
                          <EmptyPanel text="No hay evaluaciones visibles para esta persona." />
                        )}
                      </SurfaceCard>

                      <SurfaceCard title="Plan de desarrollo" subtitle="Planes activos, vencidos o completados para esta persona.">
                        {detail.developmentPlans?.length ? (
                          <div className="space-y-3">
                            <CollapsibleList
                              items={detail.developmentPlans || []}
                              initialCount={3}
                              buttonLabelMore={`Ver más (${(detail.developmentPlans?.length || 0) - 3})`}
                              renderItem={(plan) => (
                                <article key={plan._id} className={`rounded-2xl border p-4 ${
                                  plan.estado === "CERRADO"
                                    ? "border-emerald-300/20 bg-emerald-500/5"
                                    : plan.estado === "EN_CURSO"
                                      ? "border-sky-300/20 bg-sky-500/5"
                                      : "border-white/10 bg-[#0f1f28]"
                                }`}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-white">{plan.aspectoDesarrollar}</p>
                                      <p className="mt-1 text-sm text-[#8FA9B7]">
                                        Seguimiento {formatDate(plan.fechaSeguimiento)} · creado {formatDate(plan.createdAt)}
                                      </p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                      plan.estado === "CERRADO"
                                        ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                        : plan.estado === "EN_CURSO"
                                          ? "border-sky-300/30 bg-sky-500/10 text-sky-100"
                                          : "border-white/10 bg-[#122530] text-[#d8e4ea]"
                                    }`}>{plan.estado}</span>
                                  </div>
                                  {plan.fortalezas?.length ? (
                                    <p className="mt-3 text-sm text-[#c8d8df]">Fortalezas: {plan.fortalezas.join(", ")}</p>
                                  ) : null}
                                  {plan.medicion ? <p className="mt-2 text-sm text-[#c8d8df]">Medición: {plan.medicion}</p> : null}
                                </article>
                              )}
                            />
                          </div>
                        ) : (
                          <EmptyPanel text="No hay planes de desarrollo visibles para esta persona." />
                        )}
                      </SurfaceCard>
                    </div>

                    {/* Actions */}
                    <SurfaceCard title="Acciones pendientes" subtitle="Qué conviene atender ahora según lo visible en el reporte individual.">
                      {detail.actions?.length ? (
                        <div className="space-y-3">
                          <CollapsibleList
                            items={detail.actions || []}
                            initialCount={3}
                            buttonLabelMore={`Ver más (${(detail.actions?.length || 0) - 3})`}
                            renderItem={(action, index) => (
                              <article key={`${action.title}-${index}`} className={`rounded-2xl border p-4 ${severityTone[action.severity] || severityTone.low}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{action.title}</p>
                                  <ActionBadge severity={action.severity} />
                                </div>
                                <p className="mt-2 text-sm opacity-90">{action.description}</p>
                              </article>
                            )}
                          />
                        </div>
                      ) : (
                        <EmptyPanel text="No hay acciones pendientes para esta persona con los datos visibles hoy." />
                      )}
                    </SurfaceCard>
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
