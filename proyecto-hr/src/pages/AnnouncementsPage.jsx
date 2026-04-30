import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function formatDate(value) {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const emptyForm = {
  companyId: "",
  titulo: "",
  cuerpo: "",
  prioridad: "informativa",
  categoria: "general",
  attachments: [],
};

function attachmentLabel(item) {
  return item.nombreOriginal || item.nombreArchivo || "Adjunto";
}

export default function AnnouncementsPage() {
  const { token, user, refreshAnnouncementSummary } = useAuth();
  const [data, setData] = useState({ announcements: [], companies: [] });
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const next = await apiFetch("/announcements", { token });
    setData(next);
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  async function sendAnnouncement(event) {
    event.preventDefault();

    try {
      setMessage("");
      setIsSubmitting(true);
      const body = new FormData();

      body.append("companyId", form.companyId);
      body.append("titulo", form.titulo);
      body.append("cuerpo", form.cuerpo);
      body.append("prioridad", form.prioridad);
      body.append("categoria", form.categoria);
      [...form.attachments].forEach((file) => body.append("attachments", file));

      await apiFetch("/announcements", {
        method: "POST",
        token,
        body,
      });

      setForm(emptyForm);
      setMessage("Novedad enviada");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
      const input = document.getElementById("announcement-attachments");
      if (input) input.value = "";
    }
  }

  async function toggleVisibility(item) {
    try {
      await apiFetch(`/announcements/${item._id}/visibility`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visible: !item.visible }),
      });

      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markAsRead(item) {
    try {
      await apiFetch(`/announcements/${item._id}/read`, {
        method: "POST",
        token,
      });
      await Promise.all([loadData(), refreshAnnouncementSummary()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const isSuperAdmin = !!user?.isSuperAdmin;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Comunicación interna</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Novedades y avisos</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Este espacio permite compartir informacion importante dentro de la app. El superadmin
          puede enviar novedades a cada empresa y cada empresa solo ve sus propios mensajes.
        </p>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Enviar novedad</h3>
          <p className="mt-1 text-slate-500">Comparte información relevante con una empresa puntual.</p>

          <form className="mt-6 space-y-4" onSubmit={sendAnnouncement}>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.companyId}
              onChange={(event) => setForm({ ...form, companyId: event.target.value })}
            >
              <option value="">Selecciona empresa</option>
              {data.companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.nombre}
                </option>
              ))}
            </select>

            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Titulo"
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
            />

            <textarea
              className="min-h-32 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Contenido de la novedad"
              value={form.cuerpo}
              onChange={(event) => setForm({ ...form, cuerpo: event.target.value })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                value={form.prioridad}
                onChange={(event) => setForm({ ...form, prioridad: event.target.value })}
              >
                <option value="informativa">Informativa</option>
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
              </select>

              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Categoria"
                value={form.categoria}
                onChange={(event) => setForm({ ...form, categoria: event.target.value })}
              />
            </div>

            <label className="block rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
              <span className="block text-sm font-medium text-slate-700">Adjuntar archivos</span>
              <span className="mt-1 block text-sm text-slate-500">
                Puedes sumar PDF, instructivos, contratos o material complementario.
              </span>
              <input
                id="announcement-attachments"
                type="file"
                multiple
                className="mt-4 block w-full text-sm text-slate-500"
                onChange={(event) =>
                  setForm({ ...form, attachments: Array.from(event.target.files || []) })
                }
              />
              {form.attachments.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.attachments.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white"
            >
              {isSubmitting ? "Enviando..." : "Enviar novedad"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">
          {isSuperAdmin ? "Mensajes enviados" : "Novedades para tu empresa"}
        </h3>
        <p className="mt-1 text-slate-500">
          {isSuperAdmin
            ? "Historial de información compartida desde Performia con cada cuenta cliente."
            : "Información compartida por Performia para esta empresa."}
        </p>

        <div className="mt-6 space-y-4">
          {data.announcements.length ? (
            data.announcements.map((item) => (
              <article
                key={item._id}
                className={`rounded-[1.75rem] border p-5 ${
                  !isSuperAdmin && !item.isRead
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-950">{item.titulo}</p>
                      {!isSuperAdmin && !item.isRead ? (
                        <span className="rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                          Nueva
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{item.prioridad}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{item.categoria}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-slate-600">{item.cuerpo}</p>

                {item.attachments?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.attachments.map((attachment, index) => (
                      <span
                        key={`${item._id}-attachment-${index}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                      >
                        {attachmentLabel(attachment)}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  {isSuperAdmin ? (
                    <button
                      type="button"
                      onClick={() => toggleVisibility(item)}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
                    >
                      {item.visible ? "Ocultar para empresa" : "Volver a mostrar"}
                    </button>
                  ) : (
                    !item.isRead && (
                      <button
                        type="button"
                        onClick={() => markAsRead(item)}
                        className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700"
                      >
                        Marcar como leída
                      </button>
                    )
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="text-slate-500">Todavia no hay novedades cargadas.</p>
          )}
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </div>
  );
}
