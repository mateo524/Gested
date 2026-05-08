import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import { useView } from "../context/ViewContext";

function KpiCard({ title, value, hint }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#122530] p-5">
      <p className="text-sm text-[#9fb6c4]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-[#7f99a8]">{hint}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { token, activeCompany, activeCompanyId, user } = useAuth();
  const { setView } = useView();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const roleCode = user?.roleCode || "";
  const isSuperOrDirector = user?.isSuperAdmin || roleCode === "ADMIN_COLEGIO";
  const isRRHH = roleCode === "RRHH";
  const isJefe = roleCode === "JEFE";
  const isEmpleado = roleCode === "EMPLEADO";
  const isLector = ["LECTOR", "LECTOR_AUDITOR"].includes(roleCode);

  useEffect(() => {
    apiFetch("/dashboard/summary", { token })
      .then((summaryData) => {
        setSummary(summaryData);
      })
      .catch((error) => setMessage(error.message));
  }, [token, activeCompany?._id]);

  const training = useMemo(
    () => summary?.decisionInsights?.trainingRecommendations || [],
    [summary]
  );
  const risk = useMemo(() => summary?.decisionInsights?.riskRanking || [], [summary]);

  const actionsToday = useMemo(() => {
    const items = [];
    const pendingEvaluations = Number(summary?.educational?.pendingEvaluations || 0);
    const activeUsers = Number(summary?.educational?.activeUsers || 0);
    const lowPerformance = Number(summary?.educational?.lowPerformanceCount || 0);
    const newestRisk = risk[0];
    const topTraining = training[0];

    if (isSuperOrDirector) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Tenés ${pendingEvaluations} acciones pendientes en evaluaciones`,
          detail: "Cerrarlas mejora la lectura ejecutiva del ciclo.",
          actionLabel: "Ir a Evaluación",
          goTo: "evaluaciones",
        });
      }
      if (lowPerformance > 0) {
        items.push({
          priority: "ALTA",
          title: `${lowPerformance} colaboradores requieren revisión`,
          detail: "Definí intervención y plan de acompañamiento.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Reporte ejecutivo del ciclo",
        detail: "Descargá y compartí el estado actual con tu equipo.",
        actionLabel: "Ver reporte",
        goTo: "bases-descargas",
      });
    } else if (isRRHH) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Tenés ${pendingEvaluations} evaluaciones pendientes`,
          detail: "Requiere revisión para cerrar el ciclo.",
          actionLabel: "Ir a Evaluación",
          goTo: "evaluaciones",
        });
      }
      if (lowPerformance > 0) {
        items.push({
          priority: "ALTA",
          title: `${lowPerformance} colaboradores en riesgo`,
          detail: "Abrí planes y asigná seguimiento.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      if (activeUsers === 0) {
        items.push({
          priority: "MEDIA",
          title: "No hay usuarios activos",
          detail: "Creá accesos para habilitar autoevaluaciones.",
          actionLabel: "Ir a Accesos",
          goTo: "usuarios",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Listo para importar",
        detail: "Subí plantilla y validá errores antes de confirmar.",
        actionLabel: "Ir a Cargas y descargas",
        goTo: "bases-descargas",
      });
    } else if (isJefe) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Finalizar ${pendingEvaluations} evaluaciones de equipo`,
          detail: "Permite habilitar planes de mejora personalizados.",
          actionLabel: "Ir a Evaluación",
          goTo: "evaluaciones",
        });
      }
      if (newestRisk?.nombre) {
        items.push({
          priority: "ALTA",
          title: `Agendar 1:1 con ${newestRisk.nombre}`,
          detail: "Es el caso con mayor urgencia en tu equipo.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Revisar planes de tu equipo",
        detail: "Definí objetivos y fecha de seguimiento.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    } else if (isEmpleado) {
      if (topTraining) {
        items.push({
          priority: topTraining.priority === "ALTA" ? "ALTA" : "MEDIA",
          title: `Trabajar competencia: ${topTraining.competencia}`,
          detail: "Registrá evidencia para tu próxima revisión.",
          actionLabel: "Ir a Evaluación",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Completar autoevaluación actual",
        detail: "Te ayuda a ordenar tu feedback con jefatura.",
        actionLabel: "Ir a Evaluación",
        goTo: "evaluaciones",
      });
      items.push({
        priority: "BAJA",
        title: "Actualizar mi plan de desarrollo",
        detail: "Definí una acción concreta para los próximos 30 días.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    } else if (isLector) {
      items.push({
        priority: "MEDIA",
        title: "Ver reporte",
        detail: "Revisá consistencia de indicadores por período.",
        actionLabel: "Ir a Cargas y descargas",
        goTo: "bases-descargas",
      });
    }

    return items.slice(0, 5);
  }, [summary, isSuperOrDirector, isRRHH, isJefe, isEmpleado, isLector, risk, training]);

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

  if (message) return <p className="text-rose-300">{message}</p>;
  if (!summary) return <p className="text-[#9fb6c4]">Cargando panel...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Resumen del día</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          {actionsToday.length
            ? `Tenés ${actionsToday.length} acciones pendientes`
            : "No hay acciones urgentes ahora"}
        </h2>
        <div className="mt-4 space-y-3">
          {actionsToday.length ? (
            actionsToday.map((item, index) => (
              <article key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-[#0f1f28] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.priority === "ALTA" ? "bg-rose-900/30 text-rose-300 border border-rose-400/30" : "bg-amber-900/30 text-amber-300 border border-amber-400/30"}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#9fb6c4]">{item.detail}</p>
                <button
                  type="button"
                  onClick={() => setView(item.goTo)}
                  className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
                >
                  {item.actionLabel}
                </button>
              </article>
            ))
          ) : (
            <p className="text-sm text-[#9fb6c4]">Todo al día. Volvé a revisar al cierre de jornada.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title={isEmpleado ? "Mi score actual" : "Avance actual"} value={summary.cards?.[3]?.value || "0.00"} hint={summary.cards?.[3]?.hint || "Sin datos"} />
        <KpiCard title={isJefe ? "Pendientes del equipo" : "Pendientes"} value={summary.educational?.pendingEvaluations || 0} hint="Requiere revisión" />
        <KpiCard title={isEmpleado ? "Mi plan activo" : "Casos en riesgo"} value={risk.length || 0} hint={isEmpleado ? "Ver próximas acciones" : "Intervención sugerida"} />
        <KpiCard title={isRRHH ? "Importaciones" : "Capacitación"} value={training.length || 0} hint={isRRHH ? "Listo para importar" : "Ver recomendación"} />
      </section>

      {(isSuperOrDirector || isRRHH || isJefe || isEmpleado) ? (
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9fb6c4]">Siguiente paso</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {training[0]?.competencia
              ? `Requiere revisión: ${training[0].competencia}`
              : "Sin recomendación activa"}
          </h3>
          <p className="mt-2 text-sm text-[#c5d5de]">
            {training[0]?.action || "Todavía no hay evidencia suficiente para recomendar una acción concreta."}
          </p>
          {risk[0] ? (
            <p className="mt-3 text-sm text-[#9fb6c4]">
              Primer caso sugerido: <span className="font-semibold text-white">{risk[0].nombre}</span> ({risk[0].area} - {risk[0].cargo})
            </p>
          ) : null}
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9fb6c4]">Acceso rápido</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Ver reporte</h3>
          <p className="mt-2 text-sm text-[#c5d5de]">
            Descargá el reporte ejecutivo para compartir avances y pendientes.
          </p>
          <button
            type="button"
            onClick={downloadDecisionReport}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Ver reporte
          </button>
        </article>
      </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">{isEmpleado ? "Recomendaciones para mi desarrollo" : "Capacitación recomendada"}</h3>
          <p className="mt-1 text-[#9fb6c4]">Ordenada por prioridad de intervención.</p>
          <div className="mt-4 space-y-3">
            {training.length ? (
              training.map((item) => (
                <div key={item.competencia} className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.competencia}</p>
                    <span className="rounded-full bg-[#1e293b] px-2.5 py-1 text-xs font-semibold text-[#c5d5de]">{item.priority}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#9fb6c4]">{item.action}</p>
                </div>
              ))
            ) : (
              <p className="text-[#9fb6c4]">Sin datos para recomendaciones por competencia.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">{isJefe ? "Mi equipo en riesgo" : "Colaboradores a revisar"}</h3>
          <p className="mt-1 text-[#9fb6c4]">Mostramos primero los casos que requieren acción.</p>
          <div className="mt-4 space-y-2">
            {risk.length ? (
              risk.map((item, idx) => (
                <div key={`${item.employeeId}-${idx}`} className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-900/20 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-rose-100">{item.nombre}</p>
                    <p className="text-xs text-rose-200/80">{item.area} - {item.cargo}</p>
                  </div>
                  <span className="rounded-full border border-rose-300/40 bg-rose-800/40 px-3 py-1 text-xs font-semibold text-rose-100">{item.avgScore}</span>
                </div>
              ))
            ) : (
              <p className="text-[#9fb6c4]">Sin casos críticos en este momento.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Ver datos secundarios
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Organización activa</p>
              <p className="text-sm text-white">{activeCompany?.nombre || user?.companyName || "No definida"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Usuarios activos</p>
              <p className="text-sm text-white">{summary.educational?.activeUsers || 0}</p>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
