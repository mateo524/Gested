import { useEffect, useMemo, useState } from "react";
import useCountUp from "../hooks/useCountUp";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import { isAdminOrgUser, isEmployeeUser, isManagerUser, isReadOnlyUser } from "../lib/roleHelpers";
import { useView } from "../context/ViewContext";
import OnboardingChecklist from "../components/OnboardingChecklist";
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

function StatCard({ label, value, hint, accent = "teal", onClick }) {
  const animated = useCountUp(typeof value === "number" ? value : Number(value));
  const display = Number.isFinite(Number(value)) ? animated : value;

  const accentClass =
    accent === "green"
      ? "from-emerald-500/10 to-[#0c1920] border-emerald-400/15 shadow-[0_4px_20px_rgba(34,197,94,0.07)]"
      : accent === "amber"
        ? "from-amber-500/10 to-[#0c1920] border-amber-300/15 shadow-[0_4px_20px_rgba(251,191,36,0.07)]"
        : "from-[#14b8a6]/10 to-[#0c1920] border-[#14b8a6]/20 shadow-[0_4px_20px_rgba(20,184,166,0.09)]";

  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card-lift w-full rounded-2xl border bg-gradient-to-br p-4 text-left ${accentClass} ${onClick ? "cursor-pointer ring-inset hover:ring-1 hover:ring-white/15" : ""}`}
    >
      <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">{label}</p>
      <p className="stat-num mt-2 text-2xl font-bold tracking-tight text-white">{display}</p>
      <p className="mt-1 text-[11px] text-[#7a98a8]">{hint}</p>
      {onClick ? (
        <p className="mt-2 text-[10px] text-[#14b8a6] font-medium tracking-wide">Ver →</p>
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

function EmptyState({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#8ea5b3]">{text}</div>;
}

function Bone({ className }) {
  return <div className={`skeleton ${className}`} />;
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

const DEMO_STEPS = [
  { num: 1, label: "Importar personas", desc: "Cargá empleados con la plantilla Excel oficial.", view: "carga-masiva", icon: "M12 4v16M4 12h16" },
  { num: 2, label: "Crear ciclo", desc: "Definí el período y las fechas del proceso de evaluación.", view: "ciclos", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { num: 3, label: "Lanzar evaluaciones", desc: "Iniciá autoevaluaciones y evaluaciones de jefatura.", view: "evaluaciones", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { num: 4, label: "Ver métricas", desc: "Revisá KPIs, OKRs y resultados por persona.", view: "metricas", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { num: 5, label: "Planes de desarrollo", desc: "Asigná acciones concretas basadas en los resultados.", view: "planes", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { num: 6, label: "Reporte ejecutivo", desc: "Presentá resultados y tendencias a dirección.", view: "reporte-ejecutivo", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

function DemoTourCard({ setView }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#8B5CF6]">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-white">Recorrido guiado</h3>
            <p className="text-xs text-[#7a9aaa]">Flujo recomendado para una demo o piloto</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5"
        >
          {open ? "Ocultar" : "Ver recorrido"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_STEPS.map((step) => (
            <button
              key={step.num}
              type="button"
              onClick={() => setView(step.view)}
              className="card-lift group flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0c1e28] p-4 text-left hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-xs font-bold text-[#8B5CF6]">
                {step.num}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-[#c4b5fd]">{step.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#7a9aaa]">{step.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function useGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardPage() {
  const { token, activeCompanyId, user } = useAuth();
  const { setView } = useView();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadSlow, setLoadSlow] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
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

  useEffect(() => {
    if (!token) return;

    const cacheKey = getDashboardCacheKey(user, activeCompanyId);
    const cachedSummary = sessionStorage.getItem(cacheKey);
    let hasCached = false;
    if (cachedSummary) {
      try {
        setSummary(JSON.parse(cachedSummary));
        hasCached = true;
        setIsLoading(false);
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
        sessionStorage.setItem(cacheKey, JSON.stringify(summaryData));
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
  }, [token, activeCompanyId, user]);

  const training = useMemo(() => summary?.decisionInsights?.trainingRecommendations || [], [summary]);
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
          label: "Empleados visibles",
          value: summary.cards?.[0]?.value || 0,
          hint: "Dentro de la organización activa",
          accent: "green",
          goTo: "empleados",
        },
        {
          label: "Evaluaciones pendientes",
          value: summary.educational?.pendingEvaluations || 0,
          hint: `${summary.educational?.evaluationsTotal || 0} registradas`,
          accent: "amber",
          goTo: "evaluaciones",
        },
        {
          label: "Ciclos activos",
          value: summary.cards?.[2]?.value || 0,
          hint: "Estado actual del período",
          accent: "blue",
          goTo: "ciclos",
        }
      );
      return cards;
    }

    cards.push(
      {
        label: isEmpleado ? "Mi desempeño actual" : "Empleados activos",
        value: isEmpleado ? summary.cards?.[3]?.value || "0.00" : summary.cards?.[0]?.value || 0,
        hint: isEmpleado ? summary.cards?.[3]?.hint || "Sin datos" : `${summary.educational?.activeUsers || 0} usuarios activos`,
        accent: "blue",
        goTo: isEmpleado ? "planes" : "empleados",
      },
      {
        label: "Evaluaciones pendientes",
        value: summary.educational?.pendingEvaluations || 0,
        hint: `${summary.educational?.evaluationsTotal || 0} evaluaciones visibles`,
        accent: "amber",
        goTo: "evaluaciones",
      },
      {
        label: "Ciclos activos",
        value: summary.cards?.[2]?.value || 0,
        hint: "Seguimiento del período actual",
        accent: "blue",
        goTo: "ciclos",
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
      anchor.click();
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

  if (!summary && message) {
    return (
      <div className="space-y-4">
        <DashboardSkeleton />
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-300/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => { setMessage(""); setIsLoading(true); setLoadSlow(false); }}
            className="shrink-0 rounded-xl border border-rose-300/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-500/15"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {greeting}{user?.nombre ? `, ${user.nombre}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-[#7a9aaa]">
            {user?.isSuperAdmin ? "Vista general de plataforma" : isEmpleado ? "Tu espacio personal" : isJefe ? "Vista de tu equipo" : "Vista general de la organización"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setView("reporte-ejecutivo")} className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm font-medium text-white">
            Reporte ejecutivo
          </button>
          <button type="button" onClick={downloadDecisionReport} disabled={isDownloadingReport} className="rounded-2xl bg-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-[#0f172a] disabled:opacity-60">
            {isDownloadingReport ? "Descargando..." : "Descargar resumen"}
          </button>
        </div>
      </div>

      {quickLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <button
              key={link.view}
              type="button"
              onClick={() => setView(link.view)}
              className="rounded-full border border-white/10 bg-[#122530] px-4 py-1.5 text-xs font-medium text-[#c5d5de] transition hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}

      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) ? <OnboardingChecklist /> : null}

      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) ? <DemoTourCard setView={setView} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.hint}
            accent={card.accent}
            onClick={card.goTo ? () => setView(card.goTo) : undefined}
          />
        ))}
      </section>

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
                <article key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white md:text-base">{item.title}</p>
                    <ActionBadge priority={item.priority} />
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{item.detail}</p>
                  <button
                    type="button"
                    onClick={() => setView(item.goTo)}
                    className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-[#d6e2e8]"
                  >
                    {item.actionLabel}
                  </button>
                </article>
                )}
              />
            ) : (
              <EmptyState text="Sin acciones pendientes por ahora. Todo está en orden." />
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Alertas y notificaciones" subtitle="Solo alertas operativas visibles; no mostramos indicadores sensibles.">
          <div className="space-y-3">
            {alerts.length ? (
              alerts.map((item, index) => (
                <article key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    {item.meta ? <span className="text-xs text-[#7f99a8]">{item.meta}</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{item.detail}</p>
                </article>
              ))
            ) : (
              <EmptyState text="Sin alertas activas. ZENTOR verifica automáticamente la calidad de los datos." />
            )}
          </div>
        </SurfaceCard>
      </section>

    </div>
  );
}
