import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyFilters = {
  q: "",
  rol: "",
  databaseId: "",
};

export default function RecordsPage() {
  const { token, activeCompanyId } = useAuth();
  const [records, setRecords] = useState([]);
  const [options, setOptions] = useState({ roles: [], files: [] });
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

  useEffect(() => {
    apiFetch(`/records${queryString}`, { token })
      .then((data) => {
        setRecords(data.records || []);
        setOptions(data.filters || { roles: [], files: [] });
      })
      .catch((error) => setMessage(error.message));
  }, [token, activeCompanyId, queryString]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Lectura de base</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Registros importados</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Esta vista permite revisar los datos ya procesados, filtrar por rol, fuente o termino de
          busqueda y validar rapidamente si la carga quedo consistente.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-slate-500">Buscar</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre, email o rol"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <label className="min-w-44">
            <span className="mb-2 block text-sm text-slate-500">Rol</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.rol}
              onChange={(event) => setFilters({ ...filters, rol: event.target.value })}
            >
              <option value="">Todos</option>
              {options.roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-slate-500">Base</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.databaseId}
              onChange={(event) => setFilters({ ...filters, databaseId: event.target.value })}
            >
              <option value="">Todas</option>
              {options.files.map((file) => (
                <option key={file._id} value={file._id}>
                  {file.nombreVisible}
                </option>
              ))}
            </select>
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
            <h3 className="text-xl font-semibold">Vista operativa</h3>
            <p className="mt-1 text-slate-500">Muestra util para revisar lo que realmente quedo cargado.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
            {records.length} registros
          </span>
        </div>

        {message ? <p className="mt-4 text-red-500">{message}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                records.map((record) => (
                  <tr key={record._id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{record.nombreCompleto || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{record.rol || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{record.email || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan="3">
                    No hay registros para mostrar con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
