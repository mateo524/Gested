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
  const { token, user } = useAuth();
  const canImport =
    user?.isSuperAdmin ||
    user?.permisos?.includes("manage_employees") ||
    user?.permisos?.includes("manage_metrics") ||
    user?.permisos?.includes("manage_evaluation_cycles");

  const [overview, setOverview] = useState(null);
  const [dataset, setDataset] = useState("employees");
  const [datasetData, setDatasetData] = useState({ items: [], canDownload: false });
  const [filters, setFilters] = useState({ schoolId: "", area: "", cargo: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [importDataset, setImportDataset] = useState("auto");
  const [importFile, setImportFile] = useState(null);
  const [manualMapping, setManualMapping] = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const [editableErrors, setEditableErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [confirmMapping, setConfirmMapping] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);

  const loadOverview = useCallback(async () => {
    const data = await apiFetch("/education-exports/overview", { token });
    setOverview(data);
    if (!filters.schoolId && data.schools?.[0]?._id) {
      setFilters((prev) => ({ ...prev, schoolId: prev.schoolId || data.schools[0]._id }));
    }
  }, [token, filters.schoolId]);

  const loadDataset = useCallback(async () => {
    const data = await apiFetch(`/education-exports/dataset/${dataset}${queryString}`, { token });
    setDatasetData(data);
  }, [token, dataset, queryString]);

  useEffect(() => {
    loadOverview().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadOverview]);

  useEffect(() => {
    loadDataset().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadDataset]);

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
      setMessageType("success");
      setMessage("Descarga generada.");
      await loadOverview();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  async function previewImport(mode = "preview") {
    if (!importFile) {
      setMessageType("warning");
      setMessage("Selecciona un archivo antes de continuar.");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      setIsImporting(true);
      setMessage("");
      const body = new FormData();
      body.append("file", importFile);
      body.append("dataset", importDataset);
      body.append("mode", mode);
      body.append("manualMapping", JSON.stringify(manualMapping));
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
      setConfirmMapping(false);
      setConfirmWarnings(false);
      if (mode === "analyze") {
        setMessageType("info");
        setMessage("Análisis completado. Revisa detecciones y advertencias.");
      }
    } catch (error) {
      setImportPreview(null);
      if (error.name === "AbortError") {
        setMessageType("warning");
        setMessage("La validación demoró demasiado. Prueba con un archivo más chico o usa 'Analizar sin importar'.");
      } else {
        setMessageType("error");
        setMessage(error.message);
      }
    } finally {
      clearTimeout(timeout);
      setIsImporting(false);
    }
  }

  async function confirmImport() {
    if (!importPreview?.previewToken) {
      setMessageType("warning");
      setMessage("No hay validación activa para confirmar.");
      return;
    }
    try {
      setIsImporting(true);
      const data = await apiFetch("/education-exports/import/confirm", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken: importPreview.previewToken,
          correctedRows: editableErrors.map((item) => item.normalized || {}),
          confirmMapping,
          confirmWarnings,
        }),
      });
      setImportResult(data);
      setImportPreview(null);
      setImportFile(null);
      setManualMapping({});
      setMessageType("success");
      setMessage("Importación confirmada.");
      await Promise.all([loadOverview(), loadDataset()]);
    } catch (error) {
      setMessageType("error");
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

  function updateMapping(field, value) {
    setManualMapping((prev) => ({ ...prev, [field]: value }));
  }

  function getEditableFields() {
    if (importPreview?.datasetDetected === "employees") return ["apellido", "nombre", "email", "cargo", "area", "legajo"];
    if (importPreview?.datasetDetected === "metrics") return ["competencia", "nombre", "ponderacion", "descripcion"];
    if (importPreview?.datasetDetected === "cycles") return ["anio", "periodo", "etapa", "estado", "fechaInicio", "fechaFin"];
    if (importPreview?.datasetDetected === "roles") return ["nombre"];
    return [];
  }

  const mappingFields = importPreview?.analysis?.lowConfidenceFields || [];
  const detectionEntries = Object.entries(importPreview?.analysis?.detections || {});

  const messageClass =
    messageType === "error"
      ? "rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      : messageType === "success"
      ? "rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
      : messageType === "warning"
      ? "rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      : "rounded-xl border border-sky-300/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200";

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-2xl font-bold text-white">Cargas y descargas</h3>
        <p className="mt-2 text-[#9fb6c4]">Flujo sugerido: subir archivo, validar resultados y recién después confirmar importación.</p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 space-y-4">
        <h4 className="text-lg font-semibold text-white">Subida de datos (unificada)</h4>
        {!canImport ? <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Tu rol no tiene permiso para importar.</div> : null}
        {message ? <div className={messageClass}>{message}</div> : null}

        <div className="grid gap-3 md:grid-cols-4">
          <select className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={importDataset} onChange={(e) => setImportDataset(e.target.value)}>
            <option value="auto">Auto detectar</option>
            <option value="employees">Empleados</option>
            <option value="metrics">Indicadores</option>
            <option value="cycles">Períodos</option>
            <option value="roles">Perfiles</option>
          </select>
          <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-sm text-white" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <button className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60" onClick={() => previewImport("preview")} disabled={!canImport || isImporting || !importFile}>
            {isImporting ? "Procesando..." : "Subir y validar datos"}
          </button>
          <button className="rounded-xl border border-white/25 bg-[#0f1f28] px-4 py-3 font-semibold text-white disabled:opacity-60" onClick={() => previewImport("analyze")} disabled={!canImport || isImporting || !importFile}>
            Analizar sin importar
          </button>
        </div>

        {importPreview ? (
          <div className="rounded-2xl border border-white/15 bg-[#142028] p-4 text-sm text-[#D4E1E8] space-y-3">
            <p>Dataset detectado: {importPreview.datasetDetected}</p>
            <p>Total filas: {importPreview.totalRows}</p>
            <p>Válidas: {importPreview.validCount}</p>
            <p>Con errores: {importPreview.invalidCount}</p>
            <p>Advertencias: {importPreview.warningCount || 0}</p>
            {importPreview.analysis?.sheetName ? <p>Hoja detectada: {importPreview.analysis.sheetName} (encabezado fila {importPreview.analysis.headerRowNumber})</p> : null}

            {detectionEntries.length ? (
              <div className="rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Columnas detectadas con confianza</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {detectionEntries.map(([field, info]) => (
                    <div key={field} className="rounded-lg border border-white/10 bg-[#142028] px-3 py-2">
                      <p className="text-xs text-[#9fb6c4]">{field}</p>
                      <p className="font-semibold text-white">{info.header}</p>
                      <p className="text-xs text-[#9fb6c4]">Confianza: {Math.round((info.confidence || 0) * 100)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {mappingFields.length ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-200">Mapeo manual requerido</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {mappingFields.map((field) => (
                    <input
                      key={field}
                      className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-white"
                      placeholder={`Encabezado para ${field}`}
                      value={manualMapping[field] || ""}
                      onChange={(e) => updateMapping(field, e.target.value)}
                    />
                  ))}
                </div>
                <button className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-white" onClick={() => previewImport("preview")} disabled={isImporting}>
                  Reanalizar con mapeo manual
                </button>
              </div>
            ) : null}

            {(importPreview.sampleWarnings || []).length ? (
              <div className="rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-yellow-200">Advertencias</p>
                {(importPreview.sampleWarnings || []).slice(0, 10).map((warning, index) => (
                  <p key={`${warning.row}-${index}`} className="text-xs text-yellow-100">
                    Fila {warning.row}: {warning.message}
                  </p>
                ))}
              </div>
            ) : null}

            {editableErrors.length ? (
              <div className="space-y-3 rounded-xl border border-white/10 bg-[#1A2C38] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Corrige filas con error antes de confirmar</p>
                {editableErrors.map((errorRow, index) => (
                  <div key={`${errorRow.row}-${index}`} className="rounded-lg border border-white/10 bg-[#142028] p-2">
                    <p className="mb-2 text-xs text-rose-300">
                      Fila {errorRow.row}: {errorRow.message}
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {getEditableFields().map((field) => (
                        <input
                          key={`${index}-${field}`}
                          className="rounded-xl border border-white/15 bg-[#0f1f28] px-3 py-2 text-sm text-white"
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

            {!importPreview.analyzeOnly ? (
              <div className="space-y-2">
                {mappingFields.length ? (
                  <label className="flex items-center gap-2 text-xs text-[#c9d9e1]">
                    <input type="checkbox" checked={confirmMapping} onChange={(e) => setConfirmMapping(e.target.checked)} />
                    Confirmo el mapeo manual de columnas detectadas
                  </label>
                ) : null}
                {(importPreview.sampleWarnings || []).length ? (
                  <label className="flex items-center gap-2 text-xs text-[#c9d9e1]">
                    <input type="checkbox" checked={confirmWarnings} onChange={(e) => setConfirmWarnings(e.target.checked)} />
                    Confirmo advertencias (roles, jefe o sede ambiguos)
                  </label>
                ) : null}
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  onClick={confirmImport}
                  disabled={
                    isImporting ||
                    (importPreview.validCount === 0 && editableErrors.length === 0) ||
                    (mappingFields.length > 0 && !confirmMapping) ||
                    ((importPreview.sampleWarnings || []).length > 0 && !confirmWarnings)
                  }
                >
                  {isImporting ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {importResult ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-[#d3f8e2]">
            <p>Total: {importResult.total}</p>
            <p>Creados: {importResult.created}</p>
            <p>Actualizados: {importResult.updated}</p>
            <p>Errores: {importResult.errors?.length || 0}</p>
            <p>Advertencias: {importResult.warnings?.length || 0}</p>
          </div>
        ) : null}
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
          <input className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Área" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })} />
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

