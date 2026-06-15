import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const RECORD_TYPES = [
  { value: "Alta",         label: "Alta",         color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-300/20" },
  { value: "Baja",         label: "Baja",         color: "text-rose-300",    bg: "bg-rose-500/10 border-rose-300/20" },
  { value: "Licencia",     label: "Licencia",     color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-300/20" },
  { value: "Modificación", label: "Modificación", color: "text-sky-300",     bg: "bg-sky-500/10 border-sky-300/20" },
];

const emptyFilters = {
  q: "",
  rol: "",
  databaseId: "",
  tipo: "",
};

const PAGE_SIZE = 50;

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

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

function TypeBadge({ tipo }) {
  const def = RECORD_TYPES.find((t) => t.value === tipo);
  if (!def) return <span className="text-[#9fb6c4]">{tipo || "-"}</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${def.bg} ${def.color}`}>
      {def.label}
    </span>
  );
}

export default function RecordsPage() {
  const { token, activeCompanyId } = useAuth();
  const [records, setRecords]         = useState([]);
  const [typeSummary, setTypeSummary] = useState({});
  const [options, setOptions]         = useState({ roles: [], files: [] });
  const [filters, setFilters]         = useState(emptyFilters);
  const [message, setMessage]         = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);

  const [sortBy, setSortBy]   = useState("createdAt");
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
        setTypeSummary(data.typeSummary && typeof data.typeSummary === "object" ? data.typeSummary : {});
      })
      .catch((error) => { setMessageIsError(true); setMessage(error.message); });
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
      const url  = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href     = url;
      anchor.download = "registros-filtrados.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessageIsError(false);
      setMessage("Exportación descargada correctamente.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(error.message);
    }
  }

  const hasSummary = Object.keys(typeSummary).length > 0;

  const columns = [
    { key: "nombreCompleto", label: "Nombre" },
    { key: "tipo",           label: "Tipo" },
    { key: "rol",            label: "Rol" },
    { key: "email",          label: "Email" },
    { key: "createdAt",      label: "Fecha" },
  ];

  const hasActiveFilter = filters.q || filters.rol || filters.databaseId || filters.tipo;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#14b8a6]">Historial de novedades</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Registros de empleados</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Seguimiento de altas, bajas, licencias y modificaciones. Filtrá por tipo de novedad, rol o
          fuente para validar rápidamente la consistencia de los datos cargados.
        </p>
      </section>

      {/* Summary cards por tipo — se ocultan si el backend aún no devuelve typeSummary */}
      {hasSummary && (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {RECORD_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, tipo: prev.tipo === t.value ? "" : t.value }))
              }
              className={`rounded-2xl border p-5 text-left transition-all ${
                filters.tipo === t.value
                  ? `${t.bg} ${t.color} border-current`
                  : "border-white/10 bg-[#122530] hover:bg-white/5"
              }`}
            >
              <p className={`text-2xl font-bold ${filters.tipo === t.value ? t.color : "text-white"}`}>
                {typeSummary[t.value] ?? 0}
              </p>
              <p className={`mt-1 text-sm ${filters.tipo === t.value ? t.color : "text-[#9fb6c4]"}`}>
                {t.label}
              </p>
            </button>
          ))}
        </section>
      )}

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
            <span className="mb-2 block text-sm text-[#9fb6c4]">Tipo de novedad</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={filters.tipo}
              onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}
            >
              <option value="">Todos</option>
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
              {total} {total === 1 ? "registro" : "registros"}
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

        {message ? (
          messageIsError ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-500/8 px-4 py-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 shrink-0 text-rose-300 mt-0.5">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-rose-200">Error al cargar registros</p>
                <p className="mt-0.5 text-xs text-rose-300/80">{message}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-500/8 px-4 py-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 shrink-0 text-emerald-300">
                <path d="M5 13l4 4L19 7"/>
              </svg>
              <p className="text-sm text-emerald-200">{message}</p>
            </div>
          )
        ) : null}

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
              {Array.isArray(records) && records.length > 0 ? (
                records.map((record) => (
                  <tr key={record._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white">{record.nombreCompleto || "-"}</td>
                    <td className="px-4 py-3"><TypeBadge tipo={record.tipo} /></td>
                    <td className="px-4 py-3 text-[#9fb6c4]">{record.rol || "-"}</td>
                    <td className="px-4 py-3 text-[#9fb6c4]">{record.email || "-"}</td>
                    <td className="px-4 py-3 text-[#9fb6c4] tabular-nums">{formatDate(record.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#7a9aaa]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {hasActiveFilter
                          ? `Sin resultados${filters.tipo ? ` para el tipo "${filters.tipo}"` : ""}`
                          : "Sin registros de novedades aún"}
                      </p>
                      <p className="max-w-xs text-xs text-[#7a9aaa]">
                        {hasActiveFilter
                          ? "Ningún registro coincide con los filtros activos. Probá ajustando el tipo de novedad, el rol, la base o el término de búsqueda."
                          : "Los registros de altas, bajas, licencias y modificaciones aparecen aquí una vez que se completa una importación masiva desde la sección Carga masiva."}
                      </p>
                      {hasActiveFilter && (
                        <button
                          type="button"
                          onClick={() => setFilters(emptyFilters)}
                          className="mt-1 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-[#c5d5de] transition hover:bg-white/5"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
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
