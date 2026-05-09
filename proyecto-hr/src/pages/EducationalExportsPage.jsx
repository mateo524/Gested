import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [globalOriginalFiles, setGlobalOriginalFiles] = useState([]);
  const [globalOriginalFilter, setGlobalOriginalFilter] = useState({
    companyId: "",
    schoolId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [editingFileId, setEditingFileId] = useState("");
  const [editingFileName, setEditingFileName] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters]);
  const deferredQueryString = useDeferredValue(queryString);

  const overviewCacheKey = useMemo(() => {
    const role = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
    return `pf_exports_overview_${role}`;
  }, [user]);

  const datasetCacheKey = useMemo(() => {
    const role = user?.roleCode || (user?.isSuperAdmin ? "SUPER_ADMIN" : "USER");
    return `pf_exports_dataset_${role}_${dataset}_${deferredQueryString}`;
  }, [dataset, deferredQueryString, user]);

  const loadOverview = useCallback(async (signal) => {
    setIsLoadingOverview(true);
    try {
      const data = await apiFetch("/education-exports/overview", { token, timeoutMs: 20000, signal });
      setOverview(data);
      sessionStorage.setItem(overviewCacheKey, JSON.stringify(data));
      if (!filters.schoolId && data.schools?.[0]?._id) {
        setFilters((prev) => ({ ...prev, schoolId: prev.schoolId || data.schools[0]._id }));
      }
    } finally {
      setIsLoadingOverview(false);
    }
  }, [token, filters.schoolId, overviewCacheKey]);

  const loadDataset = useCallback(async (signal) => {
    setIsLoadingDataset(true);
    try {
      const data = await apiFetch(`/education-exports/dataset/${dataset}${deferredQueryString}`, {
        token,
        timeoutMs: 20000,
        signal,
      });
      setDatasetData(data);
      sessionStorage.setItem(datasetCacheKey, JSON.stringify(data));
    } finally {
      setIsLoadingDataset(false);
    }
  }, [token, dataset, deferredQueryString, datasetCacheKey]);

  const loadUploadedFiles = useCallback(async () => {
    const data = await apiFetch("/education-exports/imports/files", { token, timeoutMs: 20000 });
    setUploadedFiles(data.items || []);
  }, [token]);

  const loadGlobalOriginalFiles = useCallback(async () => {
    if (!user?.isSuperAdmin) return;
    const params = new URLSearchParams();
    if (globalOriginalFilter.companyId) params.set("companyId", globalOriginalFilter.companyId);
    if (globalOriginalFilter.schoolId) params.set("schoolId", globalOriginalFilter.schoolId);
    if (globalOriginalFilter.dateFrom) params.set("dateFrom", globalOriginalFilter.dateFrom);
    if (globalOriginalFilter.dateTo) params.set("dateTo", globalOriginalFilter.dateTo);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/education-exports/imports/files/superadmin${suffix}`, { token, timeoutMs: 20000 });
    setGlobalOriginalFiles(data.items || []);
  }, [
    token,
    user,
    globalOriginalFilter.companyId,
    globalOriginalFilter.schoolId,
    globalOriginalFilter.dateFrom,
    globalOriginalFilter.dateTo,
  ]);

  useEffect(() => {
    const cachedOverview = sessionStorage.getItem(overviewCacheKey);
    if (cachedOverview) {
      try {
        setOverview(JSON.parse(cachedOverview));
      } catch {
        sessionStorage.removeItem(overviewCacheKey);
      }
    }

    const controller = new AbortController();
    loadOverview(controller.signal).catch((error) => {
      if (controller.signal.aborted) return;
      setIsLoadingOverview(false);
      setMessageType("error");
      setMessage(error.message);
    });
    return () => controller.abort();
  }, [loadOverview, overviewCacheKey]);

  useEffect(() => {
    loadUploadedFiles().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadUploadedFiles]);

  useEffect(() => {
    loadGlobalOriginalFiles().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadGlobalOriginalFiles]);

  useEffect(() => {
    const cachedDataset = sessionStorage.getItem(datasetCacheKey);
    if (cachedDataset) {
      try {
        setDatasetData(JSON.parse(cachedDataset));
      } catch {
        sessionStorage.removeItem(datasetCacheKey);
      }
    }

    const controller = new AbortController();
    loadDataset(controller.signal).catch((error) => {
      if (controller.signal.aborted) return;
      setIsLoadingDataset(false);
      setMessageType("error");
      setMessage(error.message);
    });
    return () => controller.abort();
  }, [loadDataset, datasetCacheKey]);

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
      setMessage("Seleccioná un archivo antes de continuar.");
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
        setMessage("Análisis completado. Revisá detecciones y advertencias.");
      }
    } catch (error) {
      setImportPreview(null);
      if (error.name === "AbortError") {
        setMessageType("warning");
        setMessage("La validación demoró demasiado. Probá con un archivo más chico o usá 'Analizar sin importar'.");
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
      await Promise.all([loadOverview(), loadDataset(), loadUploadedFiles()]);
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
    if (importPreview?.datasetDetected === "multi") return [];
    if (importPreview?.datasetDetected === "employees") return ["apellido", "nombre", "email", "cargo", "area", "legajo"];
    if (importPreview?.datasetDetected === "metrics") return ["competencia", "nombre", "ponderacion", "descripcion"];
    if (importPreview?.datasetDetected === "cycles") return ["anio", "periodo", "etapa", "estado", "fechaInicio", "fechaFin"];
    if (importPreview?.datasetDetected === "roles") return ["nombre"];
    return [];
  }

  async function saveFileName(fileId) {
    if (!editingFileName.trim()) return;
    try {
      await apiFetch(`/education-exports/imports/files/${fileId}`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreVisible: editingFileName.trim() }),
      });
      setMessageType("success");
      setMessage("Documento actualizado.");
      setEditingFileId("");
      setEditingFileName("");
      await loadUploadedFiles();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  async function deleteUploadedFile(fileId) {
    const ok = window.confirm("¿Eliminar este documento subido?");
    if (!ok) return;
    try {
      await apiFetch(`/education-exports/imports/files/${fileId}`, {
        method: "DELETE",
        token,
      });
      setMessageType("success");
      setMessage("Documento eliminado.");
      await Promise.all([loadUploadedFiles(), loadGlobalOriginalFiles()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  const mappingFields = importPreview?.analysis?.lowConfidenceFields || [];
  const detectionEntries = Object.entries(importPreview?.analysis?.detections || {});
  const globalCompanies = useMemo(() => {
    const map = new Map();
    for (const file of globalOriginalFiles) {
      if (file.companyId?._id) map.set(file.companyId._id, file.companyId.nombre || "Empresa");
    }
    return [...map.entries()].map(([id, nombre]) => ({ _id: id, nombre }));
  }, [globalOriginalFiles]);

  const globalSchools = useMemo(() => {
    const map = new Map();
    for (const file of globalOriginalFiles) {
      if (file.schoolId?._id) map.set(file.schoolId._id, file.schoolId.nombre || "Colegio");
    }
    return [...map.entries()].map(([id, nombre]) => ({ _id: id, nombre }));
  }, [globalOriginalFiles]);

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
      <section className="pf-surface p-6">
        <h3 className="text-2xl font-bold text-white">Cargas y descargas</h3>
        <p className="mt-2 text-[#9fb6c4]">Flujo sugerido: subir archivo, validar resultados y recién después confirmar importación.</p>
      </section>

      <section className="pf-surface space-y-4 p-6">
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
          <div className="pf-card space-y-3 p-4 text-sm text-[#D4E1E8]">
            <p>Dataset detectado: {importPreview.datasetDetected}</p>
            <p>Total filas: {importPreview.totalRows}</p>
            <p>Válidas: {importPreview.validCount}</p>
            <p>Con errores: {importPreview.invalidCount}</p>
            <p>Advertencias: {importPreview.warningCount || 0}</p>
            {importPreview.analysis?.sheetName ? <p>Hoja detectada: {importPreview.analysis.sheetName} (encabezado fila {importPreview.analysis.headerRowNumber})</p> : null}

            <div className="pf-card-muted p-3">
              <p className="text-sm font-semibold text-white">Estado del resultado</p>
              <p className="mt-1 text-xs text-[#c5d5de]">
                {importPreview.invalidCount > 0
                  ? `Hay ${importPreview.invalidCount} error(es) que bloquean la importación hasta corregirlos.`
                  : "No hay errores bloqueantes. Podés continuar."}
              </p>
              <p className="mt-1 text-xs text-[#c5d5de]">
                {(importPreview.warningCount || 0) > 0
                  ? `Hay ${importPreview.warningCount} advertencia(s): no bloquean, pero requieren confirmación.`
                  : "No hay advertencias pendientes."}
              </p>
              {importPreview.invalidCount > 0 ? (
                <p className="mt-1 text-xs text-amber-200">
                  Sugerencia: si detectó mal el tipo de archivo, probá elegir manualmente Empleados / Indicadores / Períodos / Perfiles arriba.
                </p>
              ) : null}
            </div>

            {detectionEntries.length ? (
              <div className="pf-card-muted p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Columnas detectadas con confianza</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {detectionEntries.map(([field, info]) => (
                    <div key={field} className="pf-card-muted px-3 py-2">
                      <p className="text-xs text-[#9fb6c4]">{field}</p>
                      <p className="font-semibold text-white">{info.header}</p>
                      <p className="text-xs text-[#9fb6c4]">Confianza: {Math.round((info.confidence || 0) * 100)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {importPreview.datasetDetected === "multi" && importPreview.mixedSummary ? (
              <div className="pf-card-muted p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Resumen mixto detectado</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {Object.entries(importPreview.mixedSummary).map(([moduleName, count]) => (
                    <div key={moduleName} className="pf-card-muted px-3 py-2">
                      <p className="text-xs text-[#9fb6c4]">{moduleName}</p>
                      <p className="font-semibold text-white">{count} fila(s)</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#c5d5de]">
                  Se importará por secciones automáticamente (empleados, métricas, ciclos, perfiles y competencias detectadas).
                </p>
              </div>
            ) : null}

            {mappingFields.length ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-200">Mejora opcional de mapeo (la importación puede continuar igual)</p>
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
                  Reanalizar con mejora opcional
                </button>
              </div>
            ) : null}

            {(importPreview.sampleWarnings || []).length ? (
              <div className="rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-yellow-200">Advertencias (no bloquean)</p>
                <p className="mb-2 text-xs text-yellow-100">Podés seguir, pero primero confirmá que revisaste estas advertencias.</p>
                {(importPreview.sampleWarnings || []).slice(0, 10).map((warning, index) => (
                  <p key={`${warning.row}-${index}`} className="text-xs text-yellow-100">
                    Fila {warning.row}: {warning.message}
                  </p>
                ))}
              </div>
            ) : null}

            {editableErrors.length && importPreview.datasetDetected !== "multi" ? (
              <div className="pf-card-muted space-y-3 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9FB6C1]">Errores que sí bloquean</p>
                {editableErrors.map((errorRow, index) => (
                  <div key={`${errorRow.row}-${index}`} className="pf-card-muted p-2">
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
                {(importPreview.sampleWarnings || []).length ? (
                  <label className="flex items-center gap-2 text-xs text-[#c9d9e1]">
                    <input type="checkbox" checked={confirmWarnings} onChange={(e) => setConfirmWarnings(e.target.checked)} />
                    Revisé las advertencias y quiero continuar.
                  </label>
                ) : null}
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  onClick={confirmImport}
                  disabled={
                    isImporting ||
                    (importPreview.validCount === 0 && editableErrors.length === 0) ||
                    ((importPreview.sampleWarnings || []).length > 0 && !confirmWarnings)
                  }
                >
                  {isImporting
                    ? "Importando..."
                    : importPreview.invalidCount > 0
                    ? "Corregí errores para continuar"
                    : "Confirmar e importar"}
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
            {importResult.moduleSummary ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#b9f4cf]">Resumen por módulo</p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(importResult.moduleSummary).map(([moduleName, moduleData]) => (
                    <article key={moduleName} className="rounded-xl border border-emerald-300/20 bg-[#0f1f28] p-3 text-xs text-[#d3f8e2]">
                      <p className="text-sm font-semibold text-white">
                        {moduleName === "employees"
                          ? "Empleados"
                          : moduleName === "metrics"
                          ? "Indicadores"
                          : moduleName === "cycles"
                          ? "Períodos"
                          : moduleName === "roles"
                          ? "Perfiles"
                          : moduleName === "competencies"
                          ? "Competencias"
                          : moduleName}
                      </p>
                      <p>Creados: {moduleData?.created || 0}</p>
                      <p>Actualizados: {moduleData?.updated || 0}</p>
                      <p>Errores: {moduleData?.errors || 0}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="pf-surface p-6">
        <h4 className="text-lg font-semibold text-white">Documentos subidos</h4>
        <p className="mt-1 text-sm text-[#9fb6c4]">Historial de archivos importados con fecha y hora.</p>
        <div className="mt-4 space-y-3">
          {uploadedFiles.length === 0 ? (
            <p className="text-sm text-[#9fb6c4]">Todavía no hay documentos cargados.</p>
          ) : (
            uploadedFiles.map((file) => (
              <article key={file._id} className="pf-card-muted flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.nombreVisible || file.nombreArchivo}</p>
                  <p className="text-xs text-[#9fb6c4]">
                    {file.tipoArchivo || "importación"} • {file.nombreArchivo} • {formatDate(file.fechaSubida || file.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingFileId === file._id ? (
                    <>
                      <input
                        className="rounded-xl border border-white/15 bg-[#122530] px-3 py-2 text-sm text-white"
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        placeholder="Nuevo nombre"
                      />
                      <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => saveFileName(file._id)}>
                        Guardar
                      </button>
                      <button className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white" onClick={() => { setEditingFileId(""); setEditingFileName(""); }}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white"
                        onClick={() => {
                          setEditingFileId(file._id);
                          setEditingFileName(file.nombreVisible || file.nombreArchivo || "");
                        }}
                      >
                        Editar
                      </button>
                      <button className="rounded-xl border border-rose-300/30 px-3 py-2 text-sm text-rose-200" onClick={() => deleteUploadedFile(file._id)}>
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {user?.isSuperAdmin ? (
        <section className="pf-surface p-6">
          <h4 className="text-lg font-semibold text-white">Archivo original global (solo superadmin)</h4>
          <p className="mt-1 text-sm text-[#9fb6c4]">
            Acá ves y descargás los archivos originales subidos por cada empresa/colegio.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={globalOriginalFilter.companyId}
              onChange={(e) => setGlobalOriginalFilter((prev) => ({ ...prev, companyId: e.target.value }))}
            >
              <option value="">Todas las empresas</option>
              {globalCompanies.map((item) => (
                <option key={item._id} value={item._id}>{item.nombre}</option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={globalOriginalFilter.schoolId}
              onChange={(e) => setGlobalOriginalFilter((prev) => ({ ...prev, schoolId: e.target.value }))}
            >
              <option value="">Todos los colegios</option>
              {globalSchools.map((item) => (
                <option key={item._id} value={item._id}>{item.nombre}</option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={globalOriginalFilter.dateFrom}
              onChange={(e) => setGlobalOriginalFilter((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
            <input
              type="date"
              className="rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={globalOriginalFilter.dateTo}
              onChange={(e) => setGlobalOriginalFilter((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
          <div className="mt-4 space-y-3">
            {globalOriginalFiles.length === 0 ? (
              <p className="text-sm text-[#9fb6c4]">Todavía no hay archivos originales registrados.</p>
            ) : (
              globalOriginalFiles.map((file) => (
                <article
                  key={`global-${file._id}`}
                  className="pf-card-muted flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{file.nombreArchivo || file.nombreVisible}</p>
                    <p className="text-xs text-[#9fb6c4]">
                      {(file.companyId?.nombre || "Empresa")} • {(file.schoolId?.nombre || "Sin colegio")} • {formatDate(file.fechaSubida || file.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${file.publicUrl ? "bg-emerald-600 text-white" : "cursor-not-allowed border border-white/20 text-[#8ea7b7]"}`}
                      href={file.publicUrl || "#"}
                      target={file.publicUrl ? "_blank" : undefined}
                      rel={file.publicUrl ? "noreferrer" : undefined}
                      onClick={(e) => {
                        if (!file.publicUrl) e.preventDefault();
                      }}
                    >
                      Descargar original
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {overview ? (
        <section className="grid gap-4 md:grid-cols-4">
          <article className="pf-card p-5"><p className="text-sm text-[#9fb6c4]">Empleados</p><p className="text-3xl font-bold text-white">{overview.summary.employees}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-[#9fb6c4]">Evaluaciones</p><p className="text-3xl font-bold text-white">{overview.summary.evaluations}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-[#9fb6c4]">Indicadores</p><p className="text-3xl font-bold text-white">{overview.summary.metrics}</p></article>
          <article className="pf-card p-5"><p className="text-sm text-[#9fb6c4]">Planes</p><p className="text-3xl font-bold text-white">{overview.summary.developmentPlans}</p></article>
        </section>
      ) : null}

      <section className="pf-surface p-6">
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
        {isLoadingDataset ? (
          <p className="mt-3 text-xs text-[#9fb6c4]">Actualizando resultados...</p>
        ) : null}
      </section>

      <section className="pf-surface p-6">
        {isLoadingOverview ? <p className="mb-3 text-xs text-[#9fb6c4]">Actualizando historial...</p> : null}
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
