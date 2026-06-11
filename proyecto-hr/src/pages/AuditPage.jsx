import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function formatDate(value) {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const emptyFilters = {
  q: "",
  modulo: "",
  accion: "",
  userId: "",
  from: "",
  to: "",
};

export default function AuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [options, setOptions] = useState({ modules: [], actions: [], users: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [message, setMessage] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const built = params.toString();
    return built ? `?${built}` : "";
  }, [filters]);

  const loadAudit = useCallback(async () => {
    const data = await apiFetch(`/audit${queryString}`, { token });
    setLogs(data.logs || []);
    setOptions(data.filters || { modules: [], actions: [], users: [] });
  }, [queryString, token]);

  useEffect(() => {
    loadAudit().catch((error) => setMessage(error.message));
  }, [loadAudit]);

  const inputCls = "w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white placeholder-[#5a7a8e] focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition";
  const selectCls = "w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition";
  const labelCls = "mb-1.5 block text-xs font-medium text-[#8fa9b7]";

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="pf-card-premium rounded-2xl border border-white/[0.07] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Panel de trazabilidad</p>
            </div>
            <h3 className="mt-2 text-2xl font-bold text-white">Seguimiento de actividad</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#7a9aaa]">
              Reconstruí cambios sensibles: usuarios, permisos, empresas, parámetros e importaciones.
              Control interno y respuesta rápida ante dudas de una cuenta cliente.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#14b8a6]/20 bg-[#14b8a6]/8 px-4 py-2 text-center">
            <p className="text-xl font-bold text-[#14b8a6]">{logs.length}</p>
            <p className="text-[10px] text-[#14b8a6]/70 uppercase tracking-wide">eventos</p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="pf-card rounded-2xl border border-white/[0.07] p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8fa9b7]">Filtros</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1">
            <span className={labelCls}>Buscar</span>
            <input
              className={inputCls}
              placeholder="Acción, módulo o detalle"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <label className="min-w-40">
            <span className={labelCls}>Módulo</span>
            <select
              className={selectCls}
              value={filters.modulo}
              onChange={(event) => setFilters({ ...filters, modulo: event.target.value })}
            >
              <option value="">Todos</option>
              {(Array.isArray(options?.modules) ? options.modules : []).map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </label>

          <label className="min-w-40">
            <span className={labelCls}>Acción</span>
            <select
              className={selectCls}
              value={filters.accion}
              onChange={(event) => setFilters({ ...filters, accion: event.target.value })}
            >
              <option value="">Todas</option>
              {(Array.isArray(options?.actions) ? options.actions : []).map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </label>

          <label className="min-w-48 flex-1">
            <span className={labelCls}>Usuario</span>
            <select
              className={selectCls}
              value={filters.userId}
              onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
            >
              <option value="">Todos</option>
              {(Array.isArray(options?.users) ? options.users : []).map((user) => (
                <option key={user._id} value={user._id}>{user.nombre} — {user.email}</option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelCls}>Desde</span>
            <input
              type="date"
              className={inputCls}
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            />
          </label>

          <label>
            <span className={labelCls}>Hasta</span>
            <input
              type="date"
              className={inputCls}
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#9fb6c4] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            Limpiar
          </button>
        </div>
      </section>

      {/* Timeline */}
      <section className="pf-card rounded-2xl border border-white/[0.07] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">Línea de tiempo</h3>
            <p className="mt-0.5 text-xs text-[#7a9aaa]">Eventos filtrados · seguimiento operativo</p>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">{message}</p>
        ) : null}

        <div className="mt-5 space-y-3">
          {logs.length ? (
            logs.map((log) => (
              <article
                key={log._id}
                className="group rounded-xl border border-white/[0.06] bg-[#0c1e28]/60 p-4 transition hover:border-[#14b8a6]/20 hover:bg-[#0f2233]/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#14b8a6] shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
                    <div>
                      <p className="text-sm font-semibold capitalize text-white">{log.accion}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-[#14b8a6]/20 bg-[#14b8a6]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#14b8a6]">
                          {log.modulo}
                        </span>
                        {log.actor ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-[#9fb6c4]">
                            {log.actor.nombre}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-500/8 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
                {log.detalle ? (
                  <p className="mt-3 border-t border-white/[0.05] pt-3 text-xs leading-relaxed text-[#8fa9b7]">
                    {log.detalle}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[#5a7a8e]">
                  <path strokeLinecap="round" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 3h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#7a9aaa]">Sin eventos con este filtro</p>
              <p className="text-xs text-[#5a7a8e]">Ajustá los parámetros para ver más resultados</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
