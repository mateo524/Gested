import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

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

  async function exportFilteredRecords() {
    try {
      const response = await fetch(`${apiUrl}/records/export${queryString}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo exportar la vista filtrada");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "registros-filtrados.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessage("Exportación filtrada generada");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#14b8a6]">Lectura de base</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Registros importados</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Esta vista permite revisar los datos ya procesados, filtrar por rol, fuente o término de
          búsqueda y validar rápidamente si la carga quedó consistente.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-[#9fb6c4]">Buscar</span>
            <input
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Nombre, email o rol"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <label className="min-w-44">
            <span className="mb-2 block text-sm text-[#9fb6c4]">Rol</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
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
            <span className="mb-2 block text-sm text-[#9fb6c4]">Base</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
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
            className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-sm font-medium text-[#c5d5de]"
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Vista operativa</h3>
            <p className="mt-1 text-sm text-[#9fb6c4]">Muestra útil para revisar lo que realmente quedó cargado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#1e293b] px-4 py-2 text-sm text-[#b8c9d4]">
              {records.length} registros
            </span>
            <button
              type="button"
              onClick={exportFilteredRecords}
              className="rounded-2xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a]"
            >
              Exportar vista filtrada
            </button>
          </div>
        </div>

        {message ? <p className="mt-4 text-rose-300">{message}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[#9fb6c4]">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                records.map((record) => (
                  <tr key={record._id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white">{record.nombreCompleto || "-"}</td>
                    <td className="px-4 py-3 text-[#9fb6c4]">{record.rol || "-"}</td>
                    <td className="px-4 py-3 text-[#9fb6c4]">{record.email || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-[#7f99a8]" colSpan="3">
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
