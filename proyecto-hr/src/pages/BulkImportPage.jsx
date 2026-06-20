import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch, apiUrl } from "../lib/api";
import CollapsibleList from "../components/CollapsibleList";

const sheetLabels = {
  organization: "Organización",
  departments: "Departamentos",
  employees: "Empleados",
  usersAndRoles: "Usuarios y Roles",
  managers: "Managers",
  kpis: "KPIs",
  okrs: "OKRs",
  evaluations: "Evaluaciones",
  performanceMeasurements: "Mediciones de desempeño",
  developmentPlans: "Planes de desarrollo",
};

const templateSheets = [
  { key: "instructions", label: "Instrucciones", detail: "Uso general de la plantilla y reglas de carga." },
  { key: "organization", label: "Organización", detail: "Datos institucionales de referencia." },
  { key: "departments", label: "Departamentos", detail: "Areas, departamentos o unidades internas." },
  { key: "employees", label: "Empleados", detail: "Personas, legajos y datos base." },
  { key: "usersAndRoles", label: "Usuarios_y_Roles", detail: "Accesos, roles y scopes permitidos." },
  { key: "managers", label: "Managers", detail: "Relaciones de liderazgo y responsables." },
  { key: "kpis", label: "KPIs", detail: "Indicadores operativos cuando existan." },
  { key: "okrs", label: "OKRs", detail: "Objetivos y resultados clave del período." },
  { key: "evaluations", label: "Evaluaciones", detail: "Cabecera de evaluaciones existentes por empleado y ciclo." },
  { key: "performanceMeasurements", label: "Mediciones de desempeño", detail: "Metas, competencias, autoevaluaciones y evidencias por evaluación." },
  { key: "developmentPlans", label: "Planes de desarrollo", detail: "Planes de desarrollo previos o activos para importar o validar." },
  { key: "catalogs", label: "Catálogos", detail: "Valores válidos de roles, scopes y estados." },
];

const previewTabs = [
  { key: "employees", label: "Empleados" },
  { key: "usersAndRoles", label: "Usuarios y Roles" },
  { key: "departments", label: "Departamentos" },
  { key: "managers", label: "Managers" },
  { key: "kpis", label: "KPIs" },
  { key: "okrs", label: "OKRs" },
  { key: "evaluations", label: "Evaluaciones" },
  { key: "performanceMeasurements", label: "Mediciones" },
  { key: "developmentPlans", label: "Desarrollo" },
  { key: "errors", label: "Errores" },
];

const stepDefinitions = [
  { key: "template", number: 1, title: "Descargar plantilla", detail: "Baja la plantilla oficial y revisa sus hojas." },
  { key: "complete", number: 2, title: "Completar plantilla", detail: "Carga personas, roles, managers, KPIs, OKRs, evaluaciones y planes si ya existen." },
  { key: "upload", number: 3, title: "Subir archivo", detail: "Selecciona o arrastra el archivo .xlsx." },
  { key: "validation", number: 4, title: "Validación", detail: "Revisamos estructura, filas válidas y bloqueos." },
  { key: "preview", number: 5, title: "Vista previa", detail: "Chequea cada hoja antes de confirmar." },
  { key: "confirm", number: 6, title: "Confirmar importación", detail: "Solo si no hay errores bloqueantes." },
  { key: "result", number: 7, title: "Resultado", detail: "Consulta creados, actualizados y omitidos." },
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
  if (tabKey === "evaluations") return "Evaluaciones";
  if (tabKey === "performanceMeasurements") return "Mediciones_Desempeno";
  if (tabKey === "developmentPlans") return "Planes_Desarrollo";
  if (tabKey === "organization") return "Organización";
  return sheetLabels[tabKey] || tabKey;
}

