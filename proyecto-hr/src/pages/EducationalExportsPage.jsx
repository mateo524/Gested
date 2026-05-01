import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiUrl, apiFetch } from "../lib/api";

function SummaryCard({ label, value, hint }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <h3 className="mt-4 text-4xl font-bold text-slate-950">{value}</h3>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

const datasetLabels = {
  employees: "Empleados",
  evaluations: "Evaluaciones",
  metrics: "Metricas",
  developmentPlans: "Planes de desarrollo",
};

export default function EducationalExportsPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [dataset, setDataset] = useState("employees");
  const [datasetData, setDatasetData] = useState({ items: [], canDownload: false, policy: null });
  const [filters, setFilters] = useState({
    schoolId: "",
    area: "",
    cargo: "",
    estado: "",
    tipo: "",
  });
  const [message, setMessage] = useState("");
  const [importDataset, setImportDataset] = useState("employees");
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);

  async function loadOverview() {
    const data = await apiFetch("/education-exports/overview", { token });
    setOverview(data);
    if (!filters.schoolId && data.schools?.[0]?._id) {
      setFilters((current) => ({ ...current, schoolId: current.schoolId || data.schools[0]._id }));
    }
  }

  async function loadDataset() {
    const data = await apiFetch(`/education-exports/dataset/${dataset}${queryString}`, { token });
    setDatasetData(data);
  }

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    loadDataset().catch((error) => setMessage(error.message));
  }, [token, dataset, queryString]);

  async function downloadDataset(format) {
    try {
      const suffix = queryString ? `${queryString}&format=${format}` : `?format=${format}`;
      const response = await fetch(`${apiUrl}/education-exports/download/${dataset}${suffix}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(localStorage.getItem("active_company_id")
            ? { "X-Company-Id": localStorage.getItem("active_company_id") }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo generar la descarga");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${dataset}.${format === "xlsx" ? "xlsx" : "csv"}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessage("Descarga generada correctamente");
      await loadOverview();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function importDatasetFile() {
    if (!importFile) {
      setMessage("Selecciona un archivo para importar");
      return;
    }

    try {
      setIsImporting(true);
      setMessage("");
      setImportResult(null);
      const body = new FormData();
      body.append("file", importFile);
      if (filters.schoolId) body.append("schoolId", filters.schoolId);

      const data = await apiFetch(`/education-exports/import/${importDataset}`, {
        method: "POST",
        token,
        body,
      });

      setImportResult(data);
      setMessage("Importacion completada");
      setImportFile(null);
      await Promise.all([loadOverview(), loadDataset()]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Informacion institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Bases y Descargas</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Consulta y descarga empleados, evaluaciones, metricas y planes de desarrollo con filtros
          y permisos especificos para cada rol.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-lg font-semibold text-slate-950">Donde cargar bases y usuarios</h4>
        <p className="mt-2 text-sm text-slate-600">
          Usa esta pantalla para importar empleados, metricas y ciclos con Excel/CSV y luego descargar
          resultados. El superadmin puede auditar todo en Archivo central.
        </p>
      </section>

      {(user?.isSuperAdmin || user?.permisos?.includes("manage_employees")) ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-slate-950">Importar base de evaluacion</h4>
          <p className="mt-1 text-sm text-slate-600">
            Carga archivo para crear/actualizar empleados, metricas o ciclos de evaluacion.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              className="rounded-2xl border border-slate-300 px-4 py-3"
              value={importDataset}
              onChange={(event) => setImportDataset(event.target.value)}
            >
              <option value="employees">Empleados</option>
              <option value="metrics">Metricas</option>
              <option value="cycles">Ciclos</option>
            </select>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            />
            <button
              type="button"
              onClick={importDatasetFile}
              disabled={isImporting}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isImporting ? "Importando..." : "Importar base"}
            </button>
          </div>
          {importResult ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>Total filas: {importResult.total}</p>
              <p>Creados: {importResult.created}</p>
              <p>Actualizados: {importResult.updated}</p>
              <p>Errores: {importResult.errors?.length || 0}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {overview ? (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Empleados" value={overview.summary.employees} hint="Base institucional" />
          <SummaryCard label="Evaluaciones" value={overview.summary.evaluations} hint="Cargas registradas" />
          <SummaryCard label="Metricas" value={overview.summary.metrics} hint="Indicadores activos" />
          <SummaryCard label="Planes" value={overview.summary.developmentPlans} hint="Seguimientos en curso" />
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[0.22fr_0.24fr_0.18fr_0.18fr_0.18fr]">
          <select
            className="rounded-2xl border border-slate-300 px-4 py-3"
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
          >
            {Object.entries(datasetLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-slate-300 px-4 py-3"
            value={filters.schoolId}
            onChange={(event) => setFilters({ ...filters, schoolId: event.target.value })}
          >
            <option value="">Todos los colegios</option>
            {(overview?.schools || []).map((school) => (
              <option key={school._id} value={school._id}>
                {school.nombre}
              </option>
            ))}
          </select>

          {dataset === "employees" ? (
            <>
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Area"
                value={filters.area}
                onChange={(event) => setFilters({ ...filters, area: event.target.value })}
              />
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Cargo"
                value={filters.cargo}
                onChange={(event) => setFilters({ ...filters, cargo: event.target.value })}
              />
            </>
          ) : null}

          {dataset === "evaluations" ? (
            <>
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={filters.estado}
                onChange={(event) => setFilters({ ...filters, estado: event.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="REVISADA">Revisada</option>
                <option value="CERRADA">Cerrada</option>
              </select>
              <select
                className="rounded-2xl border border-slate-300 px-4 py-3"
                value={filters.tipo}
                onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}
              >
                <option value="">Todos los tipos</option>
                <option value="AUTOEVALUACION">Autoevaluacion</option>
                <option value="JEFATURA">Jefatura</option>
                <option value="FINAL">Final</option>
              </select>
            </>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => downloadDataset("csv")}
              disabled={!datasetData.canDownload}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => downloadDataset("xlsx")}
              disabled={!datasetData.canDownload}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Excel
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xl font-semibold">{datasetLabels[dataset]}</h4>
              <p className="mt-1 text-slate-500">Vista previa limitada segun tu rol y permisos.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
              {datasetData.items?.length || 0} registros
            </span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {dataset === "employees" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Apellido</th>
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Cargo</th>
                      <th className="px-4 py-3 font-medium">Area</th>
                    </>
                  ) : null}
                  {dataset === "evaluations" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Resultado</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </>
                  ) : null}
                  {dataset === "metrics" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Ponderacion</th>
                      <th className="px-4 py-3 font-medium">Activa</th>
                    </>
                  ) : null}
                  {dataset === "developmentPlans" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Aspecto</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Seguimiento</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {(datasetData.items || []).map((item) => (
                  <tr key={item._id} className="border-b border-slate-100">
                    {dataset === "employees" ? (
                      <>
                        <td className="px-4 py-3 text-slate-900">{item.apellido || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.nombre || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.cargo || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.area || "-"}</td>
                      </>
                    ) : null}
                    {dataset === "evaluations" ? (
                      <>
                        <td className="px-4 py-3 text-slate-900">{item.tipo || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.estado || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.resultadoFinal ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                      </>
                    ) : null}
                    {dataset === "metrics" ? (
                      <>
                        <td className="px-4 py-3 text-slate-900">{item.nombre || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.ponderacion ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.activa ? "Si" : "No"}</td>
                      </>
                    ) : null}
                    {dataset === "developmentPlans" ? (
                      <>
                        <td className="px-4 py-3 text-slate-900">{item.aspectoDesarrollar || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.estado || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.fechaSeguimiento)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Historial de descargas</h4>
          <p className="mt-1 text-slate-500">Cada descarga queda registrada para trazabilidad y control.</p>

          <div className="mt-6 space-y-4">
            {(overview?.recentDownloads || []).length ? (
              overview.recentDownloads.map((download) => (
                <article key={download._id} className="rounded-[1.75rem] border border-slate-200 p-4">
                  <p className="font-semibold text-slate-950">
                    {datasetLabels[download.exportType] || download.exportType}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{download.role}</p>
                  <p className="mt-2 text-sm text-slate-600">{formatDate(download.downloadedAt)}</p>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavia no hay descargas registradas.</p>
            )}
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
