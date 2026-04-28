import { useEffect, useMemo, useState } from "react";
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

  async function loadAudit() {
    const data = await apiFetch(`/audit${queryString}`, { token });
    setLogs(data.logs || []);
    setOptions(data.filters || { modules: [], actions: [], users: [] });
  }

  useEffect(() => {
    loadAudit().catch((error) => setMessage(error.message));
  }, [token, queryString]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Panel de trazabilidad</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Seguimiento de actividad</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Este panel te ayuda a reconstruir cambios sensibles del sistema: usuarios, permisos,
          empresas, parametros e importaciones. Sirve para control interno, revision operativa y
          respuesta rapida ante dudas de una cuenta cliente.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-slate-500">Buscar</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Accion, modulo o detalle"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <label className="min-w-44">
            <span className="mb-2 block text-sm text-slate-500">Modulo</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.modulo}
              onChange={(event) => setFilters({ ...filters, modulo: event.target.value })}
            >
              <option value="">Todos</option>
              {options.modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-44">
            <span className="mb-2 block text-sm text-slate-500">Accion</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.accion}
              onChange={(event) => setFilters({ ...filters, accion: event.target.value })}
            >
              <option value="">Todas</option>
              {options.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-slate-500">Usuario</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.userId}
              onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
            >
              <option value="">Todos</option>
              {options.users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.nombre} - {user.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-500">Desde</span>
            <input
              type="date"
              className="rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-500">Hasta</span>
            <input
              type="date"
              className="rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium"
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Eventos registrados</h3>
            <p className="mt-1 text-slate-500">Linea de tiempo filtrable para seguimiento operativo.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
            {logs.length} eventos
          </span>
        </div>

        {message ? <p className="mt-4 text-red-500">{message}</p> : null}

        <div className="mt-6 space-y-4">
          {logs.length ? (
            logs.map((log) => (
              <article key={log._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold capitalize text-slate-950">{log.accion}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{log.modulo}</span>
                      {log.actor ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {log.actor.nombre}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <p className="mt-4 text-slate-600">{log.detalle || "Sin detalle adicional"}</p>
              </article>
            ))
          ) : (
            <p className="text-slate-500">No hay eventos para mostrar con este filtro.</p>
          )}
        </div>
      </section>
    </div>
  );
}
