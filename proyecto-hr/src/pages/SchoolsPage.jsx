import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  companyId: "",
  nombre: "",
  codigo: "",
  ciudad: "",
  provincia: "",
  pais: "Argentina",
};

export default function SchoolsPage() {
  const { token, companies, user, activeCompanyId } = useAuth();
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, companyId: activeCompanyId || "" });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit mode
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete confirm
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  // Deactivate confirm
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [isDeactivateConfirming, setIsDeactivateConfirming] = useState(false);

  function showMessage(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  const loadSchools = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (user?.isSuperAdmin && form.companyId) params.set("companyId", form.companyId);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/schools${queryString}`, { token });
    setSchools(Array.isArray(data) ? data : []);
  }, [form.companyId, query, token, user?.isSuperAdmin]);

  useEffect(() => {
    loadSchools().catch((error) => showMessage(error.message, "error"));
  }, [loadSchools]);

  useEffect(() => {
    if (activeCompanyId && !form.companyId) {
      setForm((current) => ({ ...current, companyId: activeCompanyId }));
    }
  }, [activeCompanyId, form.companyId]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/schools", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ ...emptyForm, companyId: form.companyId });
      showMessage("Colegio creado", "success");
      await loadSchools();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(school) {
    setEditTarget(school);
    setEditForm({
      companyId: school.companyId || "",
      nombre: school.nombre || "",
      codigo: school.codigo || "",
      ciudad: school.ciudad || "",
      provincia: school.provincia || "",
      pais: school.pais || "Argentina",
    });
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditForm({ ...emptyForm });
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editTarget) return;
    try {
      setIsEditSubmitting(true);
      setMessage("");
      await apiFetch(`/schools/${editTarget._id}`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      showMessage("Colegio actualizado", "success");
      cancelEdit();
      await loadSchools();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsEditSubmitting(false);
    }
  }

  function requestDelete(school) {
    setDeleteTarget(school);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setIsDeleteConfirming(true);
      await apiFetch(`/schools/${deleteTarget._id}`, {
        method: "DELETE",
        token,
      });
      showMessage(`Colegio "${deleteTarget.nombre}" eliminado`, "success");
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      await loadSchools();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsDeleteConfirming(false);
    }
  }

  function requestDeactivate(school) {
    setDeactivateTarget(school);
    setConfirmDeactivateOpen(true);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      setIsDeactivateConfirming(true);
      await apiFetch(`/schools/${deactivateTarget._id}`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: false }),
      });
      showMessage(`Colegio "${deactivateTarget.nombre}" desactivado`, "success");
      setConfirmDeactivateOpen(false);
      setDeactivateTarget(null);
      await loadSchools();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsDeactivateConfirming(false);
    }
  }

  async function reactivateSchool(school) {
    try {
      setMessage("");
      await apiFetch(`/schools/${school._id}`, {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: true }),
      });
      showMessage(`Colegio "${school.nombre}" reactivado`, "success");
      await loadSchools();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  const messageClass =
    messageType === "error"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-400"
      : messageType === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-400"
      : "border-[#14b8a6]/20 bg-[#14b8a6]/10 text-[#14b8a6]";

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Estructura institucional</p>
        <h3 className="mt-3 text-2xl font-bold text-white">Colegios y sedes</h3>
        <p className="mt-3 max-w-3xl text-sm text-[#9fb6c4]">
          Define los colegios o sedes para segmentar empleados, ciclos y evaluaciones con alcance real.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {user?.isSuperAdmin ? (
          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
            <h4 className="text-2xl font-bold text-white">
              {editTarget ? "Editar colegio" : "Nuevo colegio"}
            </h4>

            {editTarget ? (
              <form className="mt-6 space-y-4" onSubmit={handleEditSubmit}>
                <input
                  className={inputClass}
                  placeholder="Nombre del colegio"
                  value={editForm.nombre}
                  onChange={(event) => setEditForm({ ...editForm, nombre: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Codigo"
                  value={editForm.codigo}
                  onChange={(event) => setEditForm({ ...editForm, codigo: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Ciudad"
                  value={editForm.ciudad}
                  onChange={(event) => setEditForm({ ...editForm, ciudad: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Provincia"
                  value={editForm.provincia}
                  onChange={(event) => setEditForm({ ...editForm, provincia: event.target.value })}
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isEditSubmitting}
                    className="flex-1 rounded-xl bg-[#14b8a6] px-4 py-2.5 font-semibold text-[#022019] disabled:opacity-60"
                  >
                    {isEditSubmitting ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[#9fb6c4] hover:bg-white/[0.07] transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <select
                  className={inputClass}
                  value={form.companyId}
                  onChange={(event) => setForm({ ...form, companyId: event.target.value })}
                >
                  <option value="">Selecciona empresa</option>
                  {(Array.isArray(companies) ? companies : []).map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.nombre}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  placeholder="Nombre del colegio"
                  value={form.nombre}
                  onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Codigo"
                  value={form.codigo}
                  onChange={(event) => setForm({ ...form, codigo: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Ciudad"
                  value={form.ciudad}
                  onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Provincia"
                  value={form.provincia}
                  onChange={(event) => setForm({ ...form, provincia: event.target.value })}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[#14b8a6] px-4 py-2.5 font-semibold text-[#022019] disabled:opacity-60"
                >
                  {isSubmitting ? "Guardando..." : "Crear colegio"}
                </button>
              </form>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-2xl font-bold text-white">Colegios cargados</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">Base institucional para la operacion diaria.</p>
            </div>
            <input
              className="w-full max-w-xs rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Buscar colegio"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            {Array.isArray(schools) && schools.length ? (
              schools.map((school) => (
                <article
                  key={school._id}
                  className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-white">{school.nombre}</p>
                      <p className="mt-1 text-sm text-[#9fb6c4]">
                        {school.codigo || "Sin codigo"} - {school.ciudad || "Sin ciudad"} -{" "}
                        {school.provincia || "Sin provincia"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                          school.activa
                            ? "border-[#14b8a6]/20 bg-[#14b8a6]/10 text-[#14b8a6]"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {school.activa ? "Activa" : "Inactiva"}
                      </span>

                      {user?.isSuperAdmin ? (
                        <>
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => startEdit(school)}
                            aria-label={`Editar ${school.nombre}`}
                            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#9fb6c4] hover:bg-white/[0.08] transition"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.79l-4 1 1-4 12.362-12.303z" />
                            </svg>
                            Editar
                          </button>

                          {/* Activate / Deactivate toggle */}
                          {school.activa ? (
                            <button
                              type="button"
                              onClick={() => requestDeactivate(school)}
                              aria-label={`Desactivar ${school.nombre}`}
                              className="flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/15 transition"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Desactivar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => reactivateSchool(school)}
                              aria-label={`Reactivar ${school.nombre}`}
                              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/15 transition"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Reactivar
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => requestDelete(school)}
                            aria-label={`Eliminar ${school.nombre}`}
                            className="flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 transition"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#9fb6c4]">Todavia no hay colegios cargados.</p>
            )}
          </div>
        </section>
      </div>

      {message ? (
        <p className={`rounded-xl border p-3 text-sm ${messageClass}`}>{message}</p>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar colegio"
        message={
          deleteTarget
            ? `Vas a eliminar "${deleteTarget.nombre}" de forma permanente. Esta accion no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleteConfirming}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={confirmDeactivateOpen}
        title="Desactivar colegio"
        message={
          deactivateTarget
            ? `Vas a desactivar "${deactivateTarget.nombre}". Podras reactivarlo en cualquier momento.`
            : ""
        }
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeactivateConfirming}
        onCancel={() => {
          setConfirmDeactivateOpen(false);
          setDeactivateTarget(null);
        }}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
