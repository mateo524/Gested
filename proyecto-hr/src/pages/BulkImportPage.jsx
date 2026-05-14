import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const sheetLabels = {
  organization: "Organizacion",
  departments: "Departamentos",
  employees: "Empleados",
  usersAndRoles: "Usuarios y Roles",
  managers: "Managers",
  kpis: "KPIs",
  okrs: "OKRs",
};

const previewTabs = [
  { key: "employees", label: "Empleados" },
  { key: "usersAndRoles", label: "Usuarios y Roles" },
  { key: "departments", label: "Departamentos" },
  { key: "managers", label: "Managers" },
  { key: "kpis", label: "KPIs" },
  { key: "okrs", label: "OKRs" },
  { key: "errors", label: "Errores" },
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildIssueMap(warnings = [], errors = []) {
  const map = new Map();
  [...warnings, ...errors].forEach((issue) => {
    const sheet = String(issue.sheet || "").trim();
    const rowNumber = String(issue.rowNumber || "");
    const key = `${sheet}:${rowNumber}`;
    const items = map.get(key) || [];
    items.push(issue);
    map.set(key, items);
  });
  return map;
}

function getNormalizedSheetName(tabKey) {
  if (tabKey === "usersAndRoles") return "Usuarios_y_Roles";
  if (tabKey === "employees") return "Empleados";
  if (tabKey === "departments") return "Departamentos";
  if (tabKey === "managers") return "Managers";
  if (tabKey === "kpis") return "KPIs";
  if (tabKey === "okrs") return "OKRs";
  if (tabKey === "organization") return "Organización";
  return sheetLabels[tabKey] || tabKey;
}

function statusMeta(status) {
  if (status === "error") {
    return {
      label: "Error",
      className: "border-rose-300/30 bg-rose-500/10 text-rose-200",
    };
  }
  if (status === "warning") {
    return {
      label: "Advertencia",
      className: "border-amber-300/30 bg-amber-500/10 text-amber-200",
    };
  }
  return {
    label: "Valido",
    className: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
  };
}

function PreviewCard({ row, issues }) {
  const hasError = issues.some((item) => item.severity === "error");
  const hasWarning = issues.some((item) => item.severity === "warning");
  const status = hasError ? "error" : hasWarning ? "warning" : "valid";
  const meta = statusMeta(status);
  const principal = Object.entries(row)
    .filter(([key]) => key !== "_rowNumber")
    .slice(0, 4);

  return (
    <article className="rounded-xl border border-white/10 bg-[#142028] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
          {meta.label}
        </span>
        <span className="text-xs text-[#8FA9B7]">Fila {row._rowNumber || "-"}</span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {principal.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-[#0F1A21] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7A9AAA]">{key}</p>
            <p className="mt-1 break-words text-sm text-[#E8EEF1]">{String(value ?? "-")}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {issues.length ? (
          issues.map((issue, index) => (
            <p
              key={`${issue.field || "msg"}-${index}`}
              className={`rounded-lg border px-3 py-2 text-sm ${
                issue.severity === "error"
                  ? "border-rose-300/20 bg-rose-500/10 text-rose-200"
                  : "border-amber-300/20 bg-amber-500/10 text-amber-200"
              }`}
            >
              {issue.message}
            </p>
          ))
        ) : (
          <p className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Lista para importar.
          </p>
        )}
      </div>
    </article>
  );
}

function JobResultCards({ result }) {
  const created =
    (result?.employees?.created || 0) +
    (result?.users?.created || 0) +
    (result?.kpis?.created || 0) +
    (result?.okrs?.created || 0);
  const updated =
    (result?.employees?.updated || 0) +
    (result?.users?.updated || 0) +
    (result?.roleAssignments?.updated || 0) +
    (result?.managers?.updated || 0);
  const skipped =
    (result?.departments?.skipped || 0) +
    (result?.users?.skipped || 0) +
    (result?.roleAssignments?.skipped || 0) +
    (result?.managers?.skipped || 0) +
    (result?.kpis?.skipped || 0) +
    (result?.okrs?.skipped || 0);
  const errors = result?.errors?.length || 0;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Creados</p><p className="mt-1 text-2xl font-semibold text-white">{created}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Actualizados</p><p className="mt-1 text-2xl font-semibold text-white">{updated}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Omitidos</p><p className="mt-1 text-2xl font-semibold text-white">{skipped}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Errores</p><p className="mt-1 text-2xl font-semibold text-rose-300">{errors}</p></div>
    </div>
  );
}

export default function BulkImportPage() {
  const { token, user, activeCompanyId } = useAuth();
  const fileInputRef = useRef(null);
  const historyRef = useRef(null);

  const canManageImport =
    user?.isSuperAdmin ||
    user?.permisos?.includes("manage_users") ||
    user?.permisos?.includes("manage_school_users") ||
    user?.permisos?.includes("manage_employees") ||
    user?.permisos?.includes("manage_roles");

  const canReadHistory = canManageImport || user?.permisos?.includes("view_audit");
  const isReadOnly = canReadHistory && !canManageImport;

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [analyzeResponse, setAnalyzeResponse] = useState(null);
  const [result, setResult] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedTab, setSelectedTab] = useState("employees");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  const summary = analyzeResponse?.summary || null;
  const preview = analyzeResponse?.preview || null;
  const blockingErrors = Number(summary?.errors || 0);
  const issueMap = useMemo(
    () => buildIssueMap(analyzeResponse?.warnings || [], analyzeResponse?.errors || []),
    [analyzeResponse]
  );

  const previewRowsByTab = useMemo(
    () => ({
      employees: preview?.employees || [],
      usersAndRoles: preview?.usersAndRoles || [],
      departments: preview?.departments || [],
      managers: preview?.managers || [],
      kpis: preview?.kpis || [],
      okrs: preview?.okrs || [],
    }),
    [preview]
  );

  const confirmSummary = useMemo(
    () => ({
      employeesToCreate: preview?.employees?.length || 0,
      employeesToUpdate: 0,
      usersToCreate: preview?.usersAndRoles?.length || 0,
      roleAssignmentsToCreate: preview?.usersAndRoles?.length || 0,
      departmentsToCreate: preview?.departments?.length || 0,
      managersToCreate: preview?.managers?.length || 0,
      kpisToCreate: preview?.kpis?.length || 0,
      okrsToCreate: preview?.okrs?.length || 0,
      skipped: 0,
    }),
    [preview]
  );

  const setFeedback = useCallback((type, text) => {
    setMessage({ type, text });
  }, []);

  const loadJobs = useCallback(async () => {
    if (!canReadHistory) return;
    try {
      setIsLoadingJobs(true);
      const data = await apiFetch("/bulk-import/jobs", { token });
      setJobs(data.items || []);
    } catch (error) {
      setFeedback("error", error.message);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [canReadHistory, setFeedback, token]);

  useEffect(() => {
    loadJobs();
  }, [activeCompanyId, loadJobs]);

  function renderMessage() {
    if (!message.text) return null;
    if (message.type === "success") return <div className="pf-alert-success">{message.text}</div>;
    if (message.type === "warning") return <div className="pf-alert-warning">{message.text}</div>;
    if (message.type === "info") return <div className="pf-alert-info">{message.text}</div>;
    return <div className="pf-alert-error">{message.text}</div>;
  }

  function clearFlow() {
    setAnalyzeResponse(null);
    setResult(null);
    setSelectedJob(null);
    setSelectedTab("employees");
    setFeedback("", "");
  }

  function handleFileChange(nextFile) {
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setFeedback("error", "Solo se aceptan archivos .xlsx.");
      return;
    }
    setFile(nextFile);
    clearFlow();
    setFeedback("info", "Archivo listo para validar.");
  }

  async function handleDownloadTemplate() {
    try {
      setIsDownloadingTemplate(true);
      setFeedback("", "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${apiUrl}/bulk-import/template`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error("No se pudo descargar la plantilla.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Plantilla_Performia_Importacion.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setFeedback("success", "Plantilla descargada.");
    } catch (error) {
      setFeedback(
        "error",
        error?.name === "AbortError"
          ? "La descarga de la plantilla demoro demasiado. Reintenta en unos segundos."
          : error.message
      );
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function handleAnalyze() {
    if (!file) {
      setFeedback("error", "Selecciona una plantilla .xlsx antes de validar.");
      return;
    }
    try {
      setIsAnalyzing(true);
      setFeedback("", "");
      const body = new FormData();
      body.append("file", file);
      const data = await apiFetch("/bulk-import/analyze", {
        method: "POST",
        token,
        body,
        timeoutMs: 120000,
      });
      setAnalyzeResponse(data);
      setResult(null);
      setSelectedJob(null);
      setSelectedTab(data.summary?.errors ? "errors" : "employees");
      setFeedback(
        data.summary?.errors ? "warning" : "success",
        data.summary?.errors
          ? "El archivo tiene errores bloqueantes. Revisa el detalle antes de confirmar."
          : "Archivo validado. Ya puedes revisar la vista previa."
      );
      await loadJobs();
    } catch (error) {
      const text = String(error.message || "").toLowerCase();
      setFeedback(
        "error",
        text.includes("tardo demasiado")
          ? "La validacion demoro demasiado. Reintenta con un archivo mas chico o vuelve a intentar en unos segundos."
          : error.message
      );
      setAnalyzeResponse(null);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!analyzeResponse?.previewToken) return;
    try {
      setIsConfirming(true);
      setFeedback("", "");
      const data = await apiFetch("/bulk-import/confirm", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importJobId: analyzeResponse.importJobId,
          previewToken: analyzeResponse.previewToken,
        }),
        timeoutMs: 120000,
      });
      setResult(data);
      setFeedback(data.ok ? "success" : "error", data.ok ? "Importacion completada." : "La importacion no pudo completarse.");
      await loadJobs();
    } catch (error) {
      const text = String(error.message || "").toLowerCase();
      setFeedback(
        "error",
        text.includes("tardo demasiado")
          ? "La confirmacion demoro demasiado. Revisa el historial antes de reintentar."
          : error.message
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleJobDetail(jobId) {
    try {
      const data = await apiFetch(`/bulk-import/jobs/${jobId}`, { token });
      setSelectedJob(data.job || null);
      historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFeedback("error", error.message);
    }
  }

  const currentRows = previewRowsByTab[selectedTab] || [];

  return (
    <div className="space-y-6">
      <section className="pf-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A9AAA]">Datos &gt; Carga masiva</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Carga Masiva Unificada</h2>
        <p className="mt-2 max-w-3xl text-sm text-[#A9BFCA]">
          Usá esta plantilla para cargar empleados, usuarios, roles, managers, KPIs y OKRs.
        </p>
        {isReadOnly ? (
          <div className="mt-4 rounded-xl border border-sky-300/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
            Tu acceso en esta pantalla es solo lectura. Puedes revisar historial y resultados.
          </div>
        ) : null}
      </section>

      {renderMessage()}

      <details className="pf-card overflow-hidden" open>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">1. Descargar plantilla</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          <p className="text-sm text-[#A9BFCA]">
            Descarga la plantilla oficial y complétala antes de subir el archivo.
          </p>
          <button type="button" onClick={handleDownloadTemplate} disabled={isDownloadingTemplate || !canManageImport} className="pf-button-primary mt-4">
            {isDownloadingTemplate ? "Descargando..." : "Descargar plantilla Excel"}
          </button>
        </div>
      </details>

      <details className="pf-card overflow-hidden" open>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">2. Subir archivo</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              if (canManageImport) setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (!canManageImport) return;
              handleFileChange(event.dataTransfer.files?.[0] || null);
            }}
            className={`rounded-2xl border border-dashed p-6 transition ${
              dragActive ? "border-[#28964D] bg-[#123224]" : "border-white/15 bg-[#0F1A21]"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-white">Arrastra la plantilla aquí o selecciónala desde tu equipo.</p>
                <p className="mt-1 text-sm text-[#8FA9B7]">Solo formato `.xlsx`.</p>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canManageImport} className="pf-button-secondary">
                Seleccionar archivo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Archivo</p><p className="mt-1 break-words text-sm text-white">{file?.name || "Sin archivo"}</p></div>
            <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Tamano</p><p className="mt-1 text-sm text-white">{file ? formatFileSize(file.size) : "-"}</p></div>
            <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Estado</p><p className="mt-1 text-sm text-white">{isAnalyzing ? "Validando" : file ? "Listo para validar" : "Pendiente"}</p></div>
            <div className="flex items-end"><button type="button" onClick={handleAnalyze} disabled={!canManageImport || !file || isAnalyzing} className="pf-button-primary w-full">{isAnalyzing ? "Validando archivo..." : "Validar archivo"}</button></div>
          </div>
        </div>
      </details>

      <details className="pf-card overflow-hidden" open={Boolean(summary)}>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">3. Validacion</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          {!summary ? (
            <p className="text-sm text-[#8FA9B7]">Todavía no hay una validación para mostrar.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Total filas</p><p className="mt-1 text-2xl font-semibold text-white">{summary.totalRows}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Validas</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{summary.validRows}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Advertencias</p><p className="mt-1 text-2xl font-semibold text-amber-300">{summary.warnings}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Errores</p><p className="mt-1 text-2xl font-semibold text-rose-300">{summary.errors}</p></div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="pf-table">
                  <thead className="bg-[#0F1A21] text-[#8FA9B7]">
                    <tr>
                      <th className="px-4 py-3">Solapa</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Validas</th>
                      <th className="px-4 py-3">Advertencias</th>
                      <th className="px-4 py-3">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.bySheet || {}).map(([sheetKey, item]) => (
                      <tr key={sheetKey} className="border-t border-white/10 text-[#E8EEF1]">
                        <td className="px-4 py-3">{sheetLabels[sheetKey] || sheetKey}</td>
                        <td className="px-4 py-3">{item.totalRows}</td>
                        <td className="px-4 py-3">{item.validRows}</td>
                        <td className="px-4 py-3">{item.warnings}</td>
                        <td className="px-4 py-3">{item.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </details>

      <details className="pf-card overflow-hidden" open={Boolean(preview)}>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">4. Vista previa</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          {!preview ? (
            <p className="text-sm text-[#8FA9B7]">Valida el archivo para ver una vista previa.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {previewTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedTab(tab.key)}
                    className={`rounded-xl px-4 py-2.5 text-sm transition ${
                      selectedTab === tab.key
                        ? "bg-[#1e3a8a] text-white"
                        : "border border-white/10 bg-[#142028] text-[#AFC3CE]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {selectedTab === "errors" ? (
                  <div className="space-y-3">
                    {[...(analyzeResponse?.errors || []), ...(analyzeResponse?.warnings || [])].length ? (
                      [...(analyzeResponse?.errors || []), ...(analyzeResponse?.warnings || [])].map((issue, index) => {
                        const meta = statusMeta(issue.severity);
                        return (
                          <article key={`${issue.sheet}-${issue.rowNumber || "general"}-${index}`} className="rounded-xl border border-white/10 bg-[#142028] p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                              <span className="text-sm text-white">{issue.sheet || "General"}</span>
                              <span className="text-xs text-[#8FA9B7]">{issue.rowNumber ? `Fila ${issue.rowNumber}` : "Regla general"}</span>
                            </div>
                            <p className="mt-3 text-sm text-[#E8EEF1]">{issue.message}</p>
                          </article>
                        );
                      })
                    ) : (
                      <div className="pf-alert-success">No se detectaron errores ni advertencias.</div>
                    )}
                  </div>
                ) : currentRows.length ? (
                  <div className="space-y-3">
                    {currentRows.map((row) => {
                      const issues = issueMap.get(`${getNormalizedSheetName(selectedTab)}:${String(row._rowNumber || "")}`) || [];
                      return <PreviewCard key={`${selectedTab}-${row._rowNumber}`} row={row} issues={issues} />;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#8FA9B7]">No hay filas para mostrar en esta solapa.</p>
                )}
              </div>
            </>
          )}
        </div>
      </details>

      <details className="pf-card overflow-hidden" open={Boolean(summary)}>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">5. Confirmar importacion</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          {!summary ? (
            <p className="text-sm text-[#8FA9B7]">Primero valida el archivo.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Empleados a crear</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.employeesToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Empleados a actualizar</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.employeesToUpdate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Usuarios a crear</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.usersToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Roles/asignaciones</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.roleAssignmentsToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Departamentos</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.departmentsToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Managers</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.managersToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">KPIs</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.kpisToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">OKRs</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.okrsToCreate}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Omitidos</p><p className="mt-1 text-lg font-semibold text-white">{confirmSummary.skipped}</p></div>
                <div className="rounded-xl border border-white/10 bg-[#0F1A21] px-4 py-3"><p className="text-xs text-[#7A9AAA]">Errores bloqueantes</p><p className="mt-1 text-lg font-semibold text-rose-300">{blockingErrors}</p></div>
              </div>

              {blockingErrors ? (
                <div className="mt-4 pf-alert-error">Hay errores bloqueantes. Corrige la plantilla y vuelve a validar antes de confirmar.</div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={handleConfirm} disabled={!canManageImport || isReadOnly || isConfirming || !analyzeResponse?.previewToken || blockingErrors > 0} className="pf-button-primary">
                  {isConfirming ? "Confirmando importacion..." : "Confirmar importacion"}
                </button>
                <button type="button" onClick={clearFlow} className="pf-button-secondary">Limpiar</button>
              </div>
            </>
          )}
        </div>
      </details>

      <details className="pf-card overflow-hidden" open={Boolean(result)}>
        <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-white">6. Resultado</summary>
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          {!result ? (
            <p className="text-sm text-[#8FA9B7]">Todavía no hay una importacion confirmada en esta sesión.</p>
          ) : (
            <>
              <div className={result.ok ? "pf-alert-success" : "pf-alert-error"}>
                {result.ok ? "Importacion completada." : "La importacion no pudo completarse."}
              </div>
              <div className="mt-4">
                <JobResultCards result={result.result || {}} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {result.reportUrl || result.downloadUrl ? (
                  <a href={result.reportUrl || result.downloadUrl} target="_blank" rel="noreferrer" className="pf-button-secondary">
                    Descargar reporte
                  </a>
                ) : null}
                <button type="button" onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="pf-button-secondary">
                  Ver historial
                </button>
              </div>
            </>
          )}
        </div>
      </details>

      <section ref={historyRef} className="pf-card p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Historial</h3>
            <p className="mt-1 text-sm text-[#8FA9B7]">Revisa validaciones y resultados del tenant activo.</p>
          </div>
          {isLoadingJobs ? <p className="text-sm text-[#8FA9B7]">Actualizando historial...</p> : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="pf-table">
            <thead className="bg-[#0F1A21] text-[#8FA9B7]">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Filas</th>
                <th className="px-4 py-3">Errores</th>
                <th className="px-4 py-3">Accion</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job._id} className="border-t border-white/10 text-[#E8EEF1]">
                  <td className="px-4 py-3">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3">{job.sourceFileName}</td>
                  <td className="px-4 py-3">{job.stage}</td>
                  <td className="px-4 py-3">{job.totalRows}</td>
                  <td className="px-4 py-3">{job.errorCount}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleJobDetail(job._id)} className="text-sm font-semibold text-[#8CB8FF]">
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {!jobs.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-sm text-[#8FA9B7]">
                    Todavia no hay importaciones registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedJob ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-[#0F1A21] p-4">
            <p className="text-base font-semibold text-white">{selectedJob.sourceFileName}</p>
            <p className="mt-1 text-sm text-[#8FA9B7]">
              Estado {selectedJob.stage} · creado {formatDate(selectedJob.createdAt)}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-[#142028] px-3 py-2"><p className="text-xs text-[#7A9AAA]">Validas</p><p className="mt-1 text-lg font-semibold text-white">{selectedJob.validRows}</p></div>
              <div className="rounded-lg border border-white/10 bg-[#142028] px-3 py-2"><p className="text-xs text-[#7A9AAA]">Errores</p><p className="mt-1 text-lg font-semibold text-white">{selectedJob.errorCount}</p></div>
              <div className="rounded-lg border border-white/10 bg-[#142028] px-3 py-2"><p className="text-xs text-[#7A9AAA]">Creados</p><p className="mt-1 text-lg font-semibold text-white">{selectedJob.createdCount || 0}</p></div>
              <div className="rounded-lg border border-white/10 bg-[#142028] px-3 py-2"><p className="text-xs text-[#7A9AAA]">Actualizados</p><p className="mt-1 text-lg font-semibold text-white">{selectedJob.updatedCount || 0}</p></div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
