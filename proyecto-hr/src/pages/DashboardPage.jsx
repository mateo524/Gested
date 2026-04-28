import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function SummaryCard({ label, value, hint }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-slate-500">{label}</p>
      <h3 className="mt-3 text-4xl font-bold">{value}</h3>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
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

  if (message) {
    return <p className="text-red-500">{message}</p>;
  }

  if (!summary) {
    return <p className="text-slate-500">Cargando panel...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-500">
            {summary.company.nombreVisible}
          </p>
          <h3 className="mt-3 text-4xl font-bold text-slate-950">
            Gested para {activeCompany?.nombre || summary.company.legalName}
          </h3>
          <p className="mt-3 max-w-2xl text-slate-500">
            Informacion consolidada, accesos protegidos y lectura ejecutiva para tomar decisiones
            con mas claridad en la empresa activa.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Control y seguridad</p>
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-slate-400">Eventos auditados</p>
              <p className="text-3xl font-bold">{summary.security.totalAuditEvents}</p>
            </div>
            <div>
              <p className="text-slate-400">Permisos en sesion</p>
              <p className="text-3xl font-bold">{summary.security.permissionsInSession}</p>
            </div>
            <div>
              <p className="text-slate-400">Vigencia del token</p>
              <p className="text-xl font-semibold">{summary.security.tokenWindow}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summary.cards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-xl font-semibold">Distribucion por rol</h3>
            <p className="mt-1 text-slate-500">
              Lectura rapida del peso operativo de cada perfil dentro de la base activa.
            </p>
          </div>

          <div className="mt-6 h-80">
            {summary.charts.roleDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.charts.roleDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" />
                  <YAxis allowDecimals={false} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-[1.75rem] bg-slate-50 text-slate-500">
                Todavia no hay datos suficientes para graficar.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-xl font-semibold">Evolucion de importaciones</h3>
            <p className="mt-1 text-slate-500">
              Muestra cuando se fueron cargando bases para la empresa en el tiempo.
            </p>
          </div>

          <div className="mt-6 h-80">
            {summary.charts.importTimeline.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.charts.importTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" />
                  <YAxis allowDecimals={false} stroke="#64748b" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0f172a"
                    fill="#99f6e4"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-[1.75rem] bg-slate-50 text-slate-500">
                Aun no hay historial de cargas para mostrar.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Bases con mas registros</h3>
          <p className="mt-1 text-slate-500">
            Ranking de archivos que hoy concentran mas volumen dentro de la empresa.
          </p>

          <div className="mt-6 space-y-4">
            {summary.charts.fileRanking.length ? (
              summary.charts.fileRanking.map((file, index) => (
                <div
                  key={`${file.label}-${index}`}
                  className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 px-4 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{file.label}</p>
                    <p className="text-sm text-slate-500">Base operativa</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                    {file.value} registros
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Todavia no hay bases cargadas.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Actividad reciente</h3>
          <p className="mt-1 text-slate-500">
            Cambios relevantes registrados para esta empresa dentro del sistema.
          </p>

          <div className="mt-6 grid gap-4">
            {summary.latestAudit.length ? (
              summary.latestAudit.map((log) => (
                <div key={log._id} className="rounded-3xl border border-slate-200 p-5">
                  <p className="font-semibold capitalize">{log.accion}</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.15em] text-slate-400">
                    {log.modulo}
                  </p>
                  <p className="mt-3 text-slate-600">{log.detalle}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Todavia no hay eventos auditados.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
