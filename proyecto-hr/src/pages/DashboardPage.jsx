import { useEffect, useMemo, useState } from "react";
import useCountUp from "../hooks/useCountUp";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
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

function SeedDemoBanner({ token, onSeeded }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSeed() {
    try {
      setLoading(true);
      const data = await apiFetch("/onboarding/seed-demo", { token, method: "POST" });
      addToast({ message: `Datos de demo cargados: ${data.seeded.employees} empleados, ${data.seeded.competencies} competencias.`, type: "success" });
      if (onSeeded) onSeeded();
    } catch (err) {
      addToast({ message: err.message || "No se pudieron cargar los datos de demo.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#14b8a6]/15">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-[#14b8a6]" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Empeza con datos de ejemplo</p>
          <p className="mt-0.5 text-xs text-[#7a9aaa]">Carga empleados, competencias y un ciclo de prueba para explorar la plataforma sin configurar nada.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSeed}
        disabled={loading}
        className="shrink-0 rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#022019] transition hover:bg-[#0d9488] disabled:opacity-60"
      >
        {loading ? "Cargando..." : "Cargar datos de demo"}
      </button>
    </div>
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

  useEffect(() => {
    if (!token) return;

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

  if (!summary && message) {
    return (
      <div className="space-y-4">
        <DashboardSkeleton />
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-300/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => { setMessage(""); setIsLoading(true); setLoadSlow(false); setRetryCount((c) => c + 1); }}
            className="shrink-0 rounded-xl border border-rose-300/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-500/15"
          >
            Reintentar
          </button>
        </div>
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
      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) && Number(summary?.cards?.[0]?.value || 0) === 0 ? (
        <SeedDemoBanner token={token} onSeeded={() => { setSummary(null); setRetryCount((c) => c + 1); }} />
      ) : null}
      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) ? <DemoTourCard setView={setView} /> : null}

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

    </div>
  );
}
