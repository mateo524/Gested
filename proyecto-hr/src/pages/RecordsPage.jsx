import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const emptyFilters = {
  q: "",
  rol: "",
  databaseId: "",
};

const PAGE_SIZE = 50;

function SortIcon({ active, dir }) {
  if (!active) {
    return (
      <svg className="inline ml-1 opacity-30" width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
        <path d="M5 0L9.33 5H0.67L5 0ZM5 12L0.67 7H9.33L5 12Z" />
      </svg>
    );
  }
  if (dir === "asc") {
    return (
      <svg className="inline ml-1 text-[#14b8a6]" width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
        <path d="M5 0L9.33 5H0.67L5 0Z" />
        <path d="M5 12L0.67 7H9.33L5 12Z" opacity="0.3" />
      </svg>
    );
  }
  return (
    <svg className="inline ml-1 text-[#14b8a6]" width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
      <path d="M5 0L9.33 5H0.67L5 0Z" opacity="0.3" />
      <path d="M5 12L0.67 7H9.33L5 12Z" />
    </svg>
  );
}

export default function RecordsPage() {
  const { token, activeCompanyId } = useAuth();
  const [records, setRecords] = useState([]);
  const [options, setOptions] = useState({ roles: [], files: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [message, setMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", String(currentPage));
    params.set("limit", String(PAGE_SIZE));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    return `?${params.toString()}`;
  }, [filters, currentPage, sortBy, sortDir]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    apiFetch(`/records${queryString}`, { token })
      .then((data) => {
        setRecords(data.records || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setOptions(data.filters || { roles: [], files: [] });
      })
      .catch((error) => setMessage(error.message));
  }, [token, activeCompanyId, queryString]);

  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const built = params.toString();
    return built ? `?${built}` : "";
  }, [filters]);

  async function exportFilteredRecords() {
    try {
      const response = await fetch(`${apiUrl}/records/export${exportQueryString}`, {
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

  const columns = [
    { key: "nombreCompleto", label: "Nombre" },
    { key: "rol", label: "Rol" },
    { key: "email", label: "Email" },
  ];

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
              {Array.isArray(options.roles) && options.roles.map((role) => (
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
              {Array.isArray(options.files) && options.files.map((file) => (
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
              {total} registros
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
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon active={sortBy === col.key} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(records) && records.length ? (
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

        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#9fb6c4]">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-[#c5d5de] disabled:opacity-30"
              >
                {/* double left arrow */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M7 2L2 7l5 5M12 2L7 7l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-[#c5d5de] disabled:opacity-30"
              >
                {/* left arrow */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2L4 7l5 5"/>
                </svg>
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-[#14b8a6] text-[#0f172a]"
                        : "border border-white/15 bg-[#0f1f28] text-[#c5d5de] hover:bg-white/10"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-[#c5d5de] disabled:opacity-30"
              >
                {/* right arrow */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 2l5 5-5 5"/>
                </svg>
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-[#c5d5de] disabled:opacity-30"
              >
                {/* double right arrow */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2l5 5-5 5M7 2l5 5-5 5"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
