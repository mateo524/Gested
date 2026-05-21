import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { isAdminOrgUser } from "../lib/roleHelpers";

const EMPTY_FORM = {
  title: "",
  body: "",
  type: "info",
  pinned: false,
  isActive: true,
  expiresAt: "",
};

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function matchesQuery(item, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    item.title,
    item.body,
    item.type,
    item.createdByName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function typePillClass(type) {
  if (type === "warning") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  if (type === "success") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (type === "update") return "bg-violet-500/15 text-violet-200 border-violet-400/30";
  return "bg-white/10 text-[#d8e3e9] border-white/10";
}

function AnnouncementCard({
  item,
  canManage,
  onMarkRead,
  onEdit,
  onDeactivate,
  busyId,
  actionBusy,
}) {
  const unread = !item.isRead;

  return (
    <article
      className={`rounded-[1.75rem] border p-5 ${
        unread ? "border-[#4f7cff]/25 bg-[#12243b]" : "border-white/10 bg-[#0f1f28]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-white">{item.title}</p>
            {item.pinned ? (
              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d8e3e9]">
                Fijada
              </span>
            ) : null}
            {unread ? (
              <span className="rounded-full bg-[#2563eb] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                Nueva
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8ea5b3]">
            <span className={`rounded-full border px-3 py-1 font-semibold uppercase tracking-[0.12em] ${typePillClass(item.type)}`}>
              {item.type}
            </span>
            <span>{formatDate(item.createdAt)}</span>
            {item.expiresAt ? <span>Vence {formatDate(item.expiresAt)}</span> : null}
          </div>
        </div>
        <div className="text-right text-xs text-[#8ea5b3]">
          <p>{item.isRead ? "Vista" : "No vista"}</p>
          <p className="mt-1">{item.isActive ? "Activa" : "Inactiva"}</p>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#d4e1e8]">{item.body}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {!item.isRead ? (
          <button
            type="button"
            onClick={() => onMarkRead(item)}
            disabled={busyId === item._id}
            className="rounded-2xl border border-[#4f7cff]/30 bg-[#173150] px-4 py-2 text-sm font-medium text-[#dce7ff] transition hover:bg-[#1d3c61] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyId === item._id ? "Marcando..." : "Marcar como vista"}
          </button>
        ) : null}

        {canManage ? (
          <>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-[#d4e1e8] transition hover:bg-white/5"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDeactivate(item)}
              disabled={actionBusy === item._id}
              className="rounded-2xl border border-rose-400/30 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionBusy === item._id ? "Actualizando..." : item.isActive ? "Desactivar" : "Desactivada"}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default function AnnouncementsPage() {
  const { token, user, hasPermission, refreshAnnouncementSummary } = useAuth();
  const { searchQuery, t } = useView();
  const [announcements, setAnnouncements] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const formRef = useRef(null);

  const canManage =
    isAdminOrgUser(user) ||
    hasPermission?.("manage_users") ||
    hasPermission?.("manage_settings");

  const loadAnnouncements = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const data = await apiFetch("/announcements", { token });
      setAnnouncements(data.announcements || []);
    } catch (loadError) {
      setError(loadError.message || "No pudimos cargar novedades. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!formOpen || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen, editingId]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      if (filter === "unread" && item.isRead) return false;
      return matchesQuery(item, searchQuery);
    });
  }, [announcements, filter, searchQuery]);

  const unreadCount = useMemo(
    () => announcements.filter((item) => !item.isRead).length,
    [announcements]
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId("");
    setFormOpen(false);
  }

  function startCreate() {
    setNotice("");
    setError("");
    setEditingId("");
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function startEdit(item) {
    setNotice("");
    setError("");
    setEditingId(item._id);
    setForm({
      title: item.title || "",
      body: item.body || "",
      type: item.type || "info",
      pinned: item.pinned === true,
      isActive: item.isActive !== false,
      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
    });
    setFormOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManage || isSaving) return;

    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) {
      setError("Completa titulo y contenido para guardar la novedad.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(editingId ? `/announcements/${editingId}` : "/announcements", {
        method: editingId ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          type: form.type,
          pinned: form.pinned,
          isActive: form.isActive,
          expiresAt: form.expiresAt || null,
        }),
      });

      setNotice(editingId ? "Novedad actualizada." : "Novedad publicada.");
      resetForm();
      await Promise.all([loadAnnouncements(), refreshAnnouncementSummary()]);
    } catch (submitError) {
      setError(submitError.message || "No pudimos guardar la novedad.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkRead(item) {
    if (item.isRead || busyId) return;
    setBusyId(item._id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/announcements/${item._id}/read`, {
        method: "POST",
        token,
      });
      setAnnouncements((current) =>
        current.map((entry) =>
          entry._id === item._id ? { ...entry, isRead: true, unread: false } : entry
        )
      );
      setNotice("Novedad marcada como vista.");
      await refreshAnnouncementSummary();
    } catch (markError) {
      setError(markError.message || "No pudimos marcar la novedad como vista.");
    } finally {
      setBusyId("");
    }
  }

  async function handleMarkAllRead() {
    setActionBusy("read-all");
    setError("");
    setNotice("");
    try {
      const result = await apiFetch("/announcements/read-all", {
        method: "POST",
        token,
      });
      setAnnouncements((current) =>
        current.map((entry) => ({ ...entry, isRead: true, unread: false }))
      );
      setNotice(result?.mensaje || "Novedades marcadas como vistas.");
      await refreshAnnouncementSummary();
    } catch (markError) {
      setError(markError.message || "No pudimos marcar todas las novedades como vistas.");
    } finally {
      setActionBusy("");
    }
  }

  async function handleDeactivate(item) {
    if (!canManage || actionBusy) return;
    setActionBusy(item._id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/announcements/${item._id}`, {
        method: "DELETE",
        token,
      });
      setNotice("Novedad desactivada.");
      await Promise.all([loadAnnouncements(), refreshAnnouncementSummary()]);
    } catch (deleteError) {
      setError(deleteError.message || "No pudimos desactivar la novedad.");
    } finally {
      setActionBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#142028] p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Comunicacion interna</p>
            <h1 className="mt-3 text-3xl font-bold text-white">Novedades</h1>
            <p className="mt-3 text-[#9fb6c4]">
              Publica avisos relevantes para tu organizacion y sigue que novedades ya fueron vistas por cada usuario.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">No vistas</p>
              <p className="mt-1 text-2xl font-semibold text-white">{unreadCount}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0f1f28] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#7f99a8]">Activas</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {announcements.filter((item) => item.isActive !== false).length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-2xl px-4 py-2.5 text-sm transition ${
              filter === "all" ? "bg-[#1e3a8a] text-white" : "border border-white/10 bg-[#12222d] text-[#c7d5dc]"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-2xl px-4 py-2.5 text-sm transition ${
              filter === "unread" ? "bg-[#1e3a8a] text-white" : "border border-white/10 bg-[#12222d] text-[#c7d5dc]"
            }`}
          >
            No vistas
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={!unreadCount || actionBusy === "read-all"}
            className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionBusy === "read-all" ? "Marcando..." : "Marcar todas como vistas"}
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-2xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2a4db8]"
            >
              Nueva novedad
            </button>
          ) : null}
        </div>
      </section>

      {canManage && formOpen ? (
        <section ref={formRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editingId ? "Editar novedad" : "Nueva novedad"}
              </h2>
              <p className="mt-1 text-[#9fb6c4]">
                La publicacion se comparte dentro de la organizacion activa del usuario.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-[#c7d5dc] transition hover:bg-white/5"
            >
              {t("common.close", "Cerrar")}
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Titulo"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />

            <textarea
              className="min-h-36 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Contenido"
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm text-[#9fb6c4]">Tipo</span>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="update">Update</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-[#9fb6c4]">Vencimiento</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={form.expiresAt}
                  onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#d4e1e8]">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
                />
                Fijar arriba
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#d4e1e8]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Activa
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-[#1e3a8a] px-6 py-3 font-semibold text-white transition hover:bg-[#2a4db8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Publicar novedad"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-white/10 px-6 py-3 text-sm text-[#c7d5dc] transition hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Ultimas novedades</h2>
            <p className="mt-1 text-[#9fb6c4]">
              {searchQuery?.trim()
                ? `Filtrando por "${searchQuery.trim()}".`
                : "Revisa avisos recientes, mensajes fijados y novedades pendientes de lectura."}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAnnouncements}
            disabled={isLoading}
            className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Actualizando..." : t("common.retry", "Reintentar")}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-[#0f1f28] px-5 py-10 text-center text-[#9fb6c4]">
              Cargando novedades...
            </div>
          ) : filteredAnnouncements.length ? (
            filteredAnnouncements.map((item) => (
              <AnnouncementCard
                key={item._id}
                item={item}
                canManage={canManage}
                onMarkRead={handleMarkRead}
                onEdit={startEdit}
                onDeactivate={handleDeactivate}
                busyId={busyId}
                actionBusy={actionBusy}
              />
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-white/10 bg-[#0f1f28] px-5 py-10 text-center">
              <p className="text-lg font-semibold text-white">
                {filter === "unread" ? "No hay novedades nuevas." : "Todavia no hay novedades cargadas."}
              </p>
              <p className="mt-2 text-sm text-[#8ea5b3]">
                {searchQuery?.trim()
                  ? "Prueba con otra busqueda o limpia el filtro actual."
                  : canManage
                    ? "Puedes publicar una novedad para compartir informacion relevante con toda la organizacion."
                    : "Cuando haya novedades visibles para tu cuenta, apareceran aqui."}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
