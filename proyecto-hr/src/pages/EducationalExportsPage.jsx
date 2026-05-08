import { useCallback, useEffect, useMemo, useState } from "react";
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
  const { token, user, activeCompanyId } = useAuth();
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
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);

  const loadOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      const data = await apiFetch("/education-exports/overview", { token });
      setOverview(data);
      if (!filters.schoolId && data.schools?.[0]?._id) {
        setFilters((prev) => ({ ...prev, schoolId: prev.schoolId || data.schools[0]._id }));
      }
    } finally {
      setIsLoadingOverview(false);
    }
  }, [filters.schoolId, token]);

  const loadDataset = useCallback(async () => {
    try {
      setIsLoadingDataset(true);
      const data = await apiFetch(`/education-exports/dataset/${dataset}${queryString}`, { token });
      setDatasetData(data);
    } finally {
      setIsLoadingDataset(false);
    }
  }, [dataset, queryString, token]);

  const loadImportJobs = useCallback(async () => {
    const data = await apiFetch("/education-exports/import-jobs", { token });
    setImportJobs(data.items || []);
  }, [token]);

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
    loadImportJobs().catch((error) => setMessage(error.message));
  }, [activeCompanyId, loadImportJobs, loadOverview]);

  useEffect(() => {
    loadDataset().catch((error) => setMessage(error.message));
  }, [activeCompanyId, loadDataset]);

  async function downloadDataset(format) {
    try {
      const suffix = queryString ? `${queryString}&format=${format}` : `?format=${format}`;
      const response = await fetch(`${apiUrl}/education-exports/download/${dataset}${suffix}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
        },
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
        timeoutMs: 90000,
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
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("demoro")) {
        setMessage("La validacion tardo demasiado. Reintenta con un archivo mas chico o vuelve a intentar en unos segundos.");
      } else {
        setMessage(msg);
      }
      setImportPreview(null);
    } finally {
      setIsImporting(false);
    }
  }

  function resetImportFlow() {
    setImportPreview(null);
    setEditableErrors([]);
    setImportResult(null);
    setSelectedJob(null);
    setMessage("");
  }

  function downloadTemplate(kind) {
    const templates = {
      employees: "apellido,nombre,email,cargo,area,tipoempleado,activo\nPerez,Juan,juan@colegio.com,Docente,Matematica,DOCENTE,true\n",
      metrics: "competencia,nombre,descripcion,ponderacion\nTrabajo en equipo,Colabora con pares,Participa activamente con el equipo,1\n",
      cycles: "anio,periodo,etapa,estado,fechaInicio,fechaFin\n2026,Marzo,INICIO,BORRADOR,2026-03-01,2026-03-31\n",
      roles: "rol\nDOCENTE\nRRHH\nJEFE\n",
    };
    const text = templates[kind] || templates.employees;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!importPreview?.previewToken) return;
    try {
      setIsImporting(true);
      const data = await apiFetch("/education-exports/import/confirm", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        timeoutMs: 120000,
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
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("preview expirada")) {
        setMessage("La previsualizacion vencio o el servidor se reinicio. Vuelve a subir el archivo para continuar.");
      } else if (msg.toLowerCase().includes("demoro")) {
        setMessage("La confirmacion tardo demasiado. Reintenta; si persiste, divide el archivo en lotes.");
      } else {
        setMessage(msg);
      }
    } finally {
      setIsImporting(false);
    }
  }

  function updateErrorField(index, field, value) {
    setEditableErrors((prev) =>
      prev.map((item, i) => (i === index ? { ...item, normalized: { ...(item.normalized || {}), [field]: value } } : item))
    );
  }

  function reintentarSoloFilasConError() {
    if (!editableErrors.length) {
      setMessage("No hay filas con error para reintentar.");
      return;
    }
    setImportPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totalRows: editableErrors.length,
        validCount: 0,
        invalidCount: editableErrors.length,
        sampleValidRows: [],
      };
    });
    setMessage("Reintento preparado: corrige filas con error y confirma importacion.");
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
        <h3 className="text-2xl font-bold text-white">Centro de datos</h3>
        <p className="mt-2 text-[#9fb6c4]">Un solo lugar para subir, validar, confirmar y descargar.</p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 space-y-4">
        <h4 className="text-lg font-semibold text-white">Flujo de importacion guiado</h4>
        <p className="text-sm text-[#9fb6c4]">
          Carga una vez, valida con reglas, corrige errores puntuales y confirma el lote final.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#22c55e]/40 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">1. Subir archivo</span>
          <span className={`rounded-full px-3 py-1 text-xs ${importPreview ? "border border-[#22c55e]/40 bg-[#123224] text-[#8be6ac]" : "border border-white/20 bg-[#0f1f28] text-[#c5d5de]"}`}>2. Validar y corregir</span>
          <span className={`rounded-full px-3 py-1 text-xs ${importResult ? "border border-[#22c55e]/40 bg-[#123224] text-[#8be6ac]" : "border border-white/20 bg-[#0f1f28] text-[#c5d5de]"}`}>3. Confirmar lote</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]" onClick={() => downloadTemplate("employees")}>
            Plantilla empleados
          </button>
          <button type="button" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]" onClick={() => downloadTemplate("metrics")}>
            Plantilla metricas
          </button>
          <button type="button" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]" onClick={() => downloadTemplate("cycles")}>
            Plantilla periodos
          </button>
          <button type="button" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]" onClick={() => downloadTemplate("roles")}>
            Plantilla perfiles
          </button>
        </div>

        {!canImport ? <div className="pf-alert-warning">Tu rol no tiene permiso para importar.</div> : null}
        {message ? <div className={`${message.toLowerCase().includes("confirmada") ? "pf-alert-success" : "pf-alert-error"}`}>{message}</div> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <select className="pf-select" value={importDataset} onChange={(e) => setImportDataset(e.target.value)}>
            <option value="auto">Auto detectar</option>
            <option value="employees">Empleados</option>
            <option value="metrics">Indicadores</option>
            <option value="cycles">Periodos</option>
            <option value="roles">Perfiles</option>
          </select>
          <input className="pf-input text-sm" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            <button className="pf-button rounded-xl bg-emerald-600 text-white disabled:opacity-60" onClick={previewImport} disabled={!canImport || isImporting || !importFile}>
              {isImporting ? "Procesando..." : "Subir y validar"}
            </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetImportFlow}
            className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
          >
            Limpiar flujo
          </button>
          {selectedJob?._id ? (
            <button
              type="button"
              onClick={() =>
                apiFetch(`/education-exports/import-jobs/${selectedJob._id}`, { token })
                  .then((detail) => setSelectedJob(detail.job || null))
                  .catch((error) => setMessage(error.message))
              }
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
            >
              Reintentar lectura del job
            </button>
          ) : null}
          {editableErrors.length ? (
            <button
              type="button"
              onClick={reintentarSoloFilasConError}
              className="rounded-xl border border-amber-300/40 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-200"
            >
              Reintentar solo filas con error
            </button>
          ) : null}
        </div>

        {importPreview ? (
          <div className="rounded-2xl border border-white/15 bg-[#142028] p-4 text-sm text-[#D4E1E8] space-y-2">
            <p>Tipo detectado: {importPreview.datasetDetected}</p>
            <p>Total filas: {importPreview.totalRows}</p>
            <p>Validas: {importPreview.validCount}</p>
            <p>Con errores: {importPreview.invalidCount}</p>
            {importPreview.extractedSummary ? (
              <div className="rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Resumen detectado</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {Object.entries(importPreview.extractedSummary).map(([key, value]) => (
                    <p key={key} className="text-xs text-[#c5d5de]">{key}: <span className="font-semibold text-white">{String(value)}</span></p>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(importPreview.sampleValidRows) && importPreview.sampleValidRows.length ? (
              <div className="rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Vista previa de filas validas</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#9FB6C1]">
                        {Object.keys(importPreview.sampleValidRows[0]).map((k) => (
                          <th key={k} className="px-2 py-1 text-left">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.sampleValidRows.slice(0, 8).map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5">
                          {Object.keys(importPreview.sampleValidRows[0]).map((k) => (
                            <td key={k} className="px-2 py-1 text-[#D4E1E8]">{String(row[k] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

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

            <button className="pf-button rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60" onClick={confirmImport} disabled={isImporting || (importPreview.validCount === 0 && editableErrors.length === 0)}>
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
            <button
              type="button"
              onClick={() => setShowTechnicalDetails((v) => !v)}
              className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-[#c5d5de]"
            >
              {showTechnicalDetails ? "Ocultar detalle tecnico" : "Ver detalle tecnico"}
            </button>
            {showTechnicalDetails ? (
              <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#0f1f28] p-3 text-xs text-[#c5d5de]">
                {JSON.stringify(selectedJob.previewSummary || {}, null, 2)}
              </pre>
            ) : null}
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
                  <td className="px-3 py-4 text-[#9fb6c4]" colSpan={6}>Todav?a no hay importaciones registradas.</td>
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
        {isLoadingDataset || isLoadingOverview ? (
          <p className="mb-3 text-xs text-[#9fb6c4]">Actualizando vista de datos...</p>
        ) : null}
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

