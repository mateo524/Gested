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
    badge: "Próximamente",
  },
  {
    key: "google_sheets",
    icon: "📊",
    title: "Google Sheets",
    desc: "Conectá una hoja de Google Sheets y mantené los datos sincronizados.",
    badge: "Próximamente",
  },
];

const IGNORE_LABEL = "— Ignorar columna —";

// ─── Utilities ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active:          { label: "Activa",           cls: "bg-green-100 text-green-700" },
    pending_mapping: { label: "Mapeo pendiente",  cls: "bg-yellow-100 text-yellow-700" },
    error:           { label: "Error",            cls: "bg-red-100 text-red-700" },
    disconnected:    { label: "Desconectada",     cls: "bg-gray-100 text-gray-500" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SyncStatBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-green-600 font-medium">+{stats.created} creados</span>
      <span className="text-blue-600 font-medium">↺ {stats.updated} actualizados</span>
      {stats.errors > 0 && <span className="text-red-600 font-medium">⚠ {stats.errors} errores</span>}
      {stats.skipped > 0 && <span className="text-gray-400">{stats.skipped} omitidos</span>}
    </div>
  );
}

// ─── Step 1 — Source selector ─────────────────────────────────────────────────

function SourceSelector({ onSelect }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">¿Desde dónde viene el Excel?</h2>
      <p className="text-sm text-gray-500 mb-5">
        Elegí la fuente de datos de empleados para tu empresa.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => !opt.badge && onSelect(opt.key)}
            className={[
              "relative flex flex-col gap-2 rounded-xl border p-4 text-left transition",
              opt.badge
                ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                : "cursor-pointer border-gray-200 bg-white hover:border-blue-400 hover:shadow-md",
            ].join(" ")}
          >
            {opt.badge && (
              <span className="absolute right-3 top-3 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                {opt.badge}
              </span>
            )}
            <span className="text-2xl">{opt.icon}</span>
            <span className="font-semibold text-gray-800">{opt.title}</span>
            <span className="text-xs text-gray-500">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2 — File upload & sheet selector ────────────────────────────────────

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

    // Detect sheets first
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/excel-sync/detect-sheets", {
        method: "POST",
        body: form,
        token,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
      const res = await apiFetch("/excel-sync/upload", {
        method: "POST",
        body: form,
        token,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
        <h2 className="text-lg font-semibold mb-1">Subí tu archivo Excel</h2>
        <p className="text-sm text-gray-500">
          Soporta .xlsx y .xls. El archivo no se almacena en Zentor.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition",
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50",
        ].join(" ")}
      >
        <span className="text-4xl">📂</span>
        <p className="text-sm text-gray-600">
          {fileName
            ? <><strong>{fileName}</strong> — cambiá el archivo haciendo clic acá</>
            : <>Arrastrá tu Excel acá o <span className="text-blue-600 underline">hacé clic para seleccionar</span></>}
        </p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ¿Qué hoja contiene los empleados?
          </label>
          <div className="flex flex-wrap gap-2">
            {sheets.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSheet(s)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  selectedSheet === s
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:border-blue-300",
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
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Analizando..." : "Analizar columnas →"}
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
      const res = await apiFetch(`/excel-sync/mapping/${connectionId}`, {
        method: "PATCH",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.connection);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // group by status for display
  const pendingItems  = mapping.filter((m) => m.status === "pending");
  const mappedItems   = mapping.filter((m) => m.status === "mapped");
  const ignoredItems  = mapping.filter((m) => m.status === "ignored");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Mapeá las columnas</h2>
        <p className="text-sm text-gray-500">
          Decile a Zentor qué significa cada columna de tu Excel. Lo hacés una sola vez.
        </p>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-green-600 font-medium">{mappedCount} mapeadas</span>
        {pendingCount > 0 && (
          <span className="text-yellow-600 font-medium">{pendingCount} sin asignar</span>
        )}
        <span className="text-gray-400">{ignoredItems.length} ignoradas</span>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          Tenés {pendingCount} columna{pendingCount > 1 ? "s" : ""} sin asignar.
          Podés ignorarlas o mapeárlas a un campo de Zentor.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-1/2">Columna en tu Excel</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-1/2">Campo en Zentor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...pendingItems, ...mappedItems, ...ignoredItems].map((item) => (
              <tr
                key={item.excelColumn}
                className={item.status === "ignored" ? "bg-gray-50 opacity-60" : "bg-white"}
              >
                <td className="px-4 py-2.5">
                  <span className="font-mono text-gray-700">{item.excelColumn}</span>
                  {item.status === "pending" && (
                    <span className="ml-2 inline-block rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-600">
                      sin asignar
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={item.zentorField ?? ""}
                    onChange={(e) => setField(item.excelColumn, e.target.value)}
                    className={[
                      "w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300",
                      item.status === "pending" ? "border-yellow-300 bg-yellow-50" : "border-gray-200",
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          ← Atrás
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? "Guardando..." : "Guardar mapeo →"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Sync & confirm ──────────────────────────────────────────────────

function SyncStep({ connection, fileBuffer, fileName, onSynced, onBack }) {
  const { token } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSync() {
    if (!fileBuffer) return;
    setSyncing(true);
    setError(null);
    try {
      const blob = new Blob([fileBuffer]);
      const form = new FormData();
      form.append("file", blob, fileName ?? "archivo.xlsx");
      const res = await apiFetch(`/excel-sync/sync/${connection._id}`, {
        method: "POST",
        body: form,
        token,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      onSynced(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Todo listo — sincronizá los datos</h2>
        <p className="text-sm text-gray-500">
          Zentor va a leer tu Excel y crear o actualizar los empleados en la plataforma.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Estado de la conexión</span>
          <StatusBadge status={connection.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Columnas mapeadas</span>
          <span className="text-sm font-medium">
            {connection.columnMapping?.filter((m) => m.status === "mapped").length ?? 0}
          </span>
        </div>
        {connection.pendingColumns?.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-700">
            {connection.pendingColumns.length} columna{connection.pendingColumns.length > 1 ? "s" : ""} nueva{connection.pendingColumns.length > 1 ? "s" : ""} detectada{connection.pendingColumns.length > 1 ? "s" : ""} — se importará sin esas columnas por ahora.
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-700">Sincronización completada</p>
          <SyncStatBar stats={result.stats} />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={syncing || !!result}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          ← Atrás
        </button>
        {!result && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        )}
        {result && (
          <button
            onClick={() => onSynced(result)}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
          >
            Ver empleados →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard view (existing connection) ─────────────────────────────────────

function ConnectionDashboard({ connection, zentorFields, onDisconnect, onReSync }) {
  const pendingCount  = connection.pendingColumns?.length ?? 0;
  const removedCount  = connection.removedColumns?.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sincronización Excel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {SOURCE_OPTIONS.find((s) => s.key === connection.source)?.title ?? connection.source}
          </p>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      {/* Alerts */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-semibold text-yellow-700 mb-1">
            Hay {pendingCount} columna{pendingCount > 1 ? "s" : ""} nueva{pendingCount > 1 ? "s" : ""} sin mapear
          </p>
          <ul className="space-y-1 mb-3">
            {connection.pendingColumns.map((c) => (
              <li key={c} className="text-sm font-mono text-yellow-800">• {c}</li>
            ))}
          </ul>
          <button
            onClick={onReSync}
            className="text-sm font-medium text-yellow-700 underline"
          >
            Ir a mapeo de columnas →
          </button>
        </div>
      )}

      {removedCount > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-700 mb-1">
            {removedCount} columna{removedCount > 1 ? "s" : ""} ya no existe{removedCount > 1 ? "n" : ""} en el Excel
          </p>
          <ul className="space-y-1">
            {connection.removedColumns.map((c) => (
              <li key={c} className="text-sm font-mono text-orange-800">• {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Last sync stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Última sincronización</p>
        {connection.lastSyncAt ? (
          <>
            <p className="text-xs text-gray-400">
              {new Date(connection.lastSyncAt).toLocaleString("es-AR")}
            </p>
            <SyncStatBar stats={connection.lastSyncStats} />
          </>
        ) : (
          <p className="text-sm text-gray-400">Nunca sincronizado</p>
        )}
      </div>

      {/* Column mapping summary */}
      <details className="rounded-xl border border-gray-200 overflow-hidden">
        <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100">
          Ver mapeo de columnas ({connection.columnMapping?.filter(m => m.status === "mapped").length ?? 0} mapeadas)
        </summary>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Columna en Excel</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Campo Zentor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(connection.columnMapping ?? []).map((m) => {
              const field = zentorFields.find((f) => f.key === m.zentorField);
              return (
                <tr key={m.excelColumn} className={m.status === "ignored" ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-mono text-gray-700">{m.excelColumn}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {field ? field.label : <span className="text-gray-400 italic">Ignorada</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <div className="flex gap-3">
        <button
          onClick={onReSync}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Sincronizar de nuevo
        </button>
        <button
          onClick={onDisconnect}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
        >
          Desconectar
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STEPS = ["source", "upload", "mapping", "sync", "dashboard"];

export default function ExcelSyncPage() {
  const { token } = useAuth();
  const [step, setStep] = useState("loading");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Data state
  const [zentorFields, setZentorFields] = useState([]);
  const [connection, setConnection] = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [fileName, setFileName] = useState(null);

  // Load on mount
  useEffect(() => {
    async function load() {
      try {
        const [fieldsRes, connRes] = await Promise.all([
          apiFetch("/excel-sync/fields", { token }),
          apiFetch("/excel-sync/connection", { token }),
        ]);
        const fieldsData = await fieldsRes.json();
        const connData   = await connRes.json();
        setZentorFields(fieldsData.fields ?? []);
        if (connData.connection) {
          setConnection(connData.connection);
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

  const handleAnalyzed = useCallback((result, buf, fName) => {
    setAnalyzeResult(result);
    setFileBuffer(buf);
    setFileName(fName);
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
    if (!window.confirm("¿Desconectar la sincronización Excel? Los empleados ya importados no se borran.")) return;
    try {
      await apiFetch(`/excel-sync/connection/${connection._id}`, { method: "DELETE", token });
      setConnection(null);
      setStep("source");
    } catch (err) {
      setError(err.message);
    }
  }

  function handleReSync() {
    setStep("upload");
  }

  // ─── Render

  if (step === "loading") {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sincronización Excel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Conectá el Excel de tu empresa y mantené los datos de empleados siempre actualizados.
        </p>
      </div>

      {/* Progress breadcrumb */}
      {step !== "dashboard" && step !== "loading" && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {[
            { key: "source",  label: "Fuente" },
            { key: "upload",  label: "Archivo" },
            { key: "mapping", label: "Columnas" },
            { key: "sync",    label: "Sincronizar" },
          ].map((s, i, arr) => (
            <span key={s.key} className="flex items-center gap-2">
              <span className={step === s.key ? "text-blue-600 font-semibold" : ""}>
                {i + 1}. {s.label}
              </span>
              {i < arr.length - 1 && <span>›</span>}
            </span>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {step === "source" && (
          <SourceSelector onSelect={(src) => setStep(src === "manual" ? "upload" : "source")} />
        )}

        {step === "upload" && (
          <FileUploadStep
            onAnalyzed={handleAnalyzed}
            loading={loading}
            setLoading={setLoading}
            setError={setError}
          />
        )}

        {step === "mapping" && analyzeResult && (
          <ColumnMappingStep
            connectionId={analyzeResult.connectionId}
            suggestedMapping={analyzeResult.suggestedMapping}
            zentorFields={zentorFields}
            onSaved={handleMappingSaved}
            onBack={() => setStep("upload")}
          />
        )}

        {step === "sync" && connection && (
          <SyncStep
            connection={connection}
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
