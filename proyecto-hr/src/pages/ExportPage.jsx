import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";

const chartColors = ["#10b981", "#0f172a", "#f59e0b", "#38bdf8", "#fb7185", "#8b5cf6"];

function formatDate(value) {
  if (!value) return "Todavia sin cargas";

  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SummaryCard({ label, value, hint }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <h3 className="mt-4 text-4xl font-bold text-slate-950">{value}</h3>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

export default function ExportPage() {
  const { token, activeCompanyId, activeCompany } = useAuth();
  const [overview, setOverview] = useState(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState({
    nombreVisible: "",
    file: null,
  });
  const [uploadResult, setUploadResult] = useState(null);

  async function loadOverview() {
    const data = await apiFetch("/export/overview", { token });
    setOverview(data);
  }

  useEffect(() => {
    loadOverview().catch((error) => setMessage(error.message));
  }, [token, activeCompanyId]);

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
      a.download = type === "csv" ? "gested-reporte.csv" : "gested-reporte.xlsx";
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
      const input = document.getElementById("gested-import-file");
      if (input) input.value = "";
    }
  };

  if (!overview) {
    return <p className="text-slate-500">Cargando datos de la empresa...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-500">
            Centro de datos Gested
          </p>
          <h3 className="mt-3 text-4xl font-bold text-slate-950">
            Importa, ordena y explota la informacion de {activeCompany?.nombre || "tu empresa"}
          </h3>
          <p className="mt-4 max-w-3xl text-slate-500">
            Este modulo sirve para subir bases, consolidar registros y exportar cortes listos para
            analisis, auditoria o trabajo operativo. Lo importado queda asociado solo a la empresa
            activa.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => download("csv")}
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-white"
            >
              Descargar CSV operativo
            </button>
            <button
              onClick={() => download("excel")}
              className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Descargar Excel ejecutivo
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Ultima actividad</p>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-slate-400">Ultima importacion</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatDate(overview.summary.latestUploadAt)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Tamano maximo configurado</p>
              <p className="mt-2 text-2xl font-semibold">
                {overview.summary.maxUploadSizeMb} MB
              </p>
            </div>
            <div>
              <p className="text-slate-400">Bases activas en uso</p>
              <p className="mt-2 text-2xl font-semibold">{overview.summary.activeFiles}</p>
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
          hint="Solo estas impactan en las exportaciones"
        />
        <SummaryCard
          label="Capacidad por archivo"
          value={`${overview.summary.maxUploadSizeMb} MB`}
          hint="Limite configurable desde parametros"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Importacion guiada</p>
            <h3 className="mt-2 text-2xl font-semibold">Subir nueva base</h3>
            <p className="mt-2 text-slate-500">
              Carga un Excel y Gested lo procesa para convertirlo en registros listos para usar.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleImport}>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre visible de la base"
              value={form.nombreVisible}
              onChange={(event) =>
                setForm((current) => ({ ...current, nombreVisible: event.target.value }))
              }
            />

            <label className="block rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
              <span className="block text-sm uppercase tracking-[0.18em] text-slate-400">
                Archivo Excel
              </span>
              <span className="mt-2 block text-slate-600">
                {form.file ? form.file.name : "Selecciona .xlsx o .xls"}
              </span>
              <input
                id="gested-import-file"
                type="file"
                accept=".xlsx,.xls"
                className="mt-4 block w-full text-sm text-slate-500"
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
              className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Importando datos..." : "Importar base"}
            </button>
          </form>

          {uploadResult ? (
            <div className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-emerald-700">
                Carga completada
              </p>
              <h4 className="mt-2 text-lg font-semibold text-slate-950">
                {uploadResult.file.nombreVisible}
              </h4>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <p>Hoja detectada: {uploadResult.imported.hoja}</p>
                <p>Registros procesados: {uploadResult.imported.registros}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Bases recientes</p>
              <h3 className="mt-2 text-2xl font-semibold">Archivos de esta empresa</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
              {overview.files.length} visibles
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {overview.files.length ? (
              overview.files.map((file) => (
                <article
                  key={file._id}
                  className="rounded-[1.75rem] border border-slate-200 p-5 transition hover:border-emerald-200"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{file.nombreVisible}</p>
                      <p className="mt-1 text-sm text-slate-500">{file.nombreArchivo}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        file.activa
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {file.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Hoja: {file.hoja || "Principal"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Registros: {file.registros || 0}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Subido: {formatDate(file.fechaSubida)}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavia no se cargaron bases en esta empresa.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Lectura rapida</p>
              <h3 className="mt-2 text-2xl font-semibold">Distribucion por rol</h3>
            </div>
          </div>

          <div className="mt-6 h-80">
            {overview.roles.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.roles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" />
                  <YAxis allowDecimals={false} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-[1.75rem] bg-slate-50 text-slate-500">
                Sin datos suficientes para graficar todavia.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Calidad de base</p>
            <h3 className="mt-2 text-2xl font-semibold">Dominios de correo detectados</h3>
          </div>

          <div className="mt-6 h-80">
            {overview.domains.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overview.domains}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                  >
                    {overview.domains.map((item, index) => (
                      <Cell key={item.label} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-[1.75rem] bg-slate-50 text-slate-500">
                Cuando se importen registros con email, vas a ver la distribucion aca.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Vista previa</p>
          <h3 className="mt-2 text-2xl font-semibold">Registros recientes</h3>
          <p className="mt-2 text-slate-500">
            Muestra de los ultimos datos disponibles para validar consistencia y lectura.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentRecords.length ? (
                overview.recentRecords.map((record) => (
                  <tr key={record._id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{record.nombreCompleto || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{record.rol || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{record.email || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan="3">
                    Todavia no hay registros importados para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-slate-700 shadow-sm">
          {message}
        </div>
      ) : null}
    </div>
  );
}
