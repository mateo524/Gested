import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function formatDate(value) {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/audit", { token })
      .then(setLogs)
      .catch((error) => setMessage(error.message));
  }, [token]);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter((log) =>
      [log.accion, log.modulo, log.detalle]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [logs, query]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Trazabilidad Gested</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Auditoria de actividad</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Este modulo sirve para revisar acciones sensibles del sistema: cambios de usuarios,
          permisos, importaciones y ajustes operativos. Te ayuda a saber que paso, cuando paso y
          sobre que modulo se trabajo.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-slate-200 p-5">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Eventos</p>
            <p className="mt-3 text-4xl font-bold text-slate-950">{logs.length}</p>
            <p className="mt-2 text-sm text-slate-500">Ultimos movimientos registrados</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 p-5">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Control</p>
            <p className="mt-3 text-xl font-semibold text-slate-950">Acciones auditables</p>
            <p className="mt-2 text-sm text-slate-500">
              Usuarios, roles, parametros, empresas e importaciones.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 p-5">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Busqueda</p>
            <input
              className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Buscar por accion, modulo o detalle"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Linea de tiempo</h3>
        <p className="mt-1 text-slate-500">
          Cada registro te permite reconstruir una decision o cambio operativo.
        </p>

        {message ? <p className="mt-4 text-red-500">{message}</p> : null}

        <div className="mt-6 space-y-4">
          {filteredLogs.length ? (
            filteredLogs.map((log) => (
              <article key={log._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold capitalize">{log.accion}</p>
                    <p className="mt-1 text-sm uppercase tracking-[0.16em] text-slate-400">
                      {log.modulo}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <p className="mt-4 text-slate-600">{log.detalle || "Sin detalle adicional"}</p>
              </article>
            ))
          ) : (
            <p className="text-slate-500">No hay eventos para mostrar con ese filtro.</p>
          )}
        </div>
      </section>
    </div>
  );
}
