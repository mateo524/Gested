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
};

export default function AnnouncementsPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState({ announcements: [], companies: [] });
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

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
      await apiFetch("/announcements", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setForm(emptyForm);
      setMessage("Novedad enviada");
      await loadData();
    } catch (error) {
      setMessage(error.message);
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

  const isSuperAdmin = !!user?.isSuperAdmin;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Comunicacion interna</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Novedades y avisos</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Este espacio permite compartir informacion importante dentro de la app. El superadmin
          puede enviar novedades a cada empresa y cada empresa solo ve sus propios mensajes.
        </p>
      </section>

      {isSuperAdmin ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Enviar novedad</h3>
          <p className="mt-1 text-slate-500">Comparte informacion relevante con una empresa puntual.</p>

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

            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white"
            >
              Enviar novedad
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
            ? "Historial de informacion compartida desde Gested con cada cuenta cliente."
            : "Informacion compartida por Gested para esta empresa."}
        </p>

        <div className="mt-6 space-y-4">
          {data.announcements.length ? (
            data.announcements.map((item) => (
              <article key={item._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{item.titulo}</p>
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

                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleVisibility(item)}
                    className="mt-4 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
                  >
                    {item.visible ? "Ocultar para empresa" : "Volver a mostrar"}
                  </button>
                ) : null}
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