function statusMeta(status) {
  if (status === "error") {
    return { label: "Error", className: "border-rose-300/30 bg-rose-500/10 text-rose-200", tone: "rose" };
  }
  if (status === "warning") {
    return { label: "Advertencia", className: "border-amber-300/30 bg-amber-500/10 text-amber-200", tone: "amber" };
  }
  return { label: "Válido", className: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200", tone: "emerald" };
}

function getServerMessage(error) {
  return error?.data?.message || error?.data?.mensaje || error?.message || "Ocurrió un error en el servidor.";
}

function isAnalyzeValidationError(error) {
  return (
    Number(error?.status) === 422 &&
    error?.data &&
    typeof error.data === "object" &&
    error.data.summary &&
    Array.isArray(error.data.errors)
  );
}

function SurfaceCard({ title, subtitle, actions, children }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#93acbb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StepCard({ step, status }) {
  const palette =
    status === "completed"
      ? "border-emerald-300/25 bg-emerald-500/10"
      : status === "active"
        ? "border-blue-300/30 bg-blue-500/10"
        : status === "error"
          ? "border-rose-300/25 bg-rose-500/10"
          : "border-white/10 bg-[#0f1f28]";

  const badgePalette =
    status === "completed"
      ? "bg-emerald-500 text-white"
      : status === "active"
        ? "bg-[#14b8a6] text-[#0f172a]"
        : status === "error"
          ? "bg-rose-500 text-white"
          : "bg-[#132530] text-[#a8bdc8]";

  return (
    <article className={`rounded-3xl border p-4 transition ${palette}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold ${badgePalette}`}>
          {step.number}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#9ab0bc]">{step.detail}</p>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-rose-300/20 bg-rose-500/10"
          : "border-white/10 bg-[#0f1f28]";

  return (
    <div className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-[#9ab0bc]">{hint}</p>
    </div>
  );
}

function SheetStatusCard({ label, stats = {} }) {
  const errors = Number(stats.errors || 0);
  const warnings = Number(stats.warnings || 0);
  const tone = errors > 0 ? "danger" : warnings > 0 ? "warning" : "success";
  const headerTone =
    tone === "danger" ? "text-rose-200" : tone === "warning" ? "text-amber-200" : "text-emerald-200";

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${headerTone}`}>
          {errors > 0 ? "Con errores" : warnings > 0 ? "Con advertencias" : "Lista"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatCard label="Validos" value={stats.validRows || 0} hint="Listos" tone={tone === "success" ? "success" : "default"} />
        <StatCard label="Adv." value={stats.warnings || 0} hint="Revisar" tone={warnings > 0 ? "warning" : "default"} />
        <StatCard label="Errores" value={stats.errors || 0} hint="Bloquean" tone={errors > 0 ? "danger" : "default"} />
      </div>
    </article>
  );
}

function PreviewCard({ row, issues }) {
  const hasError = issues.some((item) => item.severity === "error");
  const hasWarning = issues.some((item) => item.severity === "warning");
  const status = hasError ? "error" : hasWarning ? "warning" : "valid";
  const meta = statusMeta(status);
  const principal = Object.entries(row)
    .filter(([key]) => key !== "_rowNumber")
    .slice(0, 5);

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
        <span className="text-xs text-[#8FA9B7]">Fila {row._rowNumber || "-"}</span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {principal.map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-[#122530] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#7A9AAA]">{key}</p>
            <p className="mt-1 break-words text-sm text-[#E8EEF1]">{String(value ?? "-")}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {issues.length ? (
          issues.map((issue, index) => (
            <p
              key={`${issue.field || "msg"}-${index}`}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                issue.severity === "error"
                  ? "border-rose-300/20 bg-rose-500/10 text-rose-200"
                  : "border-amber-300/20 bg-amber-500/10 text-amber-200"
              }`}
            >
              {issue.message}
            </p>
          ))
        ) : (
          <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
            El registro se validó correctamente.
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
      <StatCard label="Creados" value={created} hint="Nuevos registros" tone="success" />
      <StatCard label="Actualizados" value={updated} hint="Cambios aplicados" tone="default" />
      <StatCard label="Omitidos" value={skipped} hint="No procesados" tone="warning" />
      <StatCard label="Errores" value={errors} hint="Pendientes" tone="danger" />
    </div>
  );
}

