import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export default function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/dashboard/summary", { token })
      .then(setSummary)
      .catch((error) => setMessage(error.message));
  }, [token]);

  if (message) {
    return <p className="text-red-500">{message}</p>;
  }

  if (!summary) {
    return <p className="text-slate-500">Cargando dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-500">
            {summary.company.nombreVisible}
          </p>
          <h3 className="mt-3 text-4xl font-bold text-slate-950">
            Panel operativo de RRHH
          </h3>
          <p className="mt-3 max-w-2xl text-slate-500">
            Estado consolidado de usuarios, seguridad, archivos y operación diaria
            para tu empresa.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Seguridad
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-slate-400">Eventos auditados</p>
              <p className="text-3xl font-bold">{summary.security.totalAuditEvents}</p>
            </div>
            <div>
              <p className="text-slate-400">Permisos en sesión</p>
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
          <article
            key={card.label}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-slate-500">{card.label}</p>
            <h3 className="mt-3 text-4xl font-bold">{card.value}</h3>
            <p className="mt-2 text-sm text-slate-400">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Actividad reciente</h3>
        <p className="mt-1 text-slate-500">
          Cambios relevantes registrados por la auditoría del sistema.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
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
            <p className="text-slate-500">Todavía no hay eventos auditados.</p>
          )}
        </div>
      </section>
    </div>
  );
}
