import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

function KpiCard({ title, value, hint }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { token, activeCompany } = useAuth();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/dashboard/summary", { token })
      .then(setSummary)
      .catch((error) => setMessage(error.message));
  }, [token, activeCompany?._id]);

  const primaryDecision = useMemo(() => {
    const area = summary?.decisionInsights?.weakestAreas?.[0];
    if (!area) return "Sin datos suficientes para recomendar inversion en capacitacion.";
    return `Prioriza inversion en ${area.label}: promedio ${area.value} sobre ${area.employees} colaboradores evaluados.`;
  }, [summary]);

  async function downloadDecisionReport() {
    try {
      const response = await fetch(`${apiUrl}/dashboard/decision-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("No se pudo descargar el reporte");
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

  if (message) return <p className="text-red-400">{message}</p>;
  if (!summary) return <p className="text-slate-400">Cargando panel de decisiones...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-emerald-300/40 bg-emerald-500/10 p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Vista principal</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Decisiones recomendadas</h2>
        <p className="mt-3 text-lg text-emerald-100">{primaryDecision}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadDecisionReport}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Descargar reporte de decisiones
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Promedio general"
          value={summary.cards?.[3]?.value || "0.00"}
          hint={summary.cards?.[3]?.hint || "Sin datos"}
        />
        <KpiCard
          title="Evaluaciones pendientes"
          value={summary.educational?.pendingEvaluations || 0}
          hint="Evaluaciones en BORRADOR o ENVIADA"
        />
        <KpiCard
          title="Empleados en riesgo"
          value={summary.decisionInsights?.riskRanking?.length || 0}
          hint="Colaboradores con score mas bajo"
        />
        <KpiCard
          title="Competencias criticas"
          value={
            summary.decisionInsights?.trainingRecommendations?.filter((item) => item.priority === "ALTA").length || 0
          }
          hint="Capacitacion urgente recomendada"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">Capacitacion recomendada</h3>
          <p className="mt-1 text-slate-500">Ordenada por menor puntaje promedio de competencia.</p>
          <div className="mt-4 space-y-3">
            {summary.decisionInsights?.trainingRecommendations?.length ? (
              summary.decisionInsights.trainingRecommendations.map((item) => (
                <div key={item.competencia} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.competencia}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.action}</p>
                  <p className="mt-1 text-xs text-slate-500">Score promedio: {item.avgScore}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Sin datos para recomendaciones por competencia.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">Ranking de empleados en riesgo</h3>
          <p className="mt-1 text-slate-500">Top de colaboradores a intervenir primero.</p>
          <div className="mt-4 space-y-2">
            {summary.decisionInsights?.riskRanking?.length ? (
              summary.decisionInsights.riskRanking.map((item, idx) => (
                <div
                  key={`${item.employeeId}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {item.area} - {item.cargo}
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    {item.avgScore}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Sin datos para ranking de riesgo.</p>
            )}
          </div>
        </div>
      </section>

      {summary.alerts ? (
        <section
          className={`rounded-2xl border p-4 ${
            summary.alerts.isLow
              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          <p className="text-sm font-semibold">
            {summary.alerts.isLow ? "Alerta de calidad de datos" : "Calidad de datos estable"}
          </p>
          <p className="mt-1 text-sm">
            Score {summary.alerts.score ?? "-"} - Sin email: {summary.alerts.missingEmail ?? 0} - Duplicados:{" "}
            {summary.alerts.duplicates ?? 0}
          </p>
        </section>
      ) : null}
    </div>
  );
}
