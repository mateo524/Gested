import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  {
    key: "manual",
    icon: "📂",
    title: "Subir archivo Excel",
    desc: "Subís tu Excel cada vez que querés actualizar. Ideal para empezar.",
  },
  {
    key: "onedrive",
    icon: "☁️",
    title: "Microsoft OneDrive / 365",
    desc: "Conectá tu Excel Online. Zentor lo lee automáticamente cuando cambia.",
  },
  {
    key: "google_sheets",
    icon: "📊",
    title: "Google Sheets",
    desc: "Conectá una hoja de Google Sheets y mantené los datos sincronizados.",
  },
];

const IGNORE_LABEL = "— Ignorar columna —";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "hace un momento";
  if (mins < 60) return `hace ${mins} minutos`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} hora${hrs > 1 ? "s" : ""}`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} día${days > 1 ? "s" : ""}`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active:          { label: "Activa",           cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    pending_mapping: { label: "Mapeo pendiente",  cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
    error:           { label: "Error",            cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
    disconnected:    { label: "Desconectada",     cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SyncStatBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="flex flex-wrap gap-3 text-sm font-variant-numeric tabular-nums">
      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        {stats.created} creados
      </span>
      <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        {stats.updated} actualizados
      </span>
      {stats.errors > 0 && (
        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          {stats.errors} errores
        </span>
      )}
      {stats.skipped > 0 && (
        <span className="text-slate-400">{stats.skipped} omitidos</span>
      )}
    </div>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
      <span className="flex-1">{error}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 leading-none">✕</button>
      )}
    </div>
  );
}

// ─── Step breadcrumb ──────────────────────────────────────────────────────────

const STEP_LABELS = [
  { key: "source",  label: "Fuente" },
  { key: "upload",  label: "Archivo" },
  { key: "files",   label: "Archivo" },   // cloud file picker — same visual slot as upload
  { key: "mapping", label: "Columnas" },
  { key: "sync",    label: "Sincronizar" },
];

const STEP_DISPLAY_ORDER = ["source", "upload", "mapping", "sync"];

