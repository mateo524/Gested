import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const datasetLabels = {
  employees: "Empleados",
  evaluations: "Evaluaciones",
  metrics: "Metricas",
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

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
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
      if (!response.ok) throw new Error("No se pudo generar la descarga");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${dataset}.${format === "xlsx" ? "xlsx" : "csv"}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessage("Descarga generada");
      await loadOverview();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function previewImport() {
    if (!importFile) return setMessage("Selecciona un archivo");
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
      setEditableErrors((data.sampleErrors || []).map((item) => ({ ...item, normalized: { ...(item.normalized || {}) } })));
      setImportResult(null);
    } catch (error) {
      setMessage(
        error.name === "AbortError"
          ? "La validacion demoro demasiado. Proba con un archivo mas chico o separado por modulo."
          : error.message
      );
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
      setMessage("Importacion confirmada");
      await Promise.all([loadOverview(), loadDataset()]);
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
      <section className="pf-card p-6">
        <h3 className="text-2xl font-bold text-slate-950">Bases y descargas</h3>
        <p className="mt-2 text-slate-600">
          Flujo simple: subir, validar y confirmar. Si el Excel viene desordenado, el sistema intenta reordenarlo.
        </p>
      </section>

      <section className="pf-card p-6 space-y-4">
        <h4 className="text-lg font-semibold text-slate-950">Subida de datos (unificada)</h4>
        {!canImport ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tu rol no tiene permiso para importar. Entrá con superadmin, director o RRHH con permisos de carga.
          </div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {message}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <select className="pf-input" value={importDataset} onChange={(e) => setImportDataset(e.target.value)}>
            <option value="auto">Auto detectar</option>
            <option value="employees">Empleados</option>
            <option value="metrics">Metricas</option>
            <option value="cycles">Ciclos</option>
            <option value="roles">Roles</option>
          </select>
          <input
            className="pf-input text-sm"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60" onClick={previewImport} disabled={!canImport || isImporting || !importFile}>
            {isImporting ? "Procesando..." : "Subir y validar datos"}
          </button>
        </div>

        {importPreview ? (
          <div className="rounded-2xl border border-white/15 bg-[#142028] p-4 text-sm text-[#D4E1E8] space-y-2">
            <p>Dataset detectado: {importPreview.datasetDetected}</p>
            <p>Total filas: {importPreview.totalRows}</p>
            <p>Validas: {importPreview.validCount}</p>
            <p>Con errores: {importPreview.invalidCount}</p>
            {importPreview.truncated ? (
              <p className="text-xs text-amber-300">
                Se previsualizaron solo {importPreview.previewLimit} filas para acelerar validacion.
              </p>
            ) : null}
            {importPreview.datasetDetected === "narrative" && importPreview.extractedSummary ? (
              <div className="rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Resumen extraido automaticamente</p>
                <p className="mt-1 text-sm text-[#D4E1E8]">Nombre: {importPreview.extractedSummary.nombre || "-"}</p>
                <p className="text-sm text-[#D4E1E8]">Cargo: {importPreview.extractedSummary.cargo || "-"}</p>
                <p className="text-sm text-[#D4E1E8]">Area: {importPreview.extractedSummary.area || "-"}</p>
                <p className="text-sm text-[#D4E1E8]">Competencias detectadas: {importPreview.extractedSummary.competenciasDetectadas || 0}</p>
                <p className="text-sm text-[#D4E1E8]">Promedio final: {importPreview.extractedSummary.promedioFinal || 0}</p>
              </div>
            ) : null}
            {editableErrors.length ? (
              <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">
                  Corregi filas con error antes de confirmar
                </p>
                {editableErrors.map((errorRow, index) => (
                  <div key={`${errorRow.row}-${index}`} className="rounded-lg border border-white/10 bg-[#142028] p-2">
                    <p className="mb-2 text-xs text-rose-300">Fila {errorRow.row}: {errorRow.message}</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {getEditableFields().map((field) => (
                        <input
                          key={`${index}-${field}`}
                          className="pf-input text-sm"
                          placeholder={field}
                          value={String(errorRow.normalized?.[field] ?? "")}
                          onChange={(e) => updateErrorField(index, field, e.target.value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              onClick={confirmImport}
              disabled={isImporting || (importPreview.validCount === 0 && editableErrors.length === 0)}
            >
              {isImporting ? "Importando..." : "Confirmar importacion"}
            </button>
          </div>
        ) : null}

        {importResult ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-slate-800">
            <p>Total: {importResult.total}</p>
            <p>Creados: {importResult.created}</p>
            <p>Actualizados: {importResult.updated}</p>
            <p>Errores: {importResult.errors?.length || 0}</p>
          </div>
        ) : null}
      </section>

      {overview ? (
        <section className="grid gap-4 md:grid-cols-4">
          <article className="pf-card p-5"><p className="text-sm text-slate-500">Empleados</p><p className="text-3xl font-bold text-slate-950">{overview.summary.employees}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-slate-500">Evaluaciones</p><p className="text-3xl font-bold text-slate-950">{overview.summary.evaluations}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-slate-500">Metricas</p><p className="text-3xl font-bold text-slate-950">{overview.summary.metrics}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-slate-500">Planes</p><p className="text-3xl font-bold text-slate-950">{overview.summary.developmentPlans}</p></article>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-5">
          <select className="rounded-2xl border border-slate-300 px-4 py-3" value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {Object.entries(datasetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="rounded-2xl border border-slate-300 px-4 py-3" value={filters.schoolId} onChange={(e) => setFilters({ ...filters, schoolId: e.target.value })}>
            <option value="">Todos los colegios</option>
            {(overview?.schools || []).map((school) => <option key={school._id} value={school._id}>{school.nombre}</option>)}
          </select>
          <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Area" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })} />
          <input className="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Cargo" value={filters.cargo} onChange={(e) => setFilters({ ...filters, cargo: e.target.value })} />
          <div className="flex gap-2">
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!datasetData.canDownload} onClick={() => downloadDataset("csv")}>CSV</button>
            <button className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={!datasetData.canDownload} onClick={() => downloadDataset("xlsx")}>Excel</button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recentDownloads || []).map((download) => (
                <tr key={download._id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{datasetLabels[download.exportType] || download.exportType} - {download.role}</td>
                  <td className="px-4 py-3">{formatDate(download.downloadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!message ? null : <p className="hidden">{message}</p>}
    </div>
  );
}
