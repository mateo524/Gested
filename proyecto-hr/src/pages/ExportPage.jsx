import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const chartColors = ["#0d9488", "#8b5cf6", "#f59e0b", "#38bdf8", "#fb7185", "#10b981"];

function ExportChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1a22] px-4 py-3 shadow-lg">
      {label ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9fb6c4]">{label}</p> : null}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="flex items-center gap-2 py-0.5 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.fill || entry.color }} />
          <span className="text-[#9fb6c4]">{entry.name}:</span>
          <span className="ml-auto pl-4 font-semibold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieChartLegend({ payload }) {
  if (!payload?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs text-[#9fb6c4]">
          <span className="h-2 w-3 rounded-full" style={{ background: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Todavía sin cargas";

  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SummaryCard({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
      <p className="text-xs uppercase tracking-widest text-[#14b8a6]">{label}</p>
      <h3 className="mt-4 text-4xl font-bold text-white">{value}</h3>
      <p className="mt-2 text-sm text-[#9fb6c4]">{hint}</p>
    </article>
  );
}

export default function ExportPage() {
  const { token, activeCompanyId, activeCompany } = useAuth();
  const [overview, setOverview] = useState(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [compare, setCompare] = useState({ left: "", right: "" });
  const [comparison, setComparison] = useState(null);
  const [form, setForm] = useState({
    nombreVisible: "",
    file: null,
  });
  const [uploadResult, setUploadResult] = useState(null);

  const loadOverview = useCallback(async () => {
    const data = await apiFetch("/export/overview", { token });
    setOverview(data);
  }, [token]);

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
  }, [activeCompanyId, loadOverview]);

  useEffect(() => {
    if (!compare.left || !compare.right || compare.left === compare.right) {
      setComparison(null);
      return;
    }

    apiFetch(`/export/compare?left=${compare.left}&right=${compare.right}`, { token })
      .then(setComparison)
      .catch((error) => setMessage(error.message));
  }, [compare.left, compare.right, token]);

  const compareOptions = useMemo(
    () => (overview?.files || []).filter((file) => file._id !== compare.left),
    [overview, compare.left]
  );

  const download = async (type) => {
    try {
      const response = await fetch(`${apiUrl}/export/${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo generar la exportacion");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = type === "csv" ? "zentor-reporte.csv" : "zentor-reporte.xlsx";
      a.click();

      window.URL.revokeObjectURL(url);
      setMessage(`Exportacion ${type.toUpperCase()} lista`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleImport = async (event) => {
    event.preventDefault();

    if (!form.file) {
      setMessage("Selecciona un archivo antes de importar");
      return;
    }

    try {
      setIsUploading(true);
      setMessage("");
      const body = new FormData();

      body.append("file", form.file);
      body.append("nombreVisible", form.nombreVisible);

      const data = await apiFetch("/export/import", {
        method: "POST",
        token,
        body,
      });

      setUploadResult(data);
      setForm({ nombreVisible: "", file: null });
      await loadOverview();
      setMessage(data.mensaje);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsUploading(false);
      const input = document.getElementById("zentor-import-file");
      if (input) input.value = "";
    }
  };

  const toggleFile = async (file) => {
    try {
      const data = await apiFetch(`/export/${file._id}/status`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activa: !file.activa }),
      });

      setMessage(data.mensaje);
      await loadOverview();
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!overview) {
    return <p className="text-[#9fb6c4]">Cargando datos de la empresa...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[#14b8a6]">Centro de datos ZENTOR</p>
          <h3 className="mt-3 text-4xl font-bold text-white">
            Importá, compará y explotá la información de {activeCompany?.nombre || "tu empresa"}
          </h3>
          <p className="mt-4 max-w-3xl text-[#9fb6c4]">
            Este modulo sirve para subir bases, decidir cuales quedan activas para el analisis,
            comparar dos cargas entre si y exportar cortes listos para auditoria o gestion.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => download("csv")}
              className="rounded-xl bg-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-[#022019]"
            >
              Descargar CSV operativo
            </button>
            <button
              onClick={() => download("excel")}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[#9fb6c4] hover:bg-white/[0.07]"
            >
              Descargar Excel ejecutivo
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-8">
          <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Ultima actividad</p>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-[#9fb6c4]">Ultima importacion</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatDate(overview.summary.latestUploadAt)}</p>
            </div>
            <div>
              <p className="text-[#9fb6c4]">Tamano maximo configurado</p>
              <p className="mt-2 text-2xl font-semibold text-white">{overview.summary.maxUploadSizeMb} MB</p>
            </div>
            <div>
              <p className="text-[#9fb6c4]">Bases activas en uso</p>
              <p className="mt-2 text-2xl font-semibold text-white">{overview.summary.activeFiles}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Bases cargadas"
          value={overview.summary.totalFiles}
          hint="Archivos historicos asociados a la empresa"
        />
        <SummaryCard
          label="Registros disponibles"
          value={overview.summary.totalRecords}
          hint="Datos listos para analisis y exportacion"
        />
        <SummaryCard
          label="Fuentes activas"
          value={overview.summary.activeFiles}
          hint="Solo estas impactan en exportaciones y lectura"
        />
        <SummaryCard
          label="Capacidad por archivo"
          value={`${overview.summary.maxUploadSizeMb} MB`}
          hint="Limite configurable desde parametros"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Importacion guiada</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Subir nueva base</h3>
            <p className="mt-2 text-[#9fb6c4]">
              Carga un Excel y ZENTOR lo procesa para convertirlo en registros listos para usar.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleImport}>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white placeholder:text-[#5a7a8e]"
              placeholder="Nombre visible de la base"
              value={form.nombreVisible}
              onChange={(event) =>
                setForm((current) => ({ ...current, nombreVisible: event.target.value }))
              }
            />

            <label className="block rounded-xl border border-dashed border-white/10 bg-[#0f2030]/60 px-4 py-6 text-center">
              <span className="block text-xs uppercase tracking-widest text-[#8fa9b7]">Archivo Excel</span>
              <span className="mt-2 block text-[#9fb6c4]">
                {form.file ? form.file.name : "Selecciona .xlsx o .xls"}
              </span>
              <input
                id="zentor-import-file"
                type="file"
                accept=".xlsx,.xls"
                className="mt-4 block w-full text-sm text-[#9fb6c4]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] || null,
                  }))
                }
              />
            </label>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#022019] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Importando datos..." : "Importar base"}
            </button>
          </form>

          {uploadResult ? (
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-5">
              <p className="text-xs uppercase tracking-widest text-emerald-400">Carga completada</p>
              <h4 className="mt-2 text-lg font-semibold text-white">{uploadResult.file.nombreVisible}</h4>
              <div className="mt-4 grid gap-3 text-sm text-[#9fb6c4] md:grid-cols-2">
                <p>Hoja detectada: {uploadResult.imported.hoja}</p>
                <p>Registros procesados: {uploadResult.imported.registros}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Fuentes disponibles</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Archivos de esta empresa</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#9fb6c4]">
              {overview.files.length} visibles
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {(Array.isArray(overview?.files) ? overview.files : []).length ? (
              (Array.isArray(overview?.files) ? overview.files : []).map((file) => (
                <article
                  key={file._id}
                  className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-white/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-white">{file.nombreVisible}</p>
                      <p className="mt-1 text-sm text-[#9fb6c4]">{file.nombreArchivo}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        file.activa
                          ? "border border-emerald-400/20 bg-emerald-500/8 text-emerald-400"
                          : "border border-white/10 bg-white/[0.04] text-[#9fb6c4]"
                      }`}
                    >
                      {file.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#9fb6c4]">
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">Hoja: {file.hoja || "Principal"}</span>
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">Registros: {file.registros || 0}</span>
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">Subido: {formatDate(file.fechaSubida)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFile(file)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium ${
                        file.activa
                          ? "border border-amber-400/20 bg-amber-500/8 text-amber-300"
                          : "border border-emerald-400/20 bg-emerald-500/8 text-emerald-400"
                      }`}
                    >
                      {file.activa ? "Desactivar para analisis" : "Activar para analisis"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-[#9fb6c4]">Todavía no se cargaron bases en esta empresa.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Lectura rapida</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Distribucion por rol</h3>
            </div>
          </div>

          <div className="mt-6 h-80">
            {overview.roles.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.roles} barCategoryGap="32%">
                  <defs>
                    <linearGradient id="gradExportBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#ffffff0d" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#9fb6c4" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#9fb6c4" }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip content={<ExportChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)", radius: 8 }} />
                  <Bar dataKey="value" name="Personas" radius={[10, 10, 0, 0]} fill="url(#gradExportBar)" maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-white/[0.06] bg-[#0f2030]/60 text-[#9fb6c4]">
                Sin datos suficientes para graficar todavía.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Calidad de base</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Dominios de correo detectados</h3>
          </div>

          <div className="mt-6 h-80">
            {(Array.isArray(overview?.domains) ? overview.domains : []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Array.isArray(overview?.domains) ? overview.domains : []}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={112}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {(Array.isArray(overview?.domains) ? overview.domains : []).map((item, index) => (
                      <Cell key={item.label} fill={chartColors[index % chartColors.length]} opacity={0.92} />
                    ))}
                  </Pie>
                  <Tooltip content={<ExportChartTooltip />} />
                  <Legend content={<PieChartLegend />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-white/[0.06] bg-[#0f2030]/60 text-[#9fb6c4]">
                Cuando se importen registros con email, vas a ver la distribución acá.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Comparacion de bases</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Comparar dos cargas</h3>
            <p className="mt-2 text-[#9fb6c4]">
              Ideal para validar diferencias entre períodos o cortes subidos por una misma empresa.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <select
              className="rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white"
              value={compare.left}
              onChange={(event) => setCompare((current) => ({ ...current, left: event.target.value }))}
            >
              <option value="">Selecciona base A</option>
              {(Array.isArray(overview?.files) ? overview.files : []).map((file) => (
                <option key={file._id} value={file._id}>
                  {file.nombreVisible}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white"
              value={compare.right}
              onChange={(event) => setCompare((current) => ({ ...current, right: event.target.value }))}
            >
              <option value="">Selecciona base B</option>
              {compareOptions.map((file) => (
                <option key={file._id} value={file._id}>
                  {file.nombreVisible}
                </option>
              ))}
            </select>
          </div>

      {comparison ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4">
                  <p className="font-semibold text-white">{comparison.left.nombreVisible}</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{comparison.left.registros} registros</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4">
                  <p className="font-semibold text-white">{comparison.right.nombreVisible}</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">{comparison.right.registros} registros</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Emails compartidos"
                  value={comparison.overlap.sharedEmails}
                  hint="Coincidencias entre ambas bases"
                />
                <SummaryCard
                  label="Unicos base A"
                  value={comparison.overlap.leftUniqueEmails}
                  hint="Presentes solo en la base izquierda"
                />
                <SummaryCard
                  label="Unicos base B"
                  value={comparison.overlap.rightUniqueEmails}
                  hint="Presentes solo en la base derecha"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Altas"
                  value={comparison.changes.addedCount}
                  hint="Registros que aparecen en la base nueva"
                />
                <SummaryCard
                  label="Bajas"
                  value={comparison.changes.removedCount}
                  hint="Registros que estaban y ya no aparecen"
                />
                <SummaryCard
                  label="Cambios"
                  value={comparison.changes.changedCount}
                  hint="Personas cuyo nombre o rol cambio"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Altas detectadas
                  </p>
                  <div className="mt-3 space-y-3">
                    {(Array.isArray(comparison?.changes?.added) ? comparison.changes.added : []).length ? (
                      (Array.isArray(comparison?.changes?.added) ? comparison.changes.added : []).map((item) => (
                        <div key={`added-${item.email}`} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 px-3 py-3 text-sm">
                          <p className="font-medium text-white">{item.nombreCompleto || item.email}</p>
                          <p className="text-[#9fb6c4]">{item.rol || "Sin rol"} · {item.email}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#9fb6c4]">No hay altas en la muestra comparada.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                    Bajas detectadas
                  </p>
                  <div className="mt-3 space-y-3">
                    {(Array.isArray(comparison?.changes?.removed) ? comparison.changes.removed : []).length ? (
                      (Array.isArray(comparison?.changes?.removed) ? comparison.changes.removed : []).map((item) => (
                        <div key={`removed-${item.email}`} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 px-3 py-3 text-sm">
                          <p className="font-medium text-white">{item.nombreCompleto || item.email}</p>
                          <p className="text-[#9fb6c4]">{item.rol || "Sin rol"} · {item.email}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#9fb6c4]">No hay bajas en la muestra comparada.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">
                    Cambios detectados
                  </p>
                  <div className="mt-3 space-y-3">
                    {(Array.isArray(comparison?.changes?.modified) ? comparison.changes.modified : (Array.isArray(comparison?.changes?.changed) ? comparison.changes.changed : [])).length ? (
                      (Array.isArray(comparison?.changes?.modified) ? comparison.changes.modified : (Array.isArray(comparison?.changes?.changed) ? comparison.changes.changed : [])).map((item) => (
                        <div key={`changed-${item.email}`} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 px-3 py-3 text-sm">
                          <p className="font-medium text-white">{item.email}</p>
                          <p className="text-[#9fb6c4]">
                            {item.before.nombreCompleto || "Sin nombre"} / {item.before.rol || "Sin rol"}
                          </p>
                          <p className="text-[#7a9aaa]">
                            {item.after.nombreCompleto || "Sin nombre"} / {item.after.rol || "Sin rol"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#9fb6c4]">No hay cambios en la muestra comparada.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-[#9fb6c4]">Selecciona dos bases distintas para ver la comparacion.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8fa9b7]">Vista previa</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Registros recientes</h3>
            <p className="mt-2 text-[#9fb6c4]">
              Muestra de los ultimos datos disponibles para validar consistencia y lectura.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[#9fb6c4]">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentRecords.length ? (
                  overview.recentRecords.map((record) => (
                    <tr key={record._id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-3 text-white">{record.nombreCompleto || "-"}</td>
                      <td className="px-4 py-3 text-[#9fb6c4]">{record.rol || "-"}</td>
                      <td className="px-4 py-3 text-[#9fb6c4]">{record.email || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">
                      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#7a9aaa]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </span>
                        <p className="text-sm font-semibold text-white">Sin registros para mostrar</p>
                        <p className="max-w-xs text-xs text-[#7a9aaa]">Los registros aparecen aquí luego de completar una importación masiva.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-white/10 bg-[#0c1e28] px-5 py-4 text-[#9fb6c4]">
          {message}
        </div>
      ) : null}
    </div>
  );
}
