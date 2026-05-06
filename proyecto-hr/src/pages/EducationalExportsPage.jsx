import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const datasetLabels = {
  employees: "Empleados",
  evaluations: "Evaluaciones",
  metrics: "Indicadores",
  developmentPlans: "Planes",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default function EducationalExportsPage() {
  const { token, user } = useAuth();
  const canImport =
    user?.isSuperAdmin ||
    user?.permisos?.includes("manage_employees") ||
    user?.permisos?.includes("manage_metrics") ||
    user?.permisos?.includes("manage_evaluation_cycles");

  const [overview, setOverview] = useState(null);
  const [dataset, setDataset] = useState("employees");
  const [datasetData, setDatasetData] = useState({ items: [], canDownload: false });
  const [filters, setFilters] = useState({ schoolId: "", area: "", cargo: "", estado: "", tipo: "" });
  const [message, setMessage] = useState("");

  const [importDataset, setImportDataset] = useState("auto");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [editableErrors, setEditableErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importJobs, setImportJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);

  async function loadOverview() {
    const data = await apiFetch("/education-exports/overview", { token });
    setOverview(data);
    if (!filters.schoolId && data.schools?.[0]?._id) {
      setFilters((prev) => ({ ...prev, schoolId: prev.schoolId || data.schools[0]._id }));
    }
  }

  async function loadDataset() {
    const data = await apiFetch(`/education-exports/dataset/${dataset}${queryString}`, { token });
    setDatasetData(data);
  }

  async function loadImportJobs() {
    const data = await apiFetch("/education-exports/import-jobs", { token });
    setImportJobs(data.items || []);
  }

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
    loadImportJobs().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadDataset().catch((error) => setMessage(error.message));
  }, [dataset, queryString]);

  async function downloadDataset(format) {
    try {
      const suffix = queryString ? `${queryString}&format=${format}` : `?format=${format}`;
      const response = await fetch(`${apiUrl}/education-exports/download/${dataset}${suffix}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("No se pudo generar la descarga.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${dataset}.${format === "xlsx" ? "xlsx" : "csv"}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessage("Descarga generada.");
      await loadOverview();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function previewImport() {
    if (!importFile) return setMessage("Selecciona un archivo.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      setIsImporting(true);
      setMessage("");
      const body = new FormData();
      body.append("file", importFile);
      body.append("dataset", importDataset);
      if (filters.schoolId) body.append("schoolId", filters.schoolId);
      const data = await apiFetch("/education-exports/import/preview", {
        method: "POST",
        token,
        body,
        signal: controller.signal,
      });
      setImportPreview(data);
      if (data.importJobId) {
        apiFetch(`/education-exports/import-jobs/${data.importJobId}`, { token })
          .then((detail) => setSelectedJob(detail.job || null))
          .catch(() => setSelectedJob(null));
      }
      setEditableErrors((data.sampleErrors || []).map((item) => ({ ...item, normalized: { ...(item.normalized || {}) } })));
      setImportResult(null);
      await loadImportJobs();
    } catch (error) {
      setMessage(error.name === "AbortError" ? "La validacion demoro demasiado." : error.message);
      setImportPreview(null);
    } finally {
      clearTimeout(timeout);
      setIsImporting(false);
    }
  }

  async function confirmImport() {
    if (!importPreview?.previewToken) return;
    try {
      setIsImporting(true);
      const data = await apiFetch("/education-exports/import/confirm", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken: importPreview.previewToken,
          correctedRows: editableErrors.map((item) => item.normalized || {}),
        }),
      });
      setImportResult(data);
      setImportPreview(null);
      setImportFile(null);
      setMessage("Importacion confirmada.");
      await Promise.all([loadOverview(), loadDataset(), loadImportJobs()]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsImporting(false);
    }
  }

  function updateErrorField(index, field, value) {
    setEditableErrors((prev) =>
      prev.map((item, i) => (i === index ? { ...item, normalized: { ...(item.normalized || {}), [field]: value } } : item))
    );
  }

  function getEditableFields() {
    if (importPreview?.datasetDetected === "employees") return ["apellido", "nombre", "email", "cargo", "area"];
    if (importPreview?.datasetDetected === "metrics") return ["competencia", "nombre", "ponderacion", "descripcion"];
    if (importPreview?.datasetDetected === "cycles") return ["anio", "periodo", "etapa", "estado", "fechaInicio", "fechaFin"];
    if (importPreview?.datasetDetected === "roles") return ["nombre"];
    return [];
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-2xl font-bold text-white">Cargas y descargas</h3>
        <p className="mt-2 text-[#9fb6c4]">Usa este flujo: subir, validar y confirmar.</p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 space-y-4">
        <h4 className="text-lg font-semibold text-white">Subida de datos</h4>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">Paso 1: Subir archivo</span>
          <span className={`rounded-full px-3 py-1 text-xs ${importPreview ? "border border-[#22c55e]/40 bg-[#123224] text-[#8be6ac]" : "border border-white/20 bg-[#0f1f28] text-[#c5d5de]"}`}>Paso 2: Validar filas</span>
          <span className={`rounded-full px-3 py-1 text-xs ${importResult ? "border border-[#22c55e]/40 bg-[#123224] text-[#8be6ac]" : "border border-white/20 bg-[#0f1f28] text-[#c5d5de]"}`}>Paso 3: Confirmar</span>
        </div>

        {!canImport ? <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Tu rol no tiene permiso para importar.</div> : null}
        {message ? <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{message}</div> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={importDataset} onChange={(e) => setImportDataset(e.target.value)}>
            <option value="auto">Auto detectar</option>
            <option value="employees">Empleados</option>
            <option value="metrics">Indicadores</option>
            <option value="cycles">Periodos</option>
            <option value="roles">Perfiles</option>
          </select>
          <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-sm text-white" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60" onClick={previewImport} disabled={!canImport || isImporting || !importFile}>
            {isImporting ? "Procesando..." : "Subir y validar"}
          </button>
        </div>

        {importPreview ? (
          <div className="rounded-2xl border border-white/15 bg-[#142028] p-4 text-sm text-[#D4E1E8] space-y-2">
            <p>Tipo detectado: {importPreview.datasetDetected}</p>
            <p>Total filas: {importPreview.totalRows}</p>
            <p>Validas: {importPreview.validCount}</p>
            <p>Con errores: {importPreview.invalidCount}</p>

            {editableErrors.length ? (
              <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Corregir errores antes de confirmar</p>
                {editableErrors.map((errorRow, index) => (
                  <div key={`${errorRow.row}-${index}`} className="rounded-lg border border-white/10 bg-[#142028] p-2">
                    <p className="mb-2 text-xs text-rose-300">Fila {errorRow.row}: {errorRow.message}</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {getEditableFields().map((field) => (
                        <input key={`${index}-${field}`} className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-white" placeholder={field} value={String(errorRow.normalized?.[field] ?? "")} onChange={(e) => updateErrorField(index, field, e.target.value)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <button className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60" onClick={confirmImport} disabled={isImporting || (importPreview.validCount === 0 && editableErrors.length === 0)}>
              {isImporting ? "Importando..." : "Confirmar importacion"}
            </button>
          </div>
        ) : null}

        {importResult ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-[#d3f8e2]">
            <p>Total: {importResult.total}</p>
            <p>Creados: {importResult.created}</p>
            <p>Actualizados: {importResult.updated}</p>
            <p>Errores: {importResult.errors?.length || 0}</p>
          </div>
        ) : null}

        {selectedJob ? (
          <div className="rounded-2xl border border-white/15 bg-[#142028] p-4 text-sm text-[#D4E1E8]">
            <p className="font-semibold text-white">Trazabilidad de importacion</p>
            <p className="mt-1">Archivo: {selectedJob.sourceFileName}</p>
            <p>Estado: {selectedJob.stage}</p>
            <p>Parser: {selectedJob.parserType}</p>
            <p>Dataset detectado: {selectedJob.datasetDetected}</p>
            <p>Filas: {selectedJob.totalRows} | Validas: {selectedJob.validRows} | Errores: {selectedJob.errorCount}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h4 className="text-lg font-semibold text-white">Historial de importaciones</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[#9fb6c4]">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2">Dataset</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Filas</th>
                <th className="px-3 py-2">Errores</th>
              </tr>
            </thead>
            <tbody>
              {importJobs.map((job) => (
                <tr key={job._id} className="border-b border-white/5 text-[#d4e1e8]">
                  <td className="px-3 py-2">{formatDate(job.createdAt)}</td>
                  <td className="px-3 py-2">{job.sourceFileName}</td>
                  <td className="px-3 py-2">{job.datasetDetected || job.datasetRequested}</td>
                  <td className="px-3 py-2">{job.stage}</td>
                  <td className="px-3 py-2">{job.totalRows}</td>
                  <td className="px-3 py-2">{job.errorCount}</td>
                </tr>
              ))}
              {!importJobs.length ? (
                <tr>
                  <td className="px-3 py-4 text-[#9fb6c4]" colSpan={6}>Todavia no hay importaciones registradas.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {overview ? (
        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-[#122530] p-5"><p className="text-sm text-[#9fb6c4]">Empleados</p><p className="text-3xl font-bold text-white">{overview.summary.employees}</p></article>
          <article className="rounded-2xl border border-white/10 bg-[#122530] p-5"><p className="text-sm text-[#9fb6c4]">Evaluaciones</p><p className="text-3xl font-bold text-white">{overview.summary.evaluations}</p></article>
          <article className="rounded-2xl border border-white/10 bg-[#122530] p-5"><p className="text-sm text-[#9fb6c4]">Indicadores</p><p className="text-3xl font-bold text-white">{overview.summary.metrics}</p></article>
          <article className="rounded-2xl border border-white/10 bg-[#122530] p-5"><p className="text-sm text-[#9fb6c4]">Planes</p><p className="text-3xl font-bold text-white">{overview.summary.developmentPlans}</p></article>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="grid gap-3 xl:grid-cols-5">
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {Object.entries(datasetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={filters.schoolId} onChange={(e) => setFilters({ ...filters, schoolId: e.target.value })}>
            <option value="">Todos los colegios</option>
            {(overview?.schools || []).map((school) => <option key={school._id} value={school._id}>{school.nombre}</option>)}
          </select>
          <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Area" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })} />
          <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Cargo" value={filters.cargo} onChange={(e) => setFilters({ ...filters, cargo: e.target.value })} />
          <div className="flex gap-2">
            <button className="rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!datasetData.canDownload} onClick={() => downloadDataset("csv")}>CSV</button>
            <button className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-[#c5d5de] disabled:opacity-50" disabled={!datasetData.canDownload} onClick={() => downloadDataset("xlsx")}>Excel</button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[#9fb6c4]">
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recentDownloads || []).map((download) => (
                <tr key={download._id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{datasetLabels[download.exportType] || download.exportType} - {download.role}</td>
                  <td className="px-4 py-3 text-[#c5d5de]">{formatDate(download.downloadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

