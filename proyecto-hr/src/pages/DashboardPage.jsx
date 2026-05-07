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
  const { token, activeCompany, user } = useAuth();
  const { setView } = useView();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [opsStatus, setOpsStatus] = useState(null);
  const [roleCheck, setRoleCheck] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [simForm, setSimForm] = useState({ competency: "", investment: "media" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [launchAudit, setLaunchAudit] = useState({ running: false, done: false, score: 0, checks: [] });
  const roleCode = user?.roleCode || "";
  const isSuperOrDirector = user?.isSuperAdmin || roleCode === "ADMIN_COLEGIO";
  const isRRHH = roleCode === "RRHH";
  const isJefe = roleCode === "JEFE";
  const isEmpleado = roleCode === "EMPLEADO";
  const isLector = roleCode === "LECTOR_AUDITOR";

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

  const training = summary?.decisionInsights?.trainingRecommendations || [];
  const risk = summary?.decisionInsights?.riskRanking || [];
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

  const onboardingSteps = useMemo(() => {
    const employeesCount = Number(summary?.educational?.employees || 0);
    const metricsCount = Number(summary?.educational?.metrics || 0);
    const evaluationsCount = Number(summary?.educational?.evaluations || 0);
    const plansCount = Number(summary?.educational?.developmentPlans || 0);

    return [
      {
        id: "empleados",
        title: "1. Cargar plantilla inicial",
        detail: "Da de alta colaboradores y responsables por colegio.",
        done: employeesCount > 0,
        actionLabel: "Ir a Plantilla",
      },
      {
        id: "metricas",
        title: "2. Definir competencias e indicadores",
        detail: "Configura métricas para poder evaluar y comparar.",
        done: metricsCount > 0,
        actionLabel: "Ir a Indicadores",
      },
      {
        id: "evaluaciones",
        title: "3. Registrar evaluaciones",
        detail: "Carga resultados para comenzar el seguimiento real.",
        done: evaluationsCount > 0,
        actionLabel: "Ir a Evaluación",
      },
      {
        id: "planes",
        title: "4. Activar planes de desarrollo",
        detail: "Convierte resultados en acciones concretas de mejora.",
        done: plansCount > 0,
        actionLabel: "Ir a Desarrollo",
      },
    ];
  }, [summary]);

  const completedSteps = onboardingSteps.filter((s) => s.done).length;

  async function downloadDecisionReport() {
    try {
      const response = await fetch(`${apiUrl}/dashboard/decision-report`, {
        headers: { Authorization: `Bearer ${token}` },
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
          const data = await apiFetch(`/dashboard/simulate-impact?${params.toString()}`, { token });
          return { level, simulation: data.simulation };
        })
      );
      setScenarios(results);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function runLaunchAudit() {
    setLaunchAudit({ running: true, done: false, score: 0, checks: [] });
    const checks = [];
    const addCheck = (id, ok, detail) => checks.push({ id, ok, detail });

    try {
      const [me, ops, role, exportsOverview, supportHealth] = await Promise.all([
        apiFetch("/auth/me", { token }).catch(() => null),
        apiFetch("/dashboard/ops-status", { token }).catch(() => null),
        apiFetch("/dashboard/role-check", { token }).catch(() => null),
        apiFetch("/education-exports/overview", { token }).catch(() => null),
        apiFetch("/support/health", { token }).catch(() => null),
      ]);

      addCheck("Login y sesión", Boolean(me?._id || me?.email), me ? "Sesión válida." : "No se pudo validar la sesión.");
      addCheck("Mongo/API", Boolean(ops?.runtime?.mongoConnected && ops?.runtime?.apiHealthy), ops?.runtime?.mongoConnected ? "Conectado." : "Sin conexión estable.");
      addCheck("Aislamiento por rol", Boolean(role?.checks?.tenantScoped || role?.isSuperAdmin), role?.isSuperAdmin ? "Rol global superadmin." : role?.checks?.tenantScoped ? "Tenant aislado activo." : "Sin aislamiento por tenant.");
      addCheck("Permisos mínimos", Number(role?.checks?.expectedCoveragePct || 0) >= 70, `Cobertura ${role?.checks?.expectedCoveragePct ?? 0}%`);
      addCheck("Módulo datos/importación", Boolean(exportsOverview?.summary), exportsOverview?.summary ? "Overview de datos disponible." : "No responde módulo de datos.");
      addCheck("Soporte/chat backend", Boolean(supportHealth?.ok), supportHealth?.ok ? "Servicio de soporte activo." : "No responde soporte.");
      addCheck("Cloudinary configurado", Boolean(ops?.integrations?.cloudinaryConfigured), ops?.integrations?.cloudinaryConfigured ? "Configurado." : "Pendiente configurar.");
      addCheck("Reset password (infra)", Boolean(ops?.integrations?.smtpConfigured), ops?.integrations?.smtpConfigured ? "SMTP listo." : "SMTP no configurado.");

      const passed = checks.filter((c) => c.ok).length;
      const score = Math.round((passed / checks.length) * 100);
      setLaunchAudit({ running: false, done: true, score, checks });
    } catch {
      setLaunchAudit({
        running: false,
        done: true,
        score: 0,
        checks: [{ id: "Ejecución de auditoría", ok: false, detail: "No se pudo completar la auditoría." }],
      });
    }
  }

  if (message) return <p className="text-rose-300">{message}</p>;
  if (!summary) return <p className="text-[#9fb6c4]">Cargando panel ejecutivo...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9FB6C1]">Vista por rol</p>
        <h3 className="mt-1 text-xl font-semibold text-white">
          {isSuperOrDirector && "Directorio: decisiones globales"}
          {isRRHH && "RRHH: seguimiento operativo"}
          {isJefe && "Jefatura: equipo a cargo"}
          {isEmpleado && "Colaborador: evolución personal"}
          {isLector && "Auditoría: lectura y control"}
          {!isSuperOrDirector && !isRRHH && !isJefe && !isEmpleado && !isLector && "Panel ejecutivo"}
        </h3>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Centro de estado operativo</p>
          <div className="mt-3 grid gap-2 text-sm text-[#d4e1e8]">
            <p>API: <span className={opsStatus?.runtime?.apiHealthy ? "text-emerald-300" : "text-rose-300"}>{opsStatus?.runtime?.apiHealthy ? "OK" : "Error"}</span></p>
            <p>Mongo: <span className={opsStatus?.runtime?.mongoConnected ? "text-emerald-300" : "text-rose-300"}>{opsStatus?.runtime?.mongoConnected ? "Conectado" : "Desconectado"}</span></p>
            <p>Cloudinary: <span className={opsStatus?.integrations?.cloudinaryConfigured ? "text-emerald-300" : "text-amber-300"}>{opsStatus?.integrations?.cloudinaryConfigured ? "Configurado" : "Pendiente"}</span></p>
            <p>SMTP: <span className={opsStatus?.integrations?.smtpConfigured ? "text-emerald-300" : "text-amber-300"}>{opsStatus?.integrations?.smtpConfigured ? "Configurado" : "Pendiente"}</span></p>
            <p>Importaciones última hora: <span className="text-white font-semibold">{opsStatus?.activity?.importsLastHour ?? 0}</span></p>
            <p>Descargas última hora: <span className="text-white font-semibold">{opsStatus?.activity?.downloadsLastHour ?? 0}</span></p>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[#122530] p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Validación rápida de rol</p>
          <p className="mt-2 text-sm text-[#c5d5de]">
            Rol actual: <span className="font-semibold text-white">{roleCheck?.roleCode || "-"}</span>
          </p>
          <p className="mt-1 text-sm text-[#c5d5de]">
            Cobertura de permisos esperados: <span className="font-semibold text-white">{roleCheck?.checks?.expectedCoveragePct ?? 0}%</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 ${roleCheck?.checks?.canAccessGestion ? "bg-emerald-900/30 text-emerald-300 border border-emerald-400/30" : "bg-slate-900/30 text-slate-300 border border-slate-400/30"}`}>Gestión</span>
            <span className={`rounded-full px-2 py-1 ${roleCheck?.checks?.canAccessEvaluacion ? "bg-emerald-900/30 text-emerald-300 border border-emerald-400/30" : "bg-slate-900/30 text-slate-300 border border-slate-400/30"}`}>Evaluación</span>
            <span className={`rounded-full px-2 py-1 ${roleCheck?.checks?.canAccessDatos ? "bg-emerald-900/30 text-emerald-300 border border-emerald-400/30" : "bg-slate-900/30 text-slate-300 border border-slate-400/30"}`}>Datos</span>
            <span className={`rounded-full px-2 py-1 ${roleCheck?.checks?.tenantScoped ? "bg-emerald-900/30 text-emerald-300 border border-emerald-400/30" : "bg-amber-900/30 text-amber-300 border border-amber-400/30"}`}>{roleCheck?.checks?.tenantScoped ? "Aislado por tenant" : "Global"}</span>
          </div>
          {roleCheck?.recommendations?.length ? (
            <p className="mt-3 text-xs text-[#9fb6c4]">{roleCheck.recommendations[0]}</p>
          ) : null}
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Modo auditoría de lanzamiento</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Checklist técnico en un clic</h3>
          </div>
          <button
            type="button"
            onClick={runLaunchAudit}
            disabled={launchAudit.running}
            className="rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {launchAudit.running ? "Auditando..." : "Ejecutar auditoría"}
          </button>
        </div>

        {launchAudit.done ? (
          <div className="mt-4">
            <p className="text-sm text-[#c5d5de]">
              Puntaje final:{" "}
              <span className={`font-bold ${launchAudit.score >= 85 ? "text-emerald-300" : launchAudit.score >= 65 ? "text-amber-300" : "text-rose-300"}`}>
                {launchAudit.score}%
              </span>
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {launchAudit.checks.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 text-sm ${item.ok ? "border-emerald-400/30 bg-emerald-900/20 text-emerald-200" : "border-rose-400/30 bg-rose-900/20 text-rose-200"}`}>
                  <p className="font-semibold">{item.id}</p>
                  <p className="text-xs opacity-90">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-[#1e3a8a]/35 bg-[#0f2230] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#9FB6C1]">Onboarding guiado</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Primeros 4 pasos para operar sin fricción</h2>
          </div>
          <span className="rounded-full border border-white/15 bg-[#122530] px-3 py-1 text-sm text-[#CFE0E8]">
            {completedSteps}/4 completados
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {onboardingSteps.map((step) => (
            <article key={step.id} className="rounded-xl border border-white/10 bg-[#122530] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-white">{step.title}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${step.done ? "bg-emerald-900/40 text-emerald-300 border border-emerald-400/30" : "bg-amber-900/40 text-amber-300 border border-amber-400/30"}`}>
                  {step.done ? "Completado" : "Pendiente"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#9fb6c4]">{step.detail}</p>
              <button
                type="button"
                onClick={() => setView(step.id)}
                className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
              >
                {step.actionLabel}
              </button>
            </article>
          ))}
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

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full rounded-xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-left text-sm font-semibold text-white"
        >
          {showAdvanced ? "Ocultar analitica avanzada" : "Mostrar analitica avanzada (patrones y prediccion)"}
        </button>
      </section>

      {showAdvanced ? (
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

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-xl font-semibold text-white">Simulador de inversion en capacitacion</h3>
        <p className="mt-1 text-[#9fb6c4]">Proyecta impacto en riesgo y desempeno antes de decidir presupuesto.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
    </div>
  );
}
