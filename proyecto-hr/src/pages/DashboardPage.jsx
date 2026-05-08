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
  const [opsStatus, setOpsStatus] = useState(null);
  const [roleCheck, setRoleCheck] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [simForm, setSimForm] = useState({ competency: "", investment: "media", amount: 250000 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [meetingMode, setMeetingMode] = useState(false);
  const roleCode = user?.roleCode || "";
  const isSuperOrDirector = user?.isSuperAdmin || roleCode === "ADMIN_COLEGIO";
  const isRRHH = roleCode === "RRHH";
  const isJefe = roleCode === "JEFE";
  const isEmpleado = roleCode === "EMPLEADO";
  const isLector = ["LECTOR", "LECTOR_AUDITOR"].includes(roleCode);

  useEffect(() => {
    Promise.all([
      apiFetch("/dashboard/summary", { token }),
      apiFetch("/dashboard/ops-status", { token }),
      apiFetch("/dashboard/role-check", { token }),
    ])
      .then(([summaryData, opsData, roleData]) => {
        setSummary(summaryData);
        setOpsStatus(opsData);
        setRoleCheck(roleData);
      })
      .catch((error) => setMessage(error.message));
  }, [token, activeCompany?._id]);

  const training = useMemo(
    () => summary?.decisionInsights?.trainingRecommendations || [],
    [summary]
  );
  const risk = useMemo(
    () => summary?.decisionInsights?.riskRanking || [],
    [summary]
  );
  const criticalCount = training.filter((item) => item.priority === "ALTA").length;

  const priorityStatus = useMemo(() => {
    if (criticalCount >= 3) return { label: "Prioridad alta", color: "rose", detail: "Intervencion inmediata recomendada." };
    if (criticalCount >= 1) return { label: "Prioridad media", color: "amber", detail: "Planificar capacitacion en el corto plazo." };
    return { label: "Prioridad estable", color: "emerald", detail: "Mantener seguimiento mensual." };
  }, [criticalCount]);

  const primaryDecision = useMemo(() => {
    const area = summary?.decisionInsights?.weakestAreas?.[0];
    if (!area) return "Sin datos suficientes para recomendar una inversion en capacitacion.";
    return `Prioriza inversion en ${area.label}: promedio ${area.value} sobre ${area.employees} colaboradores evaluados.`;
  }, [summary]);

  const quickPlan = useMemo(() => {
    const topCompetency = training[0];
    const topEmployees = risk.slice(0, 3).map((item) => item.nombre).filter(Boolean);
    if (!topCompetency) return [];
    return [
      `Intervenir primero la competencia "${topCompetency.competencia}" (prioridad ${topCompetency.priority}).`,
      topEmployees.length
        ? `Iniciar seguimiento con: ${topEmployees.join(", ")}.`
        : "Definir primeros colaboradores de seguimiento con menor score.",
      "Medir impacto a 30 dias con el simulador para decidir escalado de presupuesto.",
    ];
  }, [training, risk]);

  const alertasUtiles = useMemo(() => {
    const alertas = [];
    const pendingEvaluations = Number(summary?.educational?.pendingEvaluations || 0);
    const lowPerformance = Number(summary?.educational?.lowPerformanceCount || 0);
    const importsLastHour = Number(opsStatus?.activity?.importsLastHour || 0);
    const smtpConfigured = Boolean(opsStatus?.integrations?.smtpConfigured);
    const roleCoverage = Number(roleCheck?.checks?.expectedCoveragePct || 0);

    if (pendingEvaluations > 0) {
      alertas.push({
        tipo: "ALTA",
        titulo: "Evaluaciones pendientes",
        detalle: `${pendingEvaluations} evaluaciones esperan cierre.`,
        accion: "Ir a Evaluacion",
        goTo: "evaluaciones",
      });
    }
    if (lowPerformance > 0) {
      alertas.push({
        tipo: "ALTA",
        titulo: "Colaboradores en riesgo",
        detalle: `${lowPerformance} casos requieren plan de desarrollo inmediato.`,
        accion: "Ir a Desarrollo",
        goTo: "planes",
      });
    }
    if (importsLastHour === 0) {
      alertas.push({
        tipo: "MEDIA",
        titulo: "Sin carga de datos reciente",
        detalle: "No hubo importaciones en la ultima hora.",
        accion: "Ir a Cargas y descargas",
        goTo: "bases-descargas",
      });
    }
    if (roleCoverage < 100) {
      alertas.push({
        tipo: "MEDIA",
        titulo: "Cobertura de permisos incompleta",
        detalle: `Cobertura actual: ${roleCoverage}%.`,
        accion: "Ir a Perfiles",
        goTo: "roles",
      });
    }
    if (!smtpConfigured) {
      alertas.push({
        tipo: "MEDIA",
        titulo: "Recuperacion de contrasena incompleta",
        detalle: "SMTP no esta configurado para recuperacion automatica.",
        accion: "Ir a Configuracion",
        goTo: "settings",
      });
    }
    return alertas.slice(0, 5);
  }, [summary, opsStatus, roleCheck]);

  const reportesAccionables = useMemo(() => {
    const principal = training[0];
    const riesgoPrincipal = risk[0];
    return [
      {
        titulo: "Plan de capacitacion sugerido",
        impacto: principal ? `Prioridad ${principal.priority} en ${principal.competencia}` : "Sin recomendacion activa",
        estado: principal ? "Listo para ejecutar" : "Pendiente de datos",
        accion: "Ver desarrollo",
        goTo: "planes",
      },
      {
        titulo: "Seguimiento de alto riesgo",
        impacto: riesgoPrincipal
          ? `${riesgoPrincipal.nombre} con score ${riesgoPrincipal.avgScore}`
          : "Sin casos de riesgo detectados",
        estado: riesgoPrincipal ? "Intervencion recomendada" : "En monitoreo",
        accion: "Ver evaluaciones",
        goTo: "evaluaciones",
      },
      {
        titulo: "Trazabilidad y evidencia",
        impacto: `Cobertura de permisos ${roleCheck?.checks?.expectedCoveragePct ?? 0}%`,
        estado: (roleCheck?.checks?.expectedCoveragePct ?? 0) >= 90 ? "Estable" : "Requiere ajuste",
        accion: "Ver perfiles",
        goTo: "roles",
      },
    ];
  }, [training, risk, roleCheck]);
  const actionsToday = useMemo(() => {
    const items = [];
    const pendingEvaluations = Number(summary?.educational?.pendingEvaluations || 0);
    const activeUsers = Number(summary?.educational?.activeUsers || 0);
    const lowPerformance = Number(summary?.educational?.lowPerformanceCount || 0);
    const importsLastHour = Number(opsStatus?.activity?.importsLastHour || 0);
    const smtpConfigured = Boolean(opsStatus?.integrations?.smtpConfigured);
    const roleCoverage = Number(roleCheck?.checks?.expectedCoveragePct || 0);
    const newestRisk = risk[0];
    const topTraining = training[0];

    if (isSuperOrDirector) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Cerrar ${pendingEvaluations} evaluaciones pendientes`,
          detail: "Destraba decisiones de gestion y mejora la calidad del dashboard.",
          actionLabel: "Ir a Evaluacion",
          goTo: "evaluaciones",
        });
      }
      if (lowPerformance > 0) {
        items.push({
          priority: "ALTA",
          title: `Definir intervencion para ${lowPerformance} casos criticos`,
          detail: "Prioriza acompanamiento y presupuesto de capacitacion.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      if (importsLastHour === 0) {
        items.push({
          priority: "MEDIA",
          title: "No hubo cargas recientes de datos",
          detail: "Actualiza la base para decisiones con evidencia vigente.",
          actionLabel: "Ir a Cargas y descargas",
          goTo: "bases-descargas",
        });
      }
      if (roleCoverage < 100) {
        items.push({
          priority: "MEDIA",
          title: `Ajustar cobertura de permisos (${roleCoverage}%)`,
          detail: "Asegura que cada rol vea solo su alcance operativo.",
          actionLabel: "Ir a Perfiles",
          goTo: "roles",
        });
      }
      if (!smtpConfigured) {
        items.push({
          priority: "BAJA",
          title: "Configurar recuperacion de contrasena (SMTP)",
          detail: "Reduce bloqueos de acceso y tickets manuales.",
          actionLabel: "Ir a Configuracion",
          goTo: "settings",
        });
      }
    } else if (isRRHH) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Completar ${pendingEvaluations} evaluaciones pendientes`,
          detail: "Sin evaluaciones completas no hay lectura real de desempeno.",
          actionLabel: "Ir a Evaluacion",
          goTo: "evaluaciones",
        });
      }
      if (lowPerformance > 0) {
        items.push({
          priority: "ALTA",
          title: `Abrir planes para ${lowPerformance} colaboradores en riesgo`,
          detail: "Activa seguimiento quincenal con foco por competencia.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      if (activeUsers === 0) {
        items.push({
          priority: "MEDIA",
          title: "No hay usuarios activos",
          detail: "Crea accesos para habilitar autoevaluaciones y feedback.",
          actionLabel: "Ir a Accesos",
          goTo: "usuarios",
        });
      }
      if (importsLastHour === 0) {
        items.push({
          priority: "MEDIA",
          title: "Validar nueva carga de plantilla",
          detail: "Sube datos de empleados y metricas para mantener trazabilidad.",
          actionLabel: "Ir a Cargas y descargas",
          goTo: "bases-descargas",
        });
      }
      if (roleCoverage < 100) {
        items.push({
          priority: "BAJA",
          title: "Revisar matriz de permisos",
          detail: "Evita fricciones operativas por accesos incompletos.",
          actionLabel: "Ir a Perfiles",
          goTo: "roles",
        });
      }
    } else if (isJefe) {
      if (pendingEvaluations > 0) {
        items.push({
          priority: "ALTA",
          title: `Finalizar ${pendingEvaluations} evaluaciones de equipo`,
          detail: "Permite habilitar planes de mejora personalizados.",
          actionLabel: "Ir a Evaluacion",
          goTo: "evaluaciones",
        });
      }
      if (newestRisk?.nombre) {
        items.push({
          priority: "ALTA",
          title: `Agendar 1:1 con ${newestRisk.nombre}`,
          detail: "Caso con mayor urgencia de acompanamiento en tu equipo.",
          actionLabel: "Ir a Desarrollo",
          goTo: "planes",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Actualizar acuerdos de seguimiento",
        detail: "Deja objetivos semanales claros para cada colaborador.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    } else if (isEmpleado) {
      if (topTraining) {
        items.push({
          priority: topTraining.priority === "ALTA" ? "ALTA" : "MEDIA",
          title: `Trabajar competencia: ${topTraining.competencia}`,
          detail: "Registra evidencia concreta para tu proxima revision.",
          actionLabel: "Ir a Evaluacion",
          goTo: "evaluaciones",
        });
      }
      items.push({
        priority: "MEDIA",
        title: "Completar autoevaluacion actual",
        detail: "Mejora la calidad de feedback con tu jefatura.",
          actionLabel: "Ir a Evaluacion",
        goTo: "evaluaciones",
      });
      items.push({
        priority: "BAJA",
        title: "Actualizar plan de desarrollo personal",
        detail: "Define una accion concreta para los proximos 30 dias.",
        actionLabel: "Ir a Desarrollo",
        goTo: "planes",
      });
    } else if (isLector) {
      items.push({
        priority: "MEDIA",
        title: "Revisar consistencia de reportes",
        detail: "Controla que indicadores y descargas coincidan por periodo.",
        actionLabel: "Ir a Cargas y descargas",
        goTo: "bases-descargas",
      });
      items.push({
        priority: "BAJA",
        title: "Verificar trazabilidad de exportaciones",
        detail: "Audita responsable, fecha y filtros utilizados en cada descarga.",
        actionLabel: "Ir a Cargas y descargas",
        goTo: "bases-descargas",
      });
    }

    return items.slice(0, 5);
  }, [summary, opsStatus, roleCheck, isSuperOrDirector, isRRHH, isJefe, isEmpleado, isLector, risk, training]);

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

  async function runSimulation() {
    try {
      const params = new URLSearchParams();
      if (simForm.competency) params.set("competency", simForm.competency);
      params.set("investment", simForm.investment);
      params.set("amount", String(simForm.amount || 0));
      const data = await apiFetch(`/dashboard/simulate-impact?${params.toString()}`, { token });
      setSimulation(data.simulation);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function runScenarioComparison() {
    try {
      const investments = ["baja", "media", "alta"];
      const results = await Promise.all(
        investments.map(async (level) => {
          const params = new URLSearchParams();
          if (simForm.competency) params.set("competency", simForm.competency);
          params.set("investment", level);
          params.set("amount", String(simForm.amount || 0));
          const data = await apiFetch(`/dashboard/simulate-impact?${params.toString()}`, { token });
          return { level, simulation: data.simulation };
        })
      );
      setScenarios(results);
    } catch (error) {
      setMessage(error.message);
    }
  }


  if (message) return <p className="text-rose-300">{message}</p>;
  if (!summary) return <p className="text-[#9fb6c4]">Cargando panel ejecutivo...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#122530] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Vista</p>
            <p className="text-sm text-white">{meetingMode ? "Modo reunion activado" : "Modo operativo activado"}</p>
          </div>
          <button
            type="button"
            onClick={() => setMeetingMode((v) => !v)}
            className="rounded-xl border border-white/20 bg-[#0f1f28] px-4 py-2 text-sm font-semibold text-[#c5d5de]"
          >
            {meetingMode ? "Volver a modo operativo" : "Activar modo reunion"}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-emerald-300/30 bg-emerald-500/10 p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Vista principal</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Decisiones recomendadas</h2>
        <p className="mt-3 text-lg text-emerald-100">{primaryDecision}</p>
        {quickPlan.length ? (
          <div className="mt-4 rounded-xl border border-emerald-200/20 bg-emerald-900/20 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Plan rapido (30 dias)</p>
            <div className="mt-2 space-y-1 text-sm text-emerald-100">
              {quickPlan.map((step, index) => (
                <p key={index}>{index + 1}. {step}</p>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={downloadDecisionReport} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            Descargar reporte de decisiones
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Modo reunion directiva</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Resumen en una pantalla</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          <KpiCard title="Promedio" value={summary.cards?.[3]?.value || "0.00"} hint="General" />
          <KpiCard title="Pendientes" value={summary.educational?.pendingEvaluations || 0} hint="Evaluaciones" />
          <KpiCard title="Riesgo" value={risk.length || 0} hint="Casos" />
          <KpiCard title="Criticas" value={criticalCount || 0} hint="Competencias" />
          <KpiCard title="Cobertura rol" value={`${roleCheck?.checks?.expectedCoveragePct ?? 0}%`} hint="Permisos" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Reportes ejecutivos</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Reportes accionables</h3>
          <div className="mt-4 space-y-3">
            {reportesAccionables.map((item) => (
              <div key={item.titulo} className="rounded-xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="text-sm font-semibold text-white">{item.titulo}</p>
                <p className="mt-1 text-sm text-[#9fb6c4]">{item.impacto}</p>
                <p className="mt-1 text-xs text-[#c5d5de]">Estado: {item.estado}</p>
                <button
                  type="button"
                  onClick={() => setView(item.goTo)}
                  className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
                >
                  {item.accion}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Alertas utiles</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Solo lo que requiere accion</h3>
          <div className="mt-4 space-y-3">
            {alertasUtiles.length ? (
              alertasUtiles.map((item) => (
                <div key={item.titulo} className="rounded-xl border border-white/10 bg-[#0f1f28] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.titulo}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      item.tipo === "ALTA"
                        ? "bg-rose-900/30 text-rose-300 border border-rose-400/30"
                        : "bg-amber-900/30 text-amber-300 border border-amber-400/30"
                    }`}>
                      {item.tipo}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#9fb6c4]">{item.detalle}</p>
                  <button
                    type="button"
                    onClick={() => setView(item.goTo)}
                    className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
                  >
                    {item.accion}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#9fb6c4]">No hay alertas accionables por ahora.</p>
            )}
          </div>
        </article>
      </section>

      

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Bandeja</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Bandeja de acciones prioritarias</h3>
          </div>
        </div>
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
            <p className="text-sm text-[#9fb6c4]">No hay alertas urgentes. Mantener monitoreo semanal.</p>
          )}
        </div>
      </section>


      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title={isEmpleado ? "Mi score actual" : "Promedio general"} value={summary.cards?.[3]?.value || "0.00"} hint={summary.cards?.[3]?.hint || "Sin datos"} />
        <KpiCard title={isJefe ? "Pendientes del equipo" : "Evaluaciones pendientes"} value={summary.educational?.pendingEvaluations || 0} hint="Evaluaciones en BORRADOR o ENVIADA" />
        <KpiCard title={isEmpleado ? "Riesgo personal" : "Empleados en riesgo"} value={risk.length || 0} hint={isEmpleado ? "Tendencia de mejora sugerida" : "Colaboradores con score mas bajo"} />
        <KpiCard title={isRRHH ? "Brechas de competencias" : "Competencias criticas"} value={criticalCount || 0} hint="Capacitacion urgente recomendada" />
      </section>

      {(isSuperOrDirector || isRRHH) ? (
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9fb6c4]">Accion inmediata sugerida</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {training[0]?.competencia
              ? `Iniciar plan en ${training[0].competencia}`
              : "Sin recomendacion activa"}
          </h3>
          <p className="mt-2 text-sm text-[#c5d5de]">
            {training[0]?.action || "Todavia no hay evidencia suficiente para recomendar una accion inmediata."}
          </p>
          {risk[0] ? (
            <p className="mt-3 text-sm text-[#9fb6c4]">
              Primer caso sugerido: <span className="font-semibold text-white">{risk[0].nombre}</span> ({risk[0].area} - {risk[0].cargo})
            </p>
          ) : null}
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9fb6c4]">Semaforo ejecutivo</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                priorityStatus.color === "rose"
                  ? "bg-rose-400"
                  : priorityStatus.color === "amber"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
            <p className="text-lg font-semibold text-white">{priorityStatus.label}</p>
          </div>
          <p className="mt-2 text-sm text-[#c5d5de]">{priorityStatus.detail}</p>
          <p className="mt-3 text-xs text-[#9fb6c4]">
            Basado en {criticalCount} competencias criticas y {risk.length} colaboradores en riesgo.
          </p>
        </article>
      </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">{isEmpleado ? "Recomendaciones para tu desarrollo" : "Capacitacion recomendada"}</h3>
          <p className="mt-1 text-[#9fb6c4]">Ordenada por menor puntaje promedio de competencia.</p>
          <div className="mt-4 space-y-3">
            {training.length ? (
              training.map((item) => (
                <div key={item.competencia} className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.competencia}</p>
                    <span className="rounded-full bg-[#1e293b] px-2.5 py-1 text-xs font-semibold text-[#c5d5de]">{item.priority}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#9fb6c4]">{item.action}</p>
                  <p className="mt-1 text-xs text-[#7f99a8]">Score promedio: {item.avgScore}</p>
                </div>
              ))
            ) : (
              <p className="text-[#9fb6c4]">Sin datos para recomendaciones por competencia.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">{isJefe ? "Mi equipo en riesgo" : "Ranking de empleados en riesgo"}</h3>
          <p className="mt-1 text-[#9fb6c4]">{isEmpleado ? "Comparativa de referencia del ciclo actual." : "Top de colaboradores a intervenir primero."}</p>
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
              <p className="text-[#9fb6c4]">Sin datos para ranking de riesgo.</p>
            )}
          </div>
        </div>
      </section>

      {!meetingMode ? (
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full rounded-xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-left text-sm font-semibold text-white"
        >
          {showAdvanced ? "Ocultar analitica avanzada" : "Mostrar analitica avanzada (patrones y prediccion)"}
        </button>
      </section>
      ) : null}

      {showAdvanced && !meetingMode ? (
      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-lg font-semibold text-white">Capa 1: Patrones detectados</h3>
          <div className="mt-4 space-y-3">
            {(summary.predictiveInsights?.layer1Patterns || []).slice(0, 4).map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-[#9fb6c4]">{item.evidence}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-lg font-semibold text-white">Capa 2: Prediccion explicable</h3>
          <div className="mt-4 space-y-3">
            {(summary.predictiveInsights?.layer2Predictions || []).slice(0, 5).map((item) => (
              <div key={item.employeeId} className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.empleado}</p>
                  <span className="rounded-full bg-[#1e293b] px-2 py-1 text-xs font-semibold text-[#c5d5de]">Riesgo {item.riskScore}</span>
                </div>
                <p className="mt-1 text-xs text-[#9fb6c4]">{item.recommendation}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-lg font-semibold text-white">Capa 3: Forecast estrategico</h3>
          <p className="mt-1 text-xs text-[#9fb6c4]">Fuente: {summary.predictiveInsights?.layer3Forecast?.source || "local"}</p>
          <div className="mt-4 space-y-2">
            {(summary.predictiveInsights?.layer3Forecast?.strategicActions || []).slice(0, 3).map((action, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#0f1f28] p-3 text-sm text-[#c5d5de]">
                {action}
              </div>
            ))}
          </div>
        </article>
      </section>
      ) : null}

      {!meetingMode ? (
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-xl font-semibold text-white">Simulador de inversion en capacitacion</h3>
        <p className="mt-1 text-[#9fb6c4]">Proyecta impacto en riesgo y desempeno antes de decidir presupuesto.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={simForm.competency} onChange={(e) => setSimForm((prev) => ({ ...prev, competency: e.target.value }))}>
            <option value="">Competencia prioritaria automatica</option>
            {training.map((item) => (
              <option key={item.competencia} value={item.competencia}>{item.competencia}</option>
            ))}
          </select>
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={simForm.investment} onChange={(e) => setSimForm((prev) => ({ ...prev, investment: e.target.value }))}>
            <option value="baja">Inversion baja</option>
            <option value="media">Inversion media</option>
            <option value="alta">Inversion alta</option>
          </select>
          <input
            type="number"
            min="0"
            step="1000"
            className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
            value={simForm.amount}
            onChange={(e) => setSimForm((prev) => ({ ...prev, amount: Number(e.target.value || 0) }))}
            placeholder="Monto a invertir (ARS)"
          />
          <button type="button" onClick={runSimulation} className="rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white">
            Simular impacto
          </button>
          <button type="button" onClick={runScenarioComparison} className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-[#c5d5de]">
            Comparar escenarios
          </button>
        </div>

        {simulation ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Riesgo promedio</p>
              <p className="text-lg font-bold text-white">{simulation.baseline?.avgRisk} {"->"} {simulation.projection?.avgRisk}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Alto riesgo</p>
              <p className="text-lg font-bold text-white">{simulation.baseline?.highRiskEmployees} {"->"} {simulation.projection?.highRiskEmployees}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Reduccion proyectada</p>
              <p className="text-lg font-bold text-emerald-400">{simulation.projection?.riskReductionPct}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0f1f28] p-3">
              <p className="text-xs text-[#9fb6c4]">Mejora score</p>
              <p className="text-lg font-bold text-emerald-400">+{simulation.projection?.avgScoreUplift}</p>
            </div>
          </div>
        ) : null}

        {scenarios.length ? (
          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold text-white">Comparativa ejecutiva de inversion</p>
            <div className="grid gap-3 md:grid-cols-3">
              {scenarios.map((scenario) => (
                <div key={scenario.level} className="rounded-xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#9fb6c4]">
                    {scenario.level === "baja" ? "Inversion baja" : scenario.level === "media" ? "Inversion media" : "Inversion alta"}
                  </p>
                  <p className="mt-2 text-sm text-[#c5d5de]">
                    Riesgo promedio: <span className="font-semibold text-white">{scenario.simulation?.baseline?.avgRisk} {"->"} {scenario.simulation?.projection?.avgRisk}</span>
                  </p>
                  <p className="mt-1 text-sm text-[#c5d5de]">
                    Reduccion: <span className="font-semibold text-emerald-400">{scenario.simulation?.projection?.riskReductionPct}%</span>
                  </p>
                  <p className="mt-1 text-sm text-[#c5d5de]">
                    Mejora score: <span className="font-semibold text-emerald-400">+{scenario.simulation?.projection?.avgScoreUplift}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}



