import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function formatDate(value) {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const emptyFilters = {
  companyId: "",
  tipoArchivo: "",
  q: "",
};

export default function StorageCenterPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    companyId: "",
    nombreVisible: "",
    tipoArchivo: "documento",
    file: null,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const built = params.toString();
    return built ? `?${built}` : "";
  }, [filters]);

  useEffect(() => {
    apiFetch(`/storage/overview${queryString}`, { token })
      .then(setData)
      .catch((error) => setMessage(error.message));
  }, [token, queryString]);

  async function openDetail(fileId) {
    try {
      const next = await apiFetch(`/storage/${fileId}/detail`, { token });
      setDetail(next);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();

    if (!uploadForm.companyId || !uploadForm.nombreVisible || !uploadForm.file) {
      setMessage("Completa empresa, nombre visible y archivo");
      return;
    }

    try {
      setIsUploading(true);
      setMessage("");
      const body = new FormData();
      body.append("companyId", uploadForm.companyId);
      body.append("nombreVisible", uploadForm.nombreVisible);
      body.append("tipoArchivo", uploadForm.tipoArchivo);
      body.append("file", uploadForm.file);

      await apiFetch("/storage/upload", {
        method: "POST",
        token,
        body,
      });

      setUploadForm({
        companyId: "",
        nombreVisible: "",
        tipoArchivo: "documento",
        file: null,
      });
      setMessage("Documento agregado al archivo central");
      const input = document.getElementById("storage-upload-file");
      if (input) input.value = "";
      const next = await apiFetch(`/storage/overview${queryString}`, { token });
      setData(next);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  if (!data) {
    return <p className="text-slate-500">Cargando archivo central...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Supervision central</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Archivo central de empresas</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Desde aca el superadmin puede revisar todo lo que se subio a la app, separado por empresa
          y tipo de archivo, con acceso rapido a la fuente y una vista previa de contenido.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Archivos</p>
          <h3 className="mt-4 text-4xl font-bold text-slate-950">{data.summary.totalFiles}</h3>
        </article>
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Activos</p>
          <h3 className="mt-4 text-4xl font-bold text-slate-950">{data.summary.activeFiles}</h3>
        </article>
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Empresas con contenido</p>
          <h3 className="mt-4 text-4xl font-bold text-slate-950">{data.summary.companiesWithFiles}</h3>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Subir documento operativo</h3>
          <p className="mt-1 text-slate-500">
            Suma contratos, instructivos, PDF o respaldos para que Performia los conserve por empresa.
          </p>

          <form className="mt-6 space-y-4" onSubmit={uploadDocument}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={uploadForm.companyId}
              onChange={(event) => setUploadForm({ ...uploadForm, companyId: event.target.value })}
            >
              <option value="">Selecciona empresa</option>
              {data.filters.companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.nombre}
                </option>
              ))}
            </select>

            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre visible del documento"
              value={uploadForm.nombreVisible}
              onChange={(event) => setUploadForm({ ...uploadForm, nombreVisible: event.target.value })}
            />

            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={uploadForm.tipoArchivo}
              onChange={(event) => setUploadForm({ ...uploadForm, tipoArchivo: event.target.value })}
            >
              <option value="documento">Documento</option>
              <option value="contrato">Contrato</option>
              <option value="instructivo">Instructivo</option>
              <option value="respaldo">Respaldo</option>
            </select>

            <input
              id="storage-upload-file"
              type="file"
              className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-500"
              onChange={(event) => setUploadForm({ ...uploadForm, file: event.target.files?.[0] || null })}
            />

            <button
              type="submit"
              disabled={isUploading}
              className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Guardando..." : "Guardar en archivo central"}
            </button>
          </form>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-56">
            <span className="mb-2 block text-sm text-slate-500">Empresa</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.companyId}
              onChange={(event) => setFilters({ ...filters, companyId: event.target.value })}
            >
              <option value="">Todas</option>
              {data.filters.companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-56">
            <span className="mb-2 block text-sm text-slate-500">Tipo de archivo</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={filters.tipoArchivo}
              onChange={(event) => setFilters({ ...filters, tipoArchivo: event.target.value })}
            >
              <option value="">Todos</option>
              {data.filters.types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-56 flex-1">
            <span className="mb-2 block text-sm text-slate-500">Buscar</span>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre, archivo o contenido"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium"
          >
            Limpiar
          </button>
        </div>
      </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Contenido subido</h3>
          <p className="mt-1 text-slate-500">Listado central con empresa, tipo, estado y fecha de carga.</p>

          <div className="mt-6 space-y-4">
            {data.files.map((file) => (
              <article key={file._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{file.nombreVisible}</p>
                    <p className="mt-1 text-sm text-slate-500">{file.company?.nombre || "Sin empresa"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {file.tipoArchivo}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        file.activa ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {file.activa ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">Extension: {file.extension}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">Registros: {file.registros || 0}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">Subido: {formatDate(file.fechaSubida)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => openDetail(file._id)}
                  className="mt-4 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                >
                  Ver detalle
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Vista previa</h3>
          <p className="mt-1 text-slate-500">Lectura rapida del archivo seleccionado y sus registros recientes.</p>

          {detail ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-[1.75rem] border border-slate-200 p-5">
                <p className="text-lg font-semibold text-slate-950">{detail.file.nombreVisible}</p>
                <p className="mt-1 text-sm text-slate-500">{detail.file.company?.nombre}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{detail.file.tipoArchivo}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{detail.file.extension}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{detail.file.registros || 0} registros</span>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 p-5">
                <h4 className="font-semibold text-slate-950">Registros recientes</h4>
                <div className="mt-4 space-y-3">
                  {detail.preview.length ? (
                    detail.preview.map((record) => (
                      <div key={record._id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="font-medium text-slate-900">{record.nombreCompleto || "-"}</p>
                        <p className="text-slate-500">{record.rol || "-"} - {record.email || "-"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">Este archivo no tiene vista previa disponible.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-slate-500">Selecciona un archivo para ver su detalle.</p>
          )}
        </div>
      </section>

      {message ? <p className="text-sm text-red-500">{message}</p> : null}
    </div>
  );
}