function StepBreadcrumb({ step }) {
  // normalize "files" to "upload" position for breadcrumb display
  const active = step === "files" ? "upload" : step;
  return (
    <nav aria-label="Progreso" className="flex items-center gap-1.5 text-xs">
      {STEP_DISPLAY_ORDER.map((s, i, arr) => {
        const idx = STEP_DISPLAY_ORDER.indexOf(active);
        const isActive = s === active;
        const isPast = i < idx;
        return (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={[
                "flex items-center gap-1 font-medium transition-colors",
                isActive ? "text-blue-600" : isPast ? "text-slate-400 line-through" : "text-slate-400",
              ].join(" ")}
            >
              {isPast && (
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              )}
              {STEP_LABELS.find(l => l.key === s)?.label}
            </span>
            {i < arr.length - 1 && (
              <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Step 1 — Source selector ─────────────────────────────────────────────────

function SourceSelector({ onSelect, loading }) {
  const [redirecting, setRedirecting] = useState(null);

  async function handleSelect(key) {
    if (key === "manual") {
      onSelect("manual");
      return;
    }
    setRedirecting(key);
    try {
      const path = key === "onedrive"
        ? "/excel-sync/onedrive/auth-url"
        : "/excel-sync/google/auth-url";
      const res = await onSelect(key, path);
      // onSelect handles the redirect
    } catch {
      setRedirecting(null);
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-[#E8EEF1] mb-1">¿Desde dónde viene el Excel?</h2>
      <p className="text-sm text-slate-400 mb-5">
        Elegí la fuente de datos de empleados para tu empresa.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SOURCE_OPTIONS.map((opt) => {
          const isRedirecting = redirecting === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              disabled={!!redirecting || loading}
              className={[
                "relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1",
                "cursor-pointer border-white/[0.12] bg-white/[0.04] hover:border-teal-500/50 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60",
              ].join(" ")}
            >
              <span className="text-2xl leading-none">{opt.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#E8EEF1] mb-0.5">{opt.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
              </div>
              {isRedirecting && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#0f2028]/80">
                  <svg className="w-5 h-5 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2a — Cloud file picker (OneDrive / Google) ─────────────────────────

function CloudFilePicker({ source, token, connId, onFileSelected, onBack }) {
  const [files, setFiles] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadFiles() {
      setLoadingFiles(true);
      setError(null);
      try {
        const qs = connId ? `?connId=${connId}` : "";
        const path = source === "onedrive"
          ? `/excel-sync/onedrive/files${qs}`
          : `/excel-sync/google/files${qs}`;
        const data = await apiFetch(path, { token });
        setFiles(data.files ?? []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingFiles(false);
      }
    }
    loadFiles();
  }, [source, token]);

  async function handleSelect(file) {
    setSelecting(file.id);
    setError(null);
    try {
      const path = source === "onedrive"
        ? "/excel-sync/onedrive/select-file"
        : "/excel-sync/google/select-file";
      const data = await apiFetch(path, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, fileName: file.name, mimeType: file.mimeType, connId }),
      });
      onFileSelected(data);
    } catch (err) {
      setError(err.message);
      setSelecting(null);
    }
  }

  const sourceName = source === "onedrive" ? "OneDrive" : "Google Sheets";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#E8EEF1] mb-1">Seleccioná tu archivo</h2>
        <p className="text-sm text-slate-400">
          Archivos de {sourceName} disponibles en tu cuenta.
        </p>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loadingFiles ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : files && files.length === 0 ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-8 text-center text-sm text-slate-400">
          No se encontraron archivos Excel en tu {sourceName}.
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.1] overflow-hidden">
          {(files ?? []).map((file) => (
            <li key={file.id}>
              <button
                onClick={() => handleSelect(file)}
                disabled={!!selecting}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                <span className="text-xl leading-none shrink-0">
                  {source === "google_sheets" ? "📊" : "📗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E8EEF1] truncate">{file.name}</p>
                  {file.modifiedAt && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Modificado {relativeTime(file.modifiedAt) ?? new Date(file.modifiedAt).toLocaleDateString("es-AR")}
                    </p>
                  )}
                </div>
                {selecting === file.id ? (
                  <svg className="w-4 h-4 animate-spin text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Cambiar fuente
      </button>
    </div>
  );
}

// ─── Step 2b — Manual file upload ────────────────────────────────────────────

function FileUploadStep({ onAnalyzed, loading, setLoading, setError }) {
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [sheets, setSheets] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    setFileBuffer(buf);
    setSheets(null);
    setSelectedSheet(null);
    setError(null);

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/excel-sync/detect-sheets", {
        method: "POST",
        body: form,
        token,
      });
      setSheets(data.sheets);
      setSelectedSheet(data.sheets[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!fileBuffer || !selectedSheet) return;
    setLoading(true);
    setError(null);
    try {
      const blob = new Blob([fileBuffer]);
      const form = new FormData();
      form.append("file", blob, fileName ?? "archivo.xlsx");
      form.append("sheetName", selectedSheet);
      const data = await apiFetch("/excel-sync/upload", {
        method: "POST",
        body: form,
        token,
      });
      onAnalyzed(data, fileBuffer, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">Subí tu archivo Excel</h2>
        <p className="text-sm text-slate-500">
          Soporta .xlsx y .xls. El archivo no se almacena en Zentor.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          dragging
            ? "border-blue-400 bg-blue-50/60"
            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50",
        ].join(" ")}
      >
        <div className={[
          "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
          dragging ? "bg-blue-100" : "bg-slate-100",
        ].join(" ")}>
          <svg className={`w-6 h-6 ${dragging ? "text-blue-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
        </div>
        <div className="text-center">
          {fileName ? (
            <>
              <p className="text-sm font-medium text-slate-800">{fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">Clic para cambiar el archivo</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Arrastrá tu Excel acá o{" "}
                <span className="text-blue-600 font-medium underline underline-offset-2">seleccioná un archivo</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">.xlsx o .xls, cualquier tamaño</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {sheets && sheets.length > 1 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
            ¿Qué hoja contiene los empleados?
          </p>
          <div className="flex flex-wrap gap-2">
            {sheets.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSheet(s)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-sm transition-all",
                  selectedSheet === s
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-200 text-slate-600 hover:border-blue-300",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {fileName && selectedSheet && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              Analizando…
            </>
          ) : (
            <>Analizar columnas <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Step 3 — Column mapping ──────────────────────────────────────────────────

function ColumnMappingStep({ connectionId, suggestedMapping, zentorFields, onSaved, onBack }) {
  const { token } = useAuth();
  const [mapping, setMapping] = useState(suggestedMapping);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pendingCount = mapping.filter((m) => m.status === "pending").length;
  const mappedCount  = mapping.filter((m) => m.status === "mapped").length;
  const ignoredItems = mapping.filter((m) => m.status === "ignored");

  function setField(excelColumn, zentorField) {
    setMapping((prev) =>
      prev.map((m) =>
        m.excelColumn === excelColumn
          ? { ...m, zentorField: zentorField || null, status: zentorField ? "mapped" : "ignored" }
          : m
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch(`/excel-sync/mapping/${connectionId}`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });
      onSaved(data.connection);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const pendingItems = mapping.filter((m) => m.status === "pending");
  const mappedItems  = mapping.filter((m) => m.status === "mapped");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">Mapeá las columnas</h2>
        <p className="text-sm text-slate-500">
          Decile a Zentor qué significa cada columna de tu Excel. Lo hacés una sola vez.
        </p>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-emerald-600 font-medium">{mappedCount} mapeadas</span>
        {pendingCount > 0 && (
          <span className="text-amber-600 font-medium">{pendingCount} sin asignar</span>
        )}
        {ignoredItems.length > 0 && (
          <span className="text-slate-400">{ignoredItems.length} ignoradas</span>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          Tenés {pendingCount} columna{pendingCount > 1 ? "s" : ""} sin asignar.
          Podés ignorarlas o asignarlas a un campo de Zentor.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-1/2">Columna en tu Excel</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-1/2">Campo en Zentor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...pendingItems, ...mappedItems, ...ignoredItems].map((item) => (
                <tr
                  key={item.excelColumn}
                  className={item.status === "ignored" ? "bg-slate-50/60" : "bg-white"}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm ${item.status === "ignored" ? "text-slate-400" : "text-slate-700"}`}>
                        {item.excelColumn}
                      </span>
                      {item.status === "pending" && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-600 font-medium">
                          sin asignar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={item.zentorField ?? ""}
                      onChange={(e) => setField(item.excelColumn, e.target.value)}
                      className={[
                        "w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors",
                        item.status === "pending"
                          ? "border-amber-300 bg-amber-50/60"
                          : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      <option value="">{IGNORE_LABEL}</option>
                      {zentorFields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Atrás
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              Guardando…
            </>
          ) : (
            <>Guardar mapeo <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Sync ────────────────────────────────────────────────────────────

function SyncStep({ connection, source, fileBuffer, fileName, onSynced, onBack }) {
  const { token } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isCloud = source === "onedrive" || source === "google_sheets";

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      let res;
      if (isCloud) {
        res = await apiFetch(`/excel-sync/sync/${connection._id}`, {
          method: "POST",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } else {
        const blob = new Blob([fileBuffer]);
        const form = new FormData();
        form.append("file", blob, fileName ?? "archivo.xlsx");
        res = await apiFetch(`/excel-sync/sync/${connection._id}`, {
          method: "POST",
          body: form,
          token,
        });
      }
      setResult(data);
      onSynced(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const sourceInfo = SOURCE_OPTIONS.find((s) => s.key === (source || connection.source));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-1">Todo listo — sincronizá los datos</h2>
        <p className="text-sm text-slate-500">
          Zentor va a leer tu {sourceInfo?.title ?? "archivo"} y crear o actualizar los empleados en la plataforma.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Fuente</span>
          <span className="text-sm font-medium text-slate-700">
            {sourceInfo?.icon} {sourceInfo?.title}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Estado</span>
          <StatusBadge status={connection.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Columnas mapeadas</span>
          <span className="text-sm font-medium text-slate-700 tabular-nums">
            {connection.columnMapping?.filter((m) => m.status === "mapped").length ?? 0}
          </span>
        </div>
        {connection.pendingColumns?.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
            {connection.pendingColumns.length} columna{connection.pendingColumns.length > 1 ? "s" : ""} nueva{connection.pendingColumns.length > 1 ? "s" : ""} — se importará sin esas columnas por ahora.
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Sincronización completada
          </div>
          <SyncStatBar stats={result.stats} />
        </div>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={syncing || !!result}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Atrás
        </button>
        {!result ? (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                Sincronizando…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Sincronizar ahora
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onSynced(result)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1"
          >
            Ver empleados
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard view ────────────────────────────────────────────────────────────

function ConnectionDashboard({ connection, zentorFields, onDisconnect, onReSync }) {
  const { token } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const pendingCount = connection.pendingColumns?.length ?? 0;
  const removedCount = connection.removedColumns?.length ?? 0;
  const sourceInfo   = SOURCE_OPTIONS.find((s) => s.key === connection.source);
  const isCloud      = connection.source === "onedrive" || connection.source === "google_sheets";

  async function handleSyncNow() {
    setSyncing(true);
    setSyncError(null);
    setLastResult(null);
    try {
      const data = await apiFetch(`/excel-sync/sync/${connection._id}`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setLastResult(data.stats);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl shrink-0">
            {sourceInfo?.icon ?? "📂"}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 leading-tight">
              {sourceInfo?.title ?? connection.source}
            </h2>
            {connection.lastSyncAt && (
              <p className="text-xs text-slate-400 mt-0.5">
                {isCloud
                  ? `Última sincronización automática: ${relativeTime(connection.lastSyncAt)}`
                  : `Última sincronización: ${relativeTime(connection.lastSyncAt)}`}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      {/* Alerts */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-700 mb-1.5">
            {pendingCount} columna{pendingCount > 1 ? "s" : ""} nueva{pendingCount > 1 ? "s" : ""} sin mapear
          </p>
          <ul className="space-y-1 mb-3">
            {connection.pendingColumns.map((c) => (
              <li key={c} className="text-xs font-mono text-amber-800">· {c}</li>
            ))}
          </ul>
          <button
            onClick={onReSync}
            className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Ir a mapeo de columnas →
          </button>
        </div>
      )}

      {removedCount > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-700 mb-1.5">
            {removedCount} columna{removedCount > 1 ? "s" : ""} ya no existe{removedCount > 1 ? "n" : ""} en el archivo
          </p>
          <ul className="space-y-1">
            {connection.removedColumns.map((c) => (
              <li key={c} className="text-xs font-mono text-orange-800">· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Last sync result (from "Sincronizar ahora") */}
      {lastResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-700">Sincronización completada</p>
          <SyncStatBar stats={lastResult} />
        </div>
      )}

      <ErrorBanner error={syncError} onDismiss={() => setSyncError(null)} />

      {/* Last sync stats card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Última sincronización</p>
        {connection.lastSyncAt ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              {new Date(connection.lastSyncAt).toLocaleString("es-AR")}
            </p>
            <SyncStatBar stats={connection.lastSyncStats} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nunca sincronizado</p>
        )}
      </div>

      {/* Column mapping summary */}
      <details className="rounded-xl border border-slate-200 overflow-hidden group">
        <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors list-none">
          <span>Mapeo de columnas</span>
          <span className="flex items-center gap-2 text-xs text-slate-400 font-normal">
            {connection.columnMapping?.filter(m => m.status === "mapped").length ?? 0} mapeadas
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          </span>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Columna en Excel</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Campo Zentor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(connection.columnMapping ?? []).map((m) => {
                const field = zentorFields.find((f) => f.key === m.zentorField);
                return (
                  <tr key={m.excelColumn} className={m.status === "ignored" ? "opacity-50" : ""}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{m.excelColumn}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-sm">
                      {field ? field.label : <span className="text-slate-300 italic">Ignorada</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {isCloud && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                Sincronizando…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Sincronizar ahora
              </>
            )}
          </button>
        )}
        {!isCloud && (
          <button
            onClick={onReSync}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            Sincronizar de nuevo
          </button>
        )}
        <button
          onClick={onReSync}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
          Re-mapear columnas
        </button>
        <button
          onClick={onDisconnect}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ml-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          Desconectar
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExcelSyncPage() {
  const { token } = useAuth();
  const [step, setStep] = useState("loading");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Data state
  const [zentorFields, setZentorFields]   = useState([]);
  const [connection, setConnection]       = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [fileBuffer, setFileBuffer]       = useState(null);
  const [fileName, setFileName]           = useState(null);
  const [activeSource, setActiveSource]   = useState(null); // "manual" | "onedrive" | "google_sheets"

  const [activeConnId, setActiveConnId] = useState(null); // connId being configured right now

  // Load on mount — also detect OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const odriveBack = params.get("onedrive") === "connected";
    const googleBack = params.get("google")   === "connected";
    const connId     = params.get("connId");

    if (odriveBack || googleBack) {
      window.history.replaceState({}, "", window.location.pathname);
      setActiveSource(odriveBack ? "onedrive" : "google_sheets");
      if (connId) setActiveConnId(connId);
    }

    async function load() {
      try {
        const [fieldsData, connData] = await Promise.all([
          apiFetch("/excel-sync/fields", { token }),
          connId
            ? apiFetch(`/excel-sync/connection?id=${connId}`, { token })
            : apiFetch("/excel-sync/connections", { token }),
        ]);
        setZentorFields(fieldsData.fields ?? []);

        // Multi-connection: connData may be { connections: [...] } or { connection: ... }
        const connections = connData.connections ?? (connData.connection ? [connData.connection] : []);
        const activeConns = connections.filter(c => c.status !== "disconnected");

        if (googleBack || odriveBack) {
          // Coming back from OAuth — go to file picker for the new connection
          setError(null);
          setStep("files");
        } else if (activeConns.length === 1 && ["pending_file", "pending_mapping"].includes(activeConns[0].status)) {
          // Mid-setup connection — resume it
          const c = activeConns[0];
          setConnection(c);
          setActiveConnId(c._id);
          setActiveSource(c.source);
          setError(null);
          if (c.status === "pending_file") {
            setStep("files");
          } else {
            // pending_mapping: populate analyzeResult from saved connection so mapping UI renders
            setAnalyzeResult({
              connectionId: c._id,
              suggestedMapping: c.columnMapping ?? [],
              detectedColumns: c.detectedColumns ?? [],
              sheets: c.sheetName ? [c.sheetName] : [],
            });
            setStep("mapping");
          }
        } else if (activeConns.length > 0) {
          setConnection(activeConns[0]);
          setStep("dashboard");
        } else {
          setStep("source");
        }
      } catch (err) {
        setError(err.message);
        setStep("source");
      }
    }
    load();
  }, [token]);

  // Source selector handler — initiates redirect for cloud sources
  async function handleSourceSelect(src, authPath) {
    if (src === "manual") {
      setActiveSource("manual");
      setStep("upload");
      return;
    }
    // Cloud: fetch auth URL and redirect
    setActiveSource(src);
    try {
      const data = await apiFetch(authPath, { token });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setActiveSource(null);
    }
  }

  const handleAnalyzed = useCallback((result, buf, fName) => {
    setAnalyzeResult(result);
    setFileBuffer(buf);
    setFileName(fName);
    setStep("mapping");
  }, []);

  // Called after cloud file is selected — result has connectionId + suggestedMapping
  const handleCloudFileSelected = useCallback((result) => {
    setAnalyzeResult(result);
    setStep("mapping");
  }, []);

  const handleMappingSaved = useCallback((updatedConnection) => {
    setConnection(updatedConnection);
    setStep("sync");
  }, []);

  const handleSynced = useCallback((result) => {
    setConnection(result.connection);
    setStep("dashboard");
  }, []);

  async function handleDisconnect() {
    if (!connection) return;
    if (!window.confirm("¿Desconectar la sincronización? Los empleados ya importados no se borran.")) return;
    try {
      await apiFetch(`/excel-sync/connection/${connection._id}`, { method: "DELETE", token });
      setConnection(null);
      setActiveSource(null);
      setStep("source");
    } catch (err) {
      setError(err.message);
    }
  }

  function handleReSync() {
    if (connection?.source === "manual" || activeSource === "manual") {
      setStep("upload");
    } else if (connection?.source === "onedrive" || connection?.source === "google_sheets") {
      setStep("mapping");
    } else {
      setStep("upload");
    }
  }

  // ─── Render

  if (step === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div className="skeleton h-7 w-52 rounded-lg" />
        <div className="skeleton h-5 w-80 rounded" />
        <div className="skeleton h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const showBreadcrumb = step !== "dashboard" && step !== "loading";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Sincronización Excel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Conectá el Excel de tu empresa y mantené los datos de empleados siempre actualizados.
        </p>
      </div>

      {/* Breadcrumb */}
      {showBreadcrumb && <StepBreadcrumb step={step} />}

      {/* Global error banner */}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Main card */}
      <div className="pf-card p-6">
        {step === "source" && (
          <SourceSelector
            onSelect={handleSourceSelect}
            loading={loading}
          />
        )}

        {step === "upload" && (
          <FileUploadStep
            onAnalyzed={handleAnalyzed}
            loading={loading}
            setLoading={setLoading}
            setError={setError}
          />
        )}

        {step === "files" && activeSource && (
          <CloudFilePicker
            source={activeSource}
            token={token}
            connId={activeConnId}
            onFileSelected={handleCloudFileSelected}
            onBack={() => setStep("source")}
          />
        )}

        {step === "mapping" && analyzeResult && (
          <ColumnMappingStep
            connectionId={analyzeResult.connectionId}
            suggestedMapping={analyzeResult.suggestedMapping}
            zentorFields={zentorFields}
            onSaved={handleMappingSaved}
            onBack={() => setStep(activeSource === "manual" ? "upload" : "files")}
          />
        )}

        {step === "sync" && connection && (
          <SyncStep
            connection={connection}
            source={activeSource ?? connection.source}
            fileBuffer={fileBuffer}
            fileName={fileName}
            onSynced={handleSynced}
            onBack={() => setStep("mapping")}
          />
        )}

        {step === "dashboard" && connection && (
          <ConnectionDashboard
            connection={connection}
            zentorFields={zentorFields}
            onDisconnect={handleDisconnect}
            onReSync={handleReSync}
          />
        )}
      </div>
    </div>
  );
}