export default function BulkImportPage() {
  const { token, user, activeCompanyId } = useAuth();
  const { searchQuery } = useView();
  const fileInputRef = useRef(null);
  const historyRef = useRef(null);
  const previewRef = useRef(null);
  const resultRef = useRef(null);

  const canManageImport =
    user?.isSuperAdmin ||
    user?.permisos?.includes("manage_users") ||
    user?.permisos?.includes("manage_school_users") ||
    user?.permisos?.includes("manage_employees") ||
    user?.permisos?.includes("manage_roles");

  const canReadHistory = canManageImport || user?.permisos?.includes("view_audit");
  const isReadOnly = canReadHistory && !canManageImport;
  const showHistory = false;

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
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

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
      evaluations: preview?.evaluations || [],
      performanceMeasurements: preview?.performanceMeasurements || [],
      developmentPlans: preview?.developmentPlans || [],
    }),
    [preview]
  );
  const filteredVisibleRows = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    const rows = previewRowsByTab[selectedTab] || [];
    if (!term) return rows.slice(0, 8);
    return rows
      .filter((row) =>
        Object.entries(row || {})
          .filter(([key]) => key !== "_rowNumber")
          .some(([, value]) => String(value ?? "").toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [previewRowsByTab, searchQuery, selectedTab]);
  const filteredIssues = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    const issues = [...(analyzeResponse?.errors || []), ...(analyzeResponse?.warnings || [])];
    if (!term) return issues;
    return issues.filter((issue) =>
      [issue.sheet, issue.field, issue.message, issue.rowNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [analyzeResponse?.errors, analyzeResponse?.warnings, searchQuery]);

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
      evaluationsToReview: preview?.evaluations?.length || 0,
      measurementsToReview: preview?.performanceMeasurements?.length || 0,
      developmentPlansToReview: preview?.developmentPlans?.length || 0,
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

  const stepStatuses = useMemo(() => {
    const statuses = {
      template: file ? "completed" : "active",
      complete: file ? "completed" : "pending",
      upload: file ? "completed" : "active",
      validation: summary ? (blockingErrors > 0 ? "error" : "completed") : isAnalyzing ? "active" : "pending",
      preview: preview ? "completed" : "pending",
      confirm: result ? "completed" : analyzeResponse ? (blockingErrors > 0 ? "error" : "active") : "pending",
      result: result ? "completed" : "pending",
    };
    if (isAnalyzing) statuses.validation = "active";
    if (isConfirming) statuses.confirm = "active";
    return statuses;
  }, [file, summary, blockingErrors, preview, result, analyzeResponse, isAnalyzing, isConfirming]);

  const previewCountLabel = useMemo(() => {
    const rows = previewRowsByTab[selectedTab] || [];
    if (!rows.length) return "No encontramos datos para mostrar todavía.";
    if (rows.length > 8) return `Mostrando 8 de ${rows.length} registros en la vista previa.`;
    return `${rows.length} registros visibles en esta vista previa.`;
  }, [previewRowsByTab, selectedTab]);

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
      anchor.download = "Plantilla_ZENTOR_Importacion.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setFeedback("success", "Plantilla descargada.");
    } catch (error) {
      setFeedback(
        "error",
        error?.name === "AbortError"
          ? "La descarga de la plantilla demoró demasiado. Reintenta en unos segundos."
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
        data.summary?.errors
          ? "warning"
          : "success",
        data.message ||
          (data.summary?.errors
            ? "El archivo contiene errores de validación. Revisá los detalles antes de continuar."
            : "El archivo se validó correctamente.")
      );
      window.requestAnimationFrame(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      await loadJobs();
    } catch (error) {
      const text = String(error.message || "").toLowerCase();

      if (isAnalyzeValidationError(error)) {
        setAnalyzeResponse(error.data);
        setResult(null);
        setSelectedJob(null);
        setSelectedTab(error.data.summary?.errors ? "errors" : "employees");
        setFeedback(
          "warning",
          error.data.message || "El archivo contiene errores de validación. Revisá los detalles antes de continuar."
        );
        window.requestAnimationFrame(() => {
          previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        await loadJobs();
      } else if (text.includes("tardo demasiado")) {
        setAnalyzeResponse(null);
        setFeedback(
          "error",
          "La validación tardó demasiado. Probá con un archivo más chico o intentá nuevamente."
        );
      } else if (Number(error?.status) === 400 && error?.code === "BULK_IMPORT_INVALID_FILE") {
        setAnalyzeResponse(null);
        setFeedback(
          "error",
          getServerMessage(error) || "No pudimos leer el archivo .xlsx. Verifica que no esté dañado y vuelve a exportarlo antes de reintentar."
        );
      } else if (Number(error?.status) === 401) {
        setAnalyzeResponse(null);
        setFeedback("error", "Tu sesión expiró. Vuelve a iniciar sesión e intenta nuevamente.");
      } else if (Number(error?.status) === 403) {
        setAnalyzeResponse(null);
        setFeedback("error", "No tienes permisos para validar archivos en esta organización.");
      } else {
        setAnalyzeResponse(null);
        setFeedback("error", getServerMessage(error));
      }
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
      setFeedback(data.ok ? "success" : "error", data.ok ? "Importación completada." : "La importación no pudo completarse.");
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      await loadJobs();
    } catch (error) {
      const text = String(error.message || "").toLowerCase();
      setFeedback(
        "error",
        text.includes("expir")
          ? "La vista previa expiró. Volvé a subir el archivo."
          : text.includes("tardo demasiado")
            ? "La confirmación demoró demasiado. Revisá el historial antes de reintentar."
            : error.message
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleRevert() {
    const jobId = analyzeResponse?.importJobId || result?.importJobId;
    if (!jobId) return;
    if (!window.confirm("¿Revertir la importación? Se eliminarán los registros creados en los últimos segundos posteriores a la confirmación. Esta acción no se puede deshacer.")) return;
    try {
      setIsReverting(true);
      const data = await apiFetch(`/bulk-import/jobs/${jobId}/revert`, { method: "POST", token });
      setFeedback("success", data.mensaje || "Importación revertida.");
      await loadJobs();
    } catch (err) {
      setFeedback("error", err.message);
    } finally {
      setIsReverting(false);
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

  if (!canReadHistory && !canManageImport) {
    return (
      <div className="space-y-5">
        <section className="pf-surface pf-surface-pad">
          <p className="pf-section-title">Datos / Importación</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Importación</h1>
          <p className="mt-3 text-sm text-[#a8bdc8]">No tienes permisos para acceder a esta pantalla.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Datos</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Importación</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate || !canManageImport}
            className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {isDownloadingTemplate ? "Descargando..." : "Descargar plantilla"}
          </button>
          {showHistory ? (
            <button
              type="button"
              onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm font-medium text-white"
            >
              Ver historial
            </button>
          ) : null}
        </div>
      </div>

      {isReadOnly ? (
        <div className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          Tu acceso en esta pantalla es solo lectura. Puedes revisar historial y resultados.
        </div>
      ) : null}

      {renderMessage()}

      <SurfaceCard title="Flujo de importación" subtitle="La carga se hace en 7 pasos para evitar inserciones incompletas y errores de tenant.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {stepDefinitions.map((step) => (
            <StepCard key={step.key} step={step} status={stepStatuses[step.key]} />
          ))}
        </div>
      </SurfaceCard>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard
          title="Plantilla oficial"
          subtitle="Archivo base: Plantilla_ZENTOR_Importacion.xlsx"
          actions={
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate || !canManageImport}
              className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm text-white disabled:opacity-60"
            >
              {isDownloadingTemplate ? "Descargando..." : "Descargar"}
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templateSheets.map((sheet) => (
              <article key={sheet.key} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="text-sm font-semibold text-white">{sheet.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#9ab0bc]">{sheet.detail}</p>
              </article>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Subir archivo" subtitle="Solo aceptamos .xlsx y validamos antes de permitir cualquier confirmación.">
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
            className={`rounded-[28px] border-2 border-dashed p-6 transition ${
              dragActive ? "border-[#14b8a6] bg-[#123224]" : "border-white/15 bg-[#0f1f28]"
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-[#122530] text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path d="M12 4v10" />
                  <path d="M8 10l4 4 4-4" />
                  <path d="M4 20h16" />
                </svg>
              </div>
              <p className="mt-4 text-base font-semibold text-white">Arrastrá la plantilla aquí o selecciónala desde tu equipo</p>
              <p className="mt-2 text-sm text-[#8FA9B7]">Archivo permitido: .xlsx</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canManageImport}
                className="mt-4 rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                Seleccionar archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <StatCard label="Archivo" value={file?.name || "Sin archivo"} hint="Seleccion actual" tone="default" />
            <StatCard label="Tamano" value={file ? formatFileSize(file.size) : "-"} hint="Peso del archivo" tone="default" />
            <StatCard
              label="Estado"
              value={isAnalyzing ? "Validando" : file ? "Listo" : "Pendiente"}
              hint={isAnalyzing ? "Revisando estructura y filas" : file ? "Preparado para analizar" : "Todavía no se cargó un archivo"}
              tone={isAnalyzing ? "warning" : file ? "success" : "default"}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canManageImport || !file || isAnalyzing}
                className="w-full rounded-2xl bg-[#14b8a6] px-4 py-3 text-sm font-semibold text-[#0f172a] disabled:opacity-60"
              >
                {isAnalyzing ? "Validando archivo..." : "Validar archivo"}
              </button>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SurfaceCard title="Validación" subtitle="Resumen general del análisis y estado por solapa.">
          {!summary ? (
            <EmptyState text="No encontramos datos para mostrar todavía. Sube y valida una plantilla para ver el resumen." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Total filas" value={summary.totalRows || 0} hint="Procesadas" />
                <StatCard label="Validas" value={summary.validRows || 0} hint="Listas" tone="success" />
                <StatCard label="Advertencias" value={summary.warnings || 0} hint="Revisar" tone="warning" />
                <StatCard label="Errores" value={summary.errors || 0} hint="Bloquean" tone="danger" />
                <StatCard label="A crear" value={confirmSummary.employeesToCreate + confirmSummary.usersToCreate + confirmSummary.departmentsToCreate} hint="Estimado inicial" />
                <StatCard label="A actualizar" value={confirmSummary.employeesToUpdate} hint="Segun preview" />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <SheetStatusCard label="Empleados" stats={summary.bySheet?.employees} />
                <SheetStatusCard label="Usuarios y Roles" stats={summary.bySheet?.usersAndRoles} />
                <SheetStatusCard label="Departamentos" stats={summary.bySheet?.departments} />
                <SheetStatusCard label="Managers" stats={summary.bySheet?.managers} />
                <SheetStatusCard label="KPIs" stats={summary.bySheet?.kpis} />
                <SheetStatusCard label="OKRs" stats={summary.bySheet?.okrs} />
                <SheetStatusCard label="Evaluaciones" stats={summary.bySheet?.evaluations} />
                <SheetStatusCard label="Mediciones" stats={summary.bySheet?.performanceMeasurements} />
                <SheetStatusCard label="Planes de desarrollo" stats={summary.bySheet?.developmentPlans} />
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Confirmación" subtitle="Esta acción creará o actualizará registros en la organización activa.">
          {!summary ? (
            <EmptyState text="Primero validá el archivo para habilitar la confirmación." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <StatCard label="Empleados a crear" value={confirmSummary.employeesToCreate} hint="Desde la hoja Empleados" />
                <StatCard label="Empleados a actualizar" value={confirmSummary.employeesToUpdate} hint="No estimado en frontend" />
                <StatCard label="Usuarios a crear" value={confirmSummary.usersToCreate} hint="Accesos detectados" />
                <StatCard label="Roles / asignaciones" value={confirmSummary.roleAssignmentsToCreate} hint="Relacion usuario + scope" />
                <StatCard label="Departamentos" value={confirmSummary.departmentsToCreate} hint="Areas detectadas" />
                <StatCard label="Managers" value={confirmSummary.managersToCreate} hint="Responsables detectados" />
                <StatCard label="KPIs detectados" value={confirmSummary.kpisToCreate} hint="Registros operativos" />
                <StatCard label="OKRs detectados" value={confirmSummary.okrsToCreate} hint="Registros operativos" />
                <StatCard label="Evaluaciones" value={confirmSummary.evaluationsToReview} hint="Se validan en preview" />
                <StatCard label="Mediciones" value={confirmSummary.measurementsToReview} hint="Se validan en preview" />
                <StatCard label="Planes desarrollo" value={confirmSummary.developmentPlansToReview} hint="Se validan en preview" />
              </div>

              {(confirmSummary.evaluationsToReview || confirmSummary.measurementsToReview || confirmSummary.developmentPlansToReview) ? (
                <div className="pf-alert-info">
                  Evaluaciones, Mediciones de desempeño y Planes de desarrollo ya pueden validarse y verse en la vista previa. Su confirmación completa todavía queda fuera de esta importación guiada.
                </div>
              ) : null}

              {blockingErrors ? (
                <div className="pf-alert-error">Hay errores que deben corregirse antes de importar.</div>
              ) : (
                <div className="pf-alert-info">La vista previa está lista para confirmar en la organización activa.</div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canManageImport || isReadOnly || isConfirming || !analyzeResponse?.previewToken || blockingErrors > 0}
                  className="rounded-2xl bg-[#14b8a6] px-4 py-3 text-sm font-semibold text-[#0f172a] disabled:opacity-60"
                >
                  {isConfirming ? "Confirmando importación..." : "Confirmar importación"}
                </button>
                <button type="button" onClick={clearFlow} className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white">
                  Limpiar flujo
                </button>
              </div>
            </div>
          )}
        </SurfaceCard>
      </section>

      <div ref={previewRef}>
      <SurfaceCard title="Vista previa" subtitle={previewCountLabel}>
        {!preview ? (
          <EmptyState text="Valida el archivo para ver una vista previa por hoja antes de confirmar." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {previewTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTab(tab.key)}
                  className={`rounded-2xl px-4 py-2.5 text-sm transition ${
                    selectedTab === tab.key
                      ? "bg-[#14b8a6] text-[#0f172a]"
                      : "border border-white/10 bg-[#122530] text-[#a8bdc8]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedTab === "errors" ? (
              <div className="space-y-3">
                <CollapsibleList
                  items={filteredIssues}
                  initialCount={3}
                  buttonLabelMore={`Ver más (${filteredIssues.length - 3})`}
                  emptyState={<div className="pf-alert-success">No se detectaron errores ni advertencias.</div>}
                  renderItem={(issue, index) => {
                    const meta = statusMeta(issue.severity);
                    return (
                      <article key={`${issue.sheet}-${issue.rowNumber || "general"}-${index}`} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                          <span className="text-sm text-white">{issue.sheet || "General"}</span>
                          <span className="text-xs text-[#8FA9B7]">{issue.rowNumber ? `Fila ${issue.rowNumber}` : "Regla general"}</span>
                        </div>
                        <p className="mt-3 text-sm text-[#E8EEF1]">{issue.message}</p>
                      </article>
                    );
                  }}
                />
              </div>
            ) : filteredVisibleRows.length ? (
              <div className="space-y-3">
                {filteredVisibleRows.map((row) => {
                  const issues = issueMap.get(`${getNormalizedSheetName(selectedTab)}:${String(row._rowNumber || "")}`) || [];
                  return <PreviewCard key={`${selectedTab}-${row._rowNumber}`} row={row} issues={issues} />;
                })}
              </div>
            ) : (
              <EmptyState text={searchQuery ? "No hay filas que coincidan con la búsqueda actual." : "No hay filas para mostrar en esta solapa."} />
            )}
          </div>
        )}
      </SurfaceCard>
      </div>

      <div ref={resultRef}>
      <SurfaceCard title="Resultado" subtitle="Resumen final después de confirmar la importación.">
        {!result ? (
          <EmptyState text="Todavía no hay una importación confirmada en esta sesión." />
        ) : (
          <div className="space-y-4">
            <div className={result.ok ? "pf-alert-success" : "pf-alert-error"}>
              {result.ok ? "Importación completada." : "La importación no pudo completarse."}
            </div>
            <JobResultCards result={result.result || {}} />
            <div className="flex flex-wrap gap-3">
              {result.reportUrl || result.downloadUrl ? (
                <a href={result.reportUrl || result.downloadUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white">
                  Descargar reporte
                </a>
              ) : null}
              {result.ok && canManageImport ? (
                <button
                  type="button"
                  onClick={handleRevert}
                  disabled={isReverting}
                  className="rounded-2xl border border-rose-400/30 bg-rose-500/8 px-4 py-3 text-sm font-medium text-rose-200 hover:bg-rose-500/15 disabled:opacity-60"
                >
                  {isReverting ? "Revirtiendo..." : "Revertir importación"}
                </button>
              ) : null}
              {showHistory ? (
                <button
                  type="button"
                  onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white"
                >
                  Ver historial
                </button>
              ) : null}
            </div>
          </div>
        )}
      </SurfaceCard>
      </div>

      {showHistory ? (
      <section ref={historyRef}>
        <SurfaceCard
          title="Historial"
          subtitle="Revisa validaciones y resultados del tenant activo."
          actions={isLoadingJobs ? <span className="text-sm text-[#8FA9B7]">Actualizando historial...</span> : null}
        >
          <div className="overflow-x-auto rounded-3xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0f1f28] text-left text-[#8FA9B7]">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Filas</th>
                  <th className="px-4 py-3">Errores</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#122530]">
                {(showAllJobs ? jobs : jobs.slice(0, 10)).map((job) => (
                  <tr key={job._id} className="text-[#E8EEF1]">
                    <td className="px-4 py-3">{formatDate(job.createdAt)}</td>
                    <td className="px-4 py-3">{job.sourceFileName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#d6e2e8]">
                        {job.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">{job.totalRows}</td>
                    <td className="px-4 py-3">{job.errorCount}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => handleJobDetail(job._id)} className="text-sm font-semibold text-[#8CB8FF]">
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {jobs.length > 10 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center">
                      <button type="button" onClick={() => setShowAllJobs((prev) => !prev)} className="rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-[#d5e2e9] transition hover:bg-white/10">
                        {showAllJobs ? "Ver menos" : `Ver más (${jobs.length - 10})`}
                      </button>
                    </td>
                  </tr>
                ) : null}
                {!jobs.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-[#8FA9B7]">
                      No encontramos datos para mostrar todavía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selectedJob ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">{selectedJob.sourceFileName}</p>
                  <p className="mt-1 text-sm text-[#8FA9B7]">
                    Estado {selectedJob.stage} · creado {formatDate(selectedJob.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <StatCard label="Validas" value={selectedJob.validRows || 0} hint="Listas" />
                <StatCard label="Errores" value={selectedJob.errorCount || 0} hint="Detectados" tone="danger" />
                <StatCard label="Creados" value={selectedJob.createdCount || 0} hint="Resultado final" tone="success" />
                <StatCard label="Actualizados" value={selectedJob.updatedCount || 0} hint="Resultado final" />
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      </section>
      ) : null}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f1f28] px-4 py-6 text-sm text-[#8ea5b3]">{text}</div>;
}
