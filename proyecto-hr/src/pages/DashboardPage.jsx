import { useEffect, useMemo, useState } from "react";
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
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#93acbb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, accent = "blue" }) {
  const accentClass =
    accent === "green"
      ? "from-emerald-500/12 to-transparent border-emerald-400/15"
      : accent === "amber"
        ? "from-amber-500/12 to-transparent border-amber-300/15"
        : "from-blue-500/12 to-transparent border-blue-400/15";

  return (
    <article className={`rounded-3xl border bg-gradient-to-br p-5 ${accentClass}`}>
      <p className="text-sm text-[#8ea5b3]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-[#a8bdc8]">{hint}</p>
    </article>
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
  return <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f1f28] px-4 py-6 text-sm text-[#8ea5b3]">{text}</div>;
}

export default function DashboardPage() {
  const { token, activeCompanyId, user } = useAuth();
  const { setView } = useView();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

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
    if (cachedSummary) {
      try {
        setSummary(JSON.parse(cachedSummary));
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const controller = new AbortController();
    apiFetch("/dashboard/summary", { token, timeoutMs: 20000, signal: controller.signal })
      .then((summaryData) => {
        setSummary(summaryData);
        sessionStorage.setItem(cacheKey, JSON.stringify(summaryData));
        setMessage("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(error.message);
      });

    return () => controller.abort();
  }, [token, activeCompanyId, user]);

  const training = useMemo(() => summary?.decisionInsights?.trainingRecommendations || [], [summary]);
  const alerts = useMemo(() => {
    const items = [];
    if (summary?.alerts?.summary) {
      items.push({
        tone: summary.alerts.isLow ? "warning" : "info",
        title: "Ultima revision de calidad",
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
        detail: "Revisa desarrollo y acompanamiento desde una mirada agregada.",
      });
    }
    return items.slice(0, 4);
  }, [summary, isEmpleado]);

  const recentActivity = useMemo(() => {
    return (summary?.latestAudit || []).slice(0, 5).map((item, index) => ({
      id: item._id || `${item.accion}-${index}`,
      date: formatDate(item.createdAt),
      title: item.accion || "Actividad",
      detail: item.detalle || item.modulo || "Sin detalle adicional",
    }));
  }, [summary]);

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
          detail: "Deja el ciclo listo para una lectura ejecutiva mas clara.",
          actionLabel: "Ir a Evaluaciones",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Revisar el reporte ejecutivo",
        detail: "Consolida personas, resultados y prioridades del per?odo.",
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
        detail: "Importa empleados, usuarios y cat?logos con la plantilla oficial.",
        actionLabel: "Ir a Importación",
        goTo: "carga-masiva",
      });
      if (lowPerformance > 0) {
        items.push({
          priority: "MEDIA",
          title: `${lowPerformance} casos para desarrollo`,
          detail: "Prioriza seguimiento y acciones en la vista de desarrollo.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
    } else if (isJefe) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Completar ${pendingEvaluations} evaluaciones del equipo`,
          detail: "Te permite pasar a seguimiento y desarrollo sin fricci?n.",
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
        detail: "Ordena tu feedback y tu conversaci?n con jefatura.",
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
        detail: "Es el foco de desarrollo mas visible en este momento.",
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
        },
        {
          label: "Empleados visibles",
          value: summary.cards?.[0]?.value || 0,
          hint: "Dentro de la organización activa",
          accent: "green",
        },
        {
          label: "Evaluaciones pendientes",
          value: summary.educational?.pendingEvaluations || 0,
          hint: `${summary.educational?.evaluationsTotal || 0} registradas`,
          accent: "amber",
        },
        {
          label: "Ciclos activos",
          value: summary.cards?.[2]?.value || 0,
          hint: "Estado actual del periodo",
          accent: "blue",
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
      },
      {
        label: "Evaluaciones pendientes",
        value: summary.educational?.pendingEvaluations || 0,
        hint: `${summary.educational?.evaluationsTotal || 0} evaluaciones visibles`,
        accent: "amber",
      },
      {
        label: "Ciclos activos",
        value: summary.cards?.[2]?.value || 0,
        hint: "Seguimiento del periodo actual",
        accent: "blue",
      },
      {
        label: "Planes de desarrollo",
        value: training.length || 0,
        hint: training.length ? "Focos abiertos de seguimiento" : "Todavía sin planes visibles",
        accent: "green",
      }
    );

    if ((summary.educational?.metricsTotal || 0) > 0) {
      cards.push({
        label: "Objetivos / Indicadores",
        value: summary.educational?.metricsTotal || 0,
        hint: "Indicadores configurados",
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
      { label: "Objetivos / Indicadores", view: "metricas", show: !isEmpleado && !isLector },
    ];
    return items.filter((item) => item.show);
  }, [isEmpleado, isLector]);

  async function downloadDecisionReport() {
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
    }
  }

  if (message) {
    return <p className="pf-alert-error">{message}</p>;
  }

  if (!summary) {
    return <p className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-5 text-sm text-[#9fb6c4]">Cargando panel principal...</p>;
  }

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="pf-section-title">Inicio</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {user?.isSuperAdmin
                ? "Vista general de plataforma"
                : isEmpleado
                  ? "Tu espacio principal"
                  : isJefe
                    ? "Vista general de tu equipo"
                    : "Vista general de la organización"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
              Una vista 360 simple para ver personas, evaluaciones, desarrollo y próximos pasos sin saturar la operación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("reporte-ejecutivo")}
              className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
            >
              Abrir reporte ejecutivo
            </button>
            <button
              type="button"
              onClick={downloadDecisionReport}
              className="rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white"
            >
              Descargar resumen
            </button>
          </div>
        </div>
      </section>

      {(isSuperOrDirector || isRRHH || isAdminOrgUser(user)) ? <OnboardingChecklist /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} accent={card.accent} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
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
              <EmptyState text="No hay acciones urgentes por ahora." />
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
              <EmptyState text="No hay alertas operativas para mostrar." />
            )}
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <SurfaceCard title="Actividad reciente" subtitle="Usamos la actividad real registrada en auditoria y eventos visibles.">
          <div className="space-y-3">
            {recentActivity.length ? (
              <CollapsibleList
                items={recentActivity}
                initialCount={3}
                className="space-y-3"
                renderItem={(item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    {item.date ? <span className="text-xs text-[#7f99a8]">{item.date}</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{item.detail}</p>
                </div>
                )}
              />
            ) : (
              <EmptyState text="No hay actividad reciente todavía." />
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Proximos hitos" subtitle="Fechas, cierres o puntos de seguimiento visibles desde los datos actuales.">
          <div className="space-y-3">
            {upcomingMilestones.length ? (
              <CollapsibleList
                items={upcomingMilestones}
                initialCount={3}
                className="space-y-3"
                renderItem={(item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{item.detail}</p>
                </div>
                )}
              />
            ) : (
              <EmptyState text="No hay próximos hitos con fecha visible todavía." />
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Accesos rápidos" subtitle="Atajos a los módulos más usados para avanzar sin dar vueltas.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setView(item.view)}
                className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4 text-left transition hover:border-blue-400/30 hover:bg-[#132530]"
              >
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-sm text-[#8ea5b3]">Abrir módulo</p>
              </button>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SurfaceCard title="Resumen del desempeño" subtitle="Se apoya en datos visibles del alcance actual.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm text-[#8ea5b3]">Promedio general</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.cards?.[3]?.value || "0.00"}</p>
              <p className="mt-2 text-sm text-[#9fb6c4]">{summary.cards?.[3]?.hint || "Sin datos visibles"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm text-[#8ea5b3]">Indicadores configurados</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.educational?.metricsTotal || 0}</p>
              <p className="mt-2 text-sm text-[#9fb6c4]">Mide objetivos e indicadores visibles en tu alcance.</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Objetivos / indicadores" subtitle="Mostramos solo datos reales que hoy ya existen.">
          <div className="space-y-3">
            {training.length ? (
              <CollapsibleList
                items={training}
                initialCount={3}
                className="space-y-3"
                renderItem={(item) => (
                <div key={item.competencia} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.competencia}</p>
                    <ActionBadge priority={item.priority} />
                  </div>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{item.action}</p>
                </div>
                )}
              />
            ) : (
              <EmptyState text="Todavía no hay objetivos o indicadores visibles para este alcance." />
            )}
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
