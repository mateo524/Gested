import { useEffect, useMemo, useState } from "react";
import useCountUp from "../hooks/useCountUp";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch, apiUrl } from "../lib/api";
import { perfColor, PERF_COLORS, PERF_PALETTE } from "../lib/colors";
import { isAdminOrgUser, isEmployeeUser, isManagerUser, isReadOnlyUser } from "../lib/roleHelpers";
import { useView } from "../context/ViewContext";
import OnboardingChecklist from "../components/OnboardingChecklist";
import TopPerformers from "../components/TopPerformers";
import CollapsibleList from "../components/CollapsibleList";

function getDashboardCacheKey(user, companyId) {
  const role = user?.roleKey || user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
  const scope = companyId || user?.companyId || "global";
  return `pf_dashboard_summary_${role}_${scope}`;
}

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function SurfaceCard({ title, subtitle, children, actions }) {
  return (
    <section className="pf-card-premium p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white/95 tracking-tight">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[#6a8ea0]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STAT_ICONS = {
  teal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  green: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7m10 0v-2a3 3 0 00-3-3H7a3 3 0 00-3 3v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
    </svg>
  ),
  amber: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  ),
  blue: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  ),
};

function StatCard({ label, value, hint, accent = "teal", onClick }) {
  const animated = useCountUp(typeof value === "number" ? value : Number(value));
  const display = Number.isFinite(Number(value)) ? animated : value;

  const styles = {
    green: {
      border: "border-emerald-400/[0.15]",
      bg: "from-emerald-500/[0.08] to-[#0b1c22]",
      shadow: "0 4px 24px rgba(34,197,94,0.08), inset 0 1px 0 rgba(52,211,153,0.07)",
      iconBg: "rgba(52,211,153,0.1)",
      iconColor: "#34d399",
      numColor: "#6ee7b7",
    },
    amber: {
      border: "border-amber-300/[0.18]",
      bg: "from-amber-500/[0.08] to-[#0b1c22]",
      shadow: "0 4px 24px rgba(251,191,36,0.08), inset 0 1px 0 rgba(251,191,36,0.07)",
      iconBg: "rgba(251,191,36,0.1)",
      iconColor: "#fbbf24",
      numColor: "#fcd34d",
    },
    blue: {
      border: "border-sky-400/[0.15]",
      bg: "from-sky-500/[0.07] to-[#0b1c22]",
      shadow: "0 4px 24px rgba(56,189,248,0.07), inset 0 1px 0 rgba(56,189,248,0.06)",
      iconBg: "rgba(56,189,248,0.1)",
      iconColor: "#38bdf8",
      numColor: "#7dd3fc",
    },
    teal: {
      border: "border-[#14b8a6]/[0.2]",
      bg: "from-[#14b8a6]/[0.08] to-[#0b1c22]",
      shadow: "0 4px 24px rgba(20,184,166,0.1), inset 0 1px 0 rgba(20,184,166,0.08)",
      iconBg: "rgba(20,184,166,0.1)",
      iconColor: "#14b8a6",
      numColor: "#2dd4bf",
    },
  };
  const s = styles[accent] || styles.teal;
  const icon = STAT_ICONS[accent] || STAT_ICONS.teal;

  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card-lift group w-full rounded-2xl border bg-gradient-to-br p-4 text-left transition-all ${s.border} ${s.bg} ${onClick ? "cursor-pointer" : ""}`}
      style={{ boxShadow: s.shadow }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-[#7a98a8] uppercase tracking-[.1em]">{label}</p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ background: s.iconBg, color: s.iconColor, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          {icon}
        </span>
      </div>
      <p className="stat-num mt-3 text-[1.75rem] font-bold tracking-tight leading-none" style={{ color: s.numColor }}>{display}</p>
      <p className="mt-1.5 text-[11px] text-[#6a8898]">{hint}</p>
      {onClick ? (
        <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold transition-all" style={{ color: s.iconColor, opacity: 0.7 }}>
          <span>Ver detalle</span>
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5">
            <path d="M2 6h8M6 2l4 4-4 4"/>
          </svg>
        </div>
      ) : null}
    </Tag>
  );
}

function ActionBadge({ priority }) {
  const classes =
    priority === "ALTA"
      ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
      : priority === "MEDIA"
        ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
        : "border-white/10 bg-[#122530] text-[#d6e2e8]";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>{priority}</span>;
}

function EmptyState({ icon, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0a1720] px-6 py-10 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/5 text-[#7a9aaa]">{icon}</div>}
      <p className="text-sm text-[#7a9aaa]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Bone({ className }) {
  return <div className={`skeleton ${className}`} />;
}

function SkeletonCard({ className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0c1e28] animate-pulse ${className}`}>
      <div className="p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-7 w-16 rounded bg-white/10" />
        <div className="h-2 w-32 rounded bg-white/10" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5 }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
      <div className="h-12 border-b border-white/10 bg-white/5 animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.05] animate-pulse">
          <div className="h-8 w-8 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-2 w-1/4 rounded bg-white/[0.07]" />
          </div>
          <div className="h-6 w-16 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Bone className="h-3 w-16" />
            <Bone className="h-8 w-64 md:w-80" />
            <Bone className="h-4 w-72 md:w-96" />
            <Bone className="h-4 w-56" />
          </div>
          <div className="flex gap-3">
            <Bone className="h-11 w-36" />
            <Bone className="h-11 w-40" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <article key={i} className="rounded-3xl border border-white/8 bg-[#0c1e28] p-5 space-y-3">
            <Bone className="h-3 w-24" />
            <Bone className="h-8 w-16" />
            <Bone className="h-3 w-32" />
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="pf-card p-5 md:p-6 space-y-4">
            <div className="space-y-2">
              <Bone className="h-5 w-40" />
              <Bone className="h-3 w-56" />
            </div>
            {[...Array(3)].map((_, j) => (
              <Bone key={j} className="h-16 w-full" />
            ))}
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="pf-card p-5 md:p-6 space-y-4">
            <Bone className="h-5 w-40" />
            {[...Array(3)].map((_, j) => (
              <Bone key={j} className="h-14 w-full" />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}


function useGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

const QUICK_TOOLS = [
  { label: "Nuevo ciclo", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", view: "ciclos", color: "indigo", show: (isEmpleado, isLector) => !isEmpleado && !isLector },
  { label: "Evaluar equipo", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", view: "evaluaciones", color: "teal", show: () => true },
  { label: "Reporte ejecutivo", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", view: "reporte-ejecutivo", color: "sky", show: (isEmpleado) => !isEmpleado },
  { label: "Planes de desarrollo", icon: "M13 10V3L4 14h7v7l9-11h-7z", view: "planes", color: "amber", show: () => true },
  { label: "Importar personas", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12", view: "carga-masiva", color: "violet", show: (isEmpleado, isLector) => !isEmpleado && !isLector },
  { label: "Organigrama", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0", view: "organigrama", color: "rose", show: (isEmpleado) => !isEmpleado },
];

const TOOL_COLORS = {
  teal: "border-[#14b8a6]/25 bg-[#14b8a6]/8 text-[#14b8a6] hover:bg-[#14b8a6]/15",
  indigo: "border-indigo-400/25 bg-indigo-500/8 text-indigo-300 hover:bg-indigo-500/15",
  sky: "border-sky-400/25 bg-sky-500/8 text-sky-300 hover:bg-sky-500/15",
  amber: "border-amber-400/25 bg-amber-500/8 text-amber-300 hover:bg-amber-500/15",
  violet: "border-violet-400/25 bg-violet-500/8 text-violet-300 hover:bg-violet-500/15",
  rose: "border-rose-400/25 bg-rose-500/8 text-rose-300 hover:bg-rose-500/15",
};

function QuickToolsCard({ setView, isEmpleado, isLector, summary }) {
  const pendingEvals = Number(summary?.educational?.pendingEvaluations || 0);
  const activePlans = Number(summary?.educational?.activeUsers || 0);
  const tools = QUICK_TOOLS.filter(t => t.show(isEmpleado, isLector));

  return (
    <section className="pf-card p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Herramientas</h3>
        <p className="mt-0.5 text-xs text-[#7a98a8]">Acceso directo a las funciones principales</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tools.map(t => (
          <button
            key={t.view}
            type="button"
            onClick={() => setView(t.view)}
            className={`card-lift flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-xs font-medium transition ${TOOL_COLORS[t.color]}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
              <path d={t.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {(pendingEvals > 0) && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/8 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">{pendingEvals} evaluaciones pendientes de cierre</p>
          <button type="button" onClick={() => setView("evaluaciones")} className="ml-auto text-[10px] font-semibold text-amber-300 hover:text-amber-100 whitespace-nowrap">Ver →</button>
        </div>
      )}
    </section>
  );
}


export default function DashboardPage() {
  const { token, activeCompanyId, user } = useAuth();
  const { setView } = useView();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadSlow, setLoadSlow] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const greeting = useGreeting();

  const isSuperOrDirector =
    user?.isSuperAdmin ||
    user?.roleKey === "ORG_OWNER" ||
    user?.roleKey === "ORG_ADMIN" ||
    user?.roleCode === "ADMIN_COLEGIO";
  const isRRHH = user?.roleKey === "HR" || user?.roleCode === "RRHH";
  const isJefe = isManagerUser(user);
  const isEmpleado = isEmployeeUser(user);
  const isLector = isReadOnlyUser(user);

  const [reportStats, setReportStats] = useState(null);

  useEffect(() => {
    if (!token) return;
    if (user?.isSuperAdmin && !activeCompanyId) {
      setIsLoading(false);
      return;
    }

    const cacheKey = getDashboardCacheKey(user, activeCompanyId);
    const cachedRaw = sessionStorage.getItem(cacheKey);
    let hasCached = false;
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        const age = Date.now() - (cached.cachedAt || 0);
        if (age < 5 * 60 * 1000 && cached.data) {
          setSummary(cached.data);
          hasCached = true;
          setIsLoading(false);
        } else {
          sessionStorage.removeItem(cacheKey);
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    // Show "slow loading" hint after 7s only if there's no cached data
    let slowTimer;
    if (!hasCached) {
      slowTimer = setTimeout(() => setLoadSlow(true), 7000);
    }

    const controller = new AbortController();
    apiFetch("/dashboard/summary", { token, timeoutMs: 25000, signal: controller.signal })
      .then((summaryData) => {
        setSummary(summaryData);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: summaryData, cachedAt: Date.now() }));
        setMessage("");
        setIsLoading(false);
        setLoadSlow(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(error.message);
        setIsLoading(false);
        setLoadSlow(false);
      });

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [token, activeCompanyId, user, retryCount]);

  useEffect(() => {
    if (!token || isEmpleado || isLector) return;
    if (user?.isSuperAdmin && !activeCompanyId) return;
    apiFetch("/reports/summary", { token })
      .then((data) => { if (data?.ok !== false) setReportStats(data); })
      .catch(() => {});
  }, [token, activeCompanyId, user, isEmpleado, isLector]);

  const training = useMemo(() => {
    const raw = summary?.decisionInsights?.trainingRecommendations;
    return Array.isArray(raw) ? raw : [];
  }, [summary]);
  const alerts = useMemo(() => {
    const items = [];
    if (summary?.alerts?.summary) {
      items.push({
        tone: summary.alerts.isLow ? "warning" : "info",
        title: "Última revisión de calidad",
        detail: summary.alerts.summary,
        meta: summary.alerts.latestQualityRunAt ? formatDate(summary.alerts.latestQualityRunAt) : "",
      });
    }
    const pendingEvaluations = Number(summary?.educational?.pendingEvaluations || 0);
    if (pendingEvaluations > 0) {
      items.push({
        tone: "warning",
        title: `${pendingEvaluations} evaluaciones siguen pendientes`,
        detail: "Conviene cerrar o revisar el avance del ciclo actual.",
      });
    }
    const lowPerformance = Number(summary?.educational?.lowPerformanceCount || 0);
    if (lowPerformance > 0 && !isEmpleado) {
      items.push({
        tone: "info",
        title: `${lowPerformance} personas requieren seguimiento`,
        detail: "Revisa desarrollo y acompañamiento desde una mirada agregada.",
      });
    }
    return items.slice(0, 4);
  }, [summary, isEmpleado]);

  const upcomingMilestones = useMemo(() => {
    const items = [];
    const cycleCount = Number(summary?.cards?.[2]?.value || 0);
    if (cycleCount > 0) {
      items.push({
        title: `${cycleCount} ciclos activos`,
        detail: "Revisar fechas y responsables del ciclo vigente.",
      });
    }
    if (summary?.alerts?.latestQualityRunAt) {
      items.push({
        title: "Seguimiento de calidad de datos",
        detail: `Ultima revision: ${formatDate(summary.alerts.latestQualityRunAt)}`,
      });
    }
    if (training.length) {
      items.push({
        title: `${training.length} focos de desarrollo detectados`,
        detail: "Alinear planes y prioridades para el próximo seguimiento.",
      });
    }
    return items.slice(0, 4);
  }, [summary, training.length]);

  const actionsToday = useMemo(() => {
    const items = [];
    const pendingEvaluations = Number(summary?.educational?.pendingEvaluations || 0);
    const activeUsers = Number(summary?.educational?.activeUsers || 0);
    const lowPerformance = Number(summary?.educational?.lowPerformanceCount || 0);
    const topTraining = training[0];

    if (isSuperOrDirector) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Cerrar ${pendingEvaluations} evaluaciones pendientes`,
          detail: "Deja el ciclo listo para una lectura ejecutiva más clara.",
          actionLabel: "Ir a Evaluaciones",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Revisar el reporte ejecutivo",
        detail: "Consolida personas, resultados y prioridades del período.",
        actionLabel: "Abrir reporte",
        goTo: "reporte-ejecutivo",
      });
      if (activeUsers === 0) {
        items.push({
          priority: "MEDIA",
          title: "Todavía no hay usuarios activos",
          detail: "Activa accesos para acompañar evaluaciones y autoevaluaciones.",
          actionLabel: "Ir a Usuarios",
          goTo: "usuarios",
        });
      }
    } else if (isRRHH) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Finalizar ${pendingEvaluations} evaluaciones`,
          detail: "Así podrás consolidar planes y acciones del equipo.",
          actionLabel: "Ir a Evaluaciones",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Validar próximas importaciones",
        detail: "Importá empleados, usuarios y catálogos con la plantilla oficial.",
        actionLabel: "Ir a Importación",
        goTo: "carga-masiva",
      });
      if (lowPerformance > 0) {
        items.push({
          priority: "MEDIA",
          title: `${lowPerformance} casos para desarrollo`,
          detail: "Priorizá seguimiento y acciones en la vista de desarrollo.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
    } else if (isJefe) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Completar ${pendingEvaluations} evaluaciones del equipo`,
          detail: "Te permite pasar a seguimiento y desarrollo sin fricción.",
          actionLabel: "Ir a Evaluaciones",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Revisar reporte del equipo",
        detail: "Usa el reporte ejecutivo para ver progreso, planes y pendientes.",
        actionLabel: "Abrir reporte",
        goTo: "reporte-ejecutivo",
      });
    } else if (isEmpleado) {
      items.push({
        priority: "MEDIA",
        title: "Completar mi autoevaluación",
        detail: "Ordená tu feedback y tu conversación con jefatura.",
        actionLabel: "Ir a Evaluaciones",
        goTo: "evaluaciones",
      });
      items.push({
        priority: "BAJA",
        title: "Actualizar mi desarrollo",
        detail: "Deja una acción concreta para las próximas semanas.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    } else if (isLector) {
      items.push({
        priority: "MEDIA",
        title: "Revisar reportes visibles",
        detail: "Consulta el estado actual sin modificar configuración ni datos.",
        actionLabel: "Ir a Reportes",
        goTo: "bases-descargas",
      });
    }

    if (!items.length && topTraining) {
      items.push({
        priority: topTraining.priority === "ALTA" ? "ALTA" : "MEDIA",
        title: `Seguir ${topTraining.competencia}`,
        detail: "Es el foco de desarrollo más visible en este momento.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    }

    return items.slice(0, 5);
  }, [summary, training, isSuperOrDirector, isRRHH, isJefe, isEmpleado, isLector]);

  const statCards = useMemo(() => {
    if (!summary) return [];
    const cards = [];

    if (user?.isSuperAdmin && summary.superAdmin) {
      cards.push(
        {
          label: "Organizaciones",
          value: summary.superAdmin.totalCompanies || 0,
          hint: `${summary.superAdmin.activeCompanies || 0} activas`,
          accent: "blue",
          goTo: "organizaciones",
        },
        {
          label: "Evaluaciones pendientes",
          value: summary.educational?.pendingEvaluations || 0,
          hint: `${summary.educational?.evaluationsTotal || 0} registradas`,
          accent: "amber",
          goTo: "evaluaciones",
        }
      );
      return cards;
    }

    cards.push(
      {
        label: "Evaluaciones pendientes",
        value: summary.educational?.pendingEvaluations || 0,
        hint: `${summary.educational?.evaluationsTotal || 0} evaluaciones visibles`,
        accent: "amber",
        goTo: "evaluaciones",
      },
      {
        label: "Planes de desarrollo",
        value: training.length || 0,
        hint: training.length ? "Focos abiertos de seguimiento" : "Todavía sin planes visibles",
        accent: "green",
        goTo: "planes",
      }
    );

    if ((summary.educational?.metricsTotal || 0) > 0) {
      cards.push({
        label: "Mediciones",
        value: summary.educational?.metricsTotal || 0,
        hint: "Métricas configuradas",
        accent: "green",
      });
    }

    return cards;
  }, [summary, training.length, user?.isSuperAdmin, isEmpleado]);

  const quickLinks = useMemo(() => {
    const items = [
      { label: "Personas", view: "empleados", show: !isEmpleado },
      { label: "Importación", view: "carga-masiva", show: !isEmpleado && !isLector },
      { label: "Reporte ejecutivo", view: "reporte-ejecutivo", show: !isEmpleado },
      { label: "Evaluaciones", view: "evaluaciones", show: true },
      { label: "Mediciones", view: "metricas", show: !isEmpleado && !isLector },
    ];
    return items.filter((item) => item.show);
  }, [isEmpleado, isLector]);

  async function downloadDecisionReport() {
    if (isDownloadingReport) return;
    setIsDownloadingReport(true);
    try {
      const response = await fetch(`${apiUrl}/dashboard/decision-report`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
        },
      });
      if (!response.ok) throw new Error("No se pudo descargar el reporte.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "reporte-decisiones.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsDownloadingReport(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="space-y-4">
        <DashboardSkeleton />
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </section>
        <SkeletonTable rows={5} />
        {loadSlow ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 animate-spin">
              <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
            El servidor está iniciando — el primer acceso del día puede tardar hasta 30 segundos.
          </div>
        ) : null}
      </div>
    );
  }

  if (user?.isSuperAdmin && !activeCompanyId && !isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1e28]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white">Bienvenido a Zentor</p>
          <p className="mt-1 max-w-xs text-sm text-[#7a9aaa]">No hay ninguna empresa creada todavía. Creá la primera desde Plataforma.</p>
        </div>
      </div>
    );
  }

  if (!summary && message) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1e28]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7a9aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white">No se pudo cargar el dashboard</p>
          <p className="mt-1 max-w-xs text-sm text-[#7a9aaa]">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => { setMessage(""); setIsLoading(true); setLoadSlow(false); setRetryCount((c) => c + 1); }}
          className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] hover:bg-[#0d9488]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {loadSlow && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 animate-spin">
            <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="10" />
          </svg>
          Actualizando datos — esto puede tardar un momento en organizaciones grandes.
        </div>
      )}
      {/* Header */}
      <div className="rounded-2xl border border-white/[0.07] p-5 md:p-6"
        style={{ background: "linear-gradient(135deg, #132230 0%, #0d1e2b 50%, #091520 100%)", boxShadow: "0 8px 32px rgba(2,8,23,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6] shadow-[0_0_6px_rgba(20,184,166,0.8)]" />
              <p className="text-[10px] uppercase tracking-[.18em] font-semibold text-[#14b8a6]/70">Panel principal</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
              {greeting}{user?.nombre ? `, ${user.nombre}` : ""}
            </h1>
            <p className="mt-1 text-sm text-[#6a8898]">
              {user?.isSuperAdmin ? "Vista general de plataforma" : isEmpleado ? "Tu espacio personal" : isJefe ? "Vista de tu equipo" : "Vista general de la organización"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setView("reporte-ejecutivo")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.07] hover:text-white hover:border-white/20">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-[#14b8a6]">
                <path d="M4 12V7M8 12V4M12 12V9"/>
              </svg>
              Reporte ejecutivo
            </button>
            <button type="button" onClick={downloadDecisionReport} disabled={isDownloadingReport}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60">
              {isDownloadingReport ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 animate-spin">
                  <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M8 3v8M5 8l3 3 3-3M3 13h10"/>
                </svg>
              )}
              {isDownloadingReport ? "Descargando..." : "Descargar resumen"}
            </button>
          </div>
        </div>

        {Array.isArray(quickLinks) && quickLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {quickLinks.map((link) => (
              <button
                key={link.view}
                type="button"
                onClick={() => setView(link.view)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-[#9ab8c8] transition hover:border-[#14b8a6]/30 hover:bg-[#14b8a6]/8 hover:text-[#14b8a6]"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) ? <OnboardingChecklist /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.isArray(statCards) && statCards.length > 0 ? (
          statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint}
              accent={card.accent}
              onClick={card.goTo ? () => setView(card.goTo) : undefined}
            />
          ))
        ) : isLoading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              text="No hay métricas disponibles todavía. Los KPIs aparecerán cuando haya datos en la organización."
            />
          </div>
        )}
      </section>

      {reportStats && !isEmpleado ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total empleados", value: reportStats.stats?.employeesTotal ?? 0, hint: "Registrados en la organización", accent: "blue", goTo: "reporte-ejecutivo" },
              { label: "Evaluados", value: reportStats.stats?.evaluatedCount ?? 0, hint: "Con evaluación cerrada", accent: "teal", goTo: "reporte-ejecutivo" },
              { label: "Promedio general", value: reportStats.stats?.averageScore > 0 ? reportStats.stats.averageScore.toFixed(2) : "—", hint: "Escala 1 – 5", accent: "green", goTo: "reporte-ejecutivo" },
              { label: "Nivel Excepcional", value: reportStats.stats?.scoreExcepcional ?? 0, hint: "Puntaje ≥ 4.5", accent: "green", goTo: "reporte-ejecutivo" },
              { label: "Necesitan atención", value: reportStats.stats?.scoreNeedsAttention ?? 0, hint: "Puntaje < 2.5", accent: "amber", goTo: "reporte-ejecutivo" },
            ].map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} accent={card.accent} onClick={card.goTo ? () => setView(card.goTo) : undefined} />
            ))}
          </div>

          {Array.isArray(reportStats.competencyAverages) && reportStats.competencyAverages.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              <section className="pf-card-premium rounded-2xl p-5">
                <p className="text-sm font-semibold text-white/95">Promedio por competencia</p>
                <p className="mt-0.5 mb-4 text-xs text-[#6a8ea0]">Puntaje promedio sobre el total de evaluaciones cerradas</p>
                <div className="space-y-3">
                  {reportStats.competencyAverages.slice(0, 8).map((c) => (
                    <div key={c.nombre}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-[#c5d5de] truncate max-w-[70%]">{c.nombre}</span>
                        <span className="text-xs font-semibold text-[#2dd4bf]">{c.avg.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#2dd4bf] transition-all"
                          style={{ width: `${(c.avg / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pf-card-premium rounded-2xl p-5">
                <p className="text-sm font-semibold text-white/95">Distribución de puntajes</p>
                <p className="mt-0.5 mb-4 text-xs text-[#6a8ea0]">Cantidad de personas por nivel de desempeño</p>
                {Array.isArray(reportStats.scoreDistribution) && reportStats.scoreDistribution.some((d) => d.count > 0) ? (
                  <div className="flex items-end gap-2 h-28">
                    {reportStats.scoreDistribution.map((d) => {
                      const maxCount = Math.max(...reportStats.scoreDistribution.map((x) => x.count), 1);
                      const heightPct = Math.max(4, (d.count / maxCount) * 100);
                      const color = PERF_PALETTE[d.bucket - 1] || PERF_COLORS.N5;
                      return (
                        <div key={d.bucket} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold text-white/80">{d.count}</span>
                          <div className="w-full rounded-t-lg transition-all" style={{ height: `${heightPct}%`, background: color, opacity: 0.85 }} />
                          <span className="text-[9px] text-[#7a9aaa]">N{d.bucket}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#7a9aaa]">Sin datos de distribución todavía.</p>
                )}
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {reportStats.scoreDistribution.map((d) => (
                    <p key={d.bucket} className="text-center text-[9px] text-[#6a8898] leading-tight">{d.label}</p>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {Array.isArray(reportStats.recentEvaluations) && reportStats.recentEvaluations.length > 0 ? (
            <section className="pf-card-premium rounded-2xl overflow-hidden">
              <div className="p-5 pb-0">
                <p className="text-sm font-semibold text-white/95">Últimas evaluaciones</p>
                <p className="mt-0.5 text-xs text-[#6a8ea0]">Las 12 evaluaciones finales más recientes del período activo</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      {["Persona", "Cargo", "Área", "Puntaje"].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7f99a8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {reportStats.recentEvaluations.map((e, i) => {
                      const score = Number(e.finalScore);
                      const scoreColor = score > 0 ? perfColor(score) : "#7a9aaa";
                      return (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 font-medium text-white/90">{e.employeeName}</td>
                          <td className="px-5 py-3 text-[#9ab8c8]">{e.cargo}</td>
                          <td className="px-5 py-3 text-[#9ab8c8]">{e.area}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: scoreColor, background: `${scoreColor}18` }}>
                              {score > 0 ? score.toFixed(2) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <SurfaceCard title="Próximos hitos" subtitle="Puntos de atención relevantes para el período actual.">
        <div className="space-y-2">
          {Array.isArray(upcomingMilestones) && upcomingMilestones.length > 0 ? (
            upcomingMilestones.map((m, i) => (
              <div
                key={`${m.title}-${i}`}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#0c1e28] px-4 py-3"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#14b8a6]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/90">{m.title}</p>
                  <p className="mt-0.5 text-xs text-[#7a9aaa]">{m.detail}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              text="No hay hitos próximos registrados. Creá un ciclo activo para ver eventos aquí."
            />
          )}
        </div>
      </SurfaceCard>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard
          title="Acciones de hoy"
          subtitle="Tareas concretas según tu rol y el estado actual de la organización."
          actions={
            actionsToday.length ? (
              <button
                type="button"
                onClick={() => setView(actionsToday[0].goTo)}
                className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm text-white"
              >
                Ver primera acción
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            {actionsToday.length ? (
              <CollapsibleList
                items={actionsToday}
                initialCount={3}
                className="space-y-3"
                renderItem={(item, index) => (
                <article key={`${item.title}-${index}`}
                  className="group rounded-2xl border border-white/[0.08] p-4 transition-all hover:border-white/[0.13]"
                  style={{ background: "linear-gradient(135deg, #102030 0%, #0c1c28 100%)", boxShadow: "0 2px 12px rgba(2,8,23,0.3)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white/90 tracking-tight">{item.title}</p>
                    <ActionBadge priority={item.priority} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#8aacbc]">{item.detail}</p>
                  <button
                    type="button"
                    onClick={() => setView(item.goTo)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#c5d5de] transition hover:border-[#14b8a6]/30 hover:bg-[#14b8a6]/8 hover:text-[#14b8a6]"
                  >
                    {item.actionLabel}
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
                  </button>
                </article>
                )}
              />
            ) : (
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                text="Sin acciones pendientes por ahora. Todo está en orden."
              />
            )}
          </div>
        </SurfaceCard>

        <QuickToolsCard setView={setView} isEmpleado={isEmpleado} isLector={isLector} summary={summary} />
      </section>

      {(isSuperOrDirector || isRRHH) && (activeCompanyId || user?.companyId) ? (
        <SurfaceCard title="Top performers" subtitle="Las 5 personas con mayor puntuación en el ciclo vigente.">
          <TopPerformers companyId={activeCompanyId || user?.companyId} />
        </SurfaceCard>
      ) : null}

    </div>
  );
}
