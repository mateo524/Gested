import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  roleId: "",
  activo: true,
};

export default function UsersPage() {
  const { token } = useAuth();
  const { searchQuery, setSearchQuery } = useView();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPasswords, setBulkPasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const deferredQuery = useDeferredValue(query);
  const availableRoles = useMemo(
    () =>
      roles.filter((role) => {
        const roleCode = String(role.code || role.nombre || "").toUpperCase();
        return roleCode !== "SUPER_ADMIN";
      }),
    [roles]
  );

  const filteredUsers = useMemo(() => {
    const terms = [deferredQuery, searchQuery].map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
    if (!terms.length) return users;
    return users.filter((user) =>
      [user.nombre, user.email, user.roleId?.nombre]
        .filter(Boolean)
        .some((field) => terms.some((term) => String(field).toLowerCase().includes(term)))
    );
  }, [users, deferredQuery, searchQuery]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user._id));

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [usersData, rolesData] = await Promise.all([
        apiFetch("/users", { token }),
        apiFetch("/roles", { token }),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setMessage("");
      setMessageType("info");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadData]);

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
    setFieldErrors({});
  }

  function startEdit(user) {
    setEditingId(user._id);
    setForm({
      nombre: user.nombre || "",
      email: user.email || "",
      password: "",
      roleId: user.roleId?._id || user.roleId || "",
      activo: Boolean(user.activo),
    });
    setMessageType("info");
    setMessage("Editando usuario seleccionado.");
    setFieldErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.nombre?.trim()) nextErrors.nombre = "El nombre es obligatorio.";
    if (!form.email?.trim()) nextErrors.email = "El email es obligatorio.";
    if (!form.roleId) nextErrors.roleId = "Selecciona un rol.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessageType("warning");
      setMessage("Completa nombre, email y rol para guardar.");
      return;
    }
    try {
      setMessage("");
      setMessageType("info");
      setBulkPasswords([]);
      setIsSubmitting(true);
      const path = editingId ? `/users/${editingId}` : "/users";
      const method = editingId ? "PUT" : "POST";
      const payload = {
        nombre: form.nombre,
        email: form.email,
        roleId: form.roleId,
        activo: form.activo,
        ...(form.password ? { password: form.password } : {}),
      };

      const data = await apiFetch(path, {
        method,
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await loadData();
      const hadSearch = Boolean(String(searchQuery || "").trim() || String(query || "").trim());
      if (searchQuery) setSearchQuery("");
      if (query) setQuery("");
      const wasEditing = Boolean(editingId);
      resetForm();
      setMessageType("success");
      setMessage(
        `${wasEditing ? "Usuario actualizado." : "Usuario creado."}${
          hadSearch ? " Limpiamos la búsqueda activa para mostrarlo en la lista." : ""
        }`
      );
      setFieldErrors({});

      if (!wasEditing && data?.temporaryPassword) {
        setBulkPasswords([
          {
            _id: data.user?._id || Date.now().toString(),
            nombre: data.user?.nombre || payload.nombre,
            email: data.user?.email || payload.email,
            temporaryPassword: data.temporaryPassword,
          },
        ]);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSelection(userId) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredUsers.some((user) => user._id === id))
      );
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredUsers.forEach((user) => next.add(user._id));
      return [...next];
    });
  }

  async function runBulkAction(action) {
    if (!selectedIds.length) {
      setMessageType("warning");
      setMessage("Selecciona al menos un usuario.");
      return;
    }
    if (action === "delete") {
      const approved = window.confirm(
        `Vas a eliminar ${selectedIds.length} usuario(s). Esta accion es irreversible.`
      );
      if (!approved) return;
    }
    try {
      const data = await apiFetch("/users/bulk", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userIds: selectedIds }),
      });
      setMessageType("success");
      setMessage(data.mensaje || "Accion masiva aplicada.");
      setBulkPasswords(data.temporaryPasswords || []);
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  async function removeUser(userId) {
    const approved = window.confirm("Eliminar usuario? Esta accion no se puede deshacer.");
    if (!approved) return;
    try {
      await apiFetch(`/users/${userId}`, { method: "DELETE", token });
      await loadData();
      if (editingId === userId) resetForm();
      setMessageType("success");
      setMessage("Usuario eliminado.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Accesos de plataforma</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Usuarios y credenciales</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Gestiona credenciales de acceso. Los permisos, scopes y gobierno del rol se administran desde Roles y accesos.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#c5d5de]">
          En organizaciones grandes, el alcance define dónde puede operar el usuario: toda la organización, un área, un equipo o solo su información.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
            Para administración
          </span>
          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs font-medium text-[#d6e2e8]">
            Credenciales y acceso
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-white">{editingId ? "Editar usuario" : "Nuevo usuario"}</h3>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-white/20 px-3 py-2 text-sm text-[#c5d5de]">
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <input className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.nombre ? "border-rose-400/70" : "border-white/15"}`} placeholder="Nombre completo" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
            {fieldErrors.nombre ? <p className="text-xs text-rose-300">{fieldErrors.nombre}</p> : null}
            <input className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.email ? "border-rose-400/70" : "border-white/15"}`} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            {fieldErrors.email ? <p className="text-xs text-rose-300">{fieldErrors.email}</p> : null}
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" type="password" placeholder={editingId ? "Nueva password (opcional)" : "Password inicial (opcional)"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <select className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${fieldErrors.roleId ? "border-rose-400/70" : "border-white/15"}`} value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
              <option value="">Selecciona un rol</option>
              {availableRoles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.nombre}
                </option>
              ))}
            </select>
            {fieldErrors.roleId ? <p className="text-xs text-rose-300">{fieldErrors.roleId}</p> : null}
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-[#c5d5de]">
              <input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} />
              <span>Usuario activo</span>
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#1e3a8a] py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear usuario"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="text-xl font-semibold text-white">Usuarios creados</h3>
            <input className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Buscar usuario o rol" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {query !== deferredQuery ? (
            <p className="mt-2 text-xs text-[#9fb6c4]">Actualizando búsqueda...</p>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#9fb6c4]">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                Seleccionar visibles
              </label>
              <span className="text-sm text-[#9fb6c4]">{selectedIds.length} seleccionados</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => runBulkAction("activate")} className="rounded-xl border border-[#22c55e]/40 px-4 py-2 text-sm text-[#8be6ac]">Activar</button>
              <button type="button" onClick={() => runBulkAction("deactivate")} className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm text-amber-200">Desactivar</button>
              <button type="button" onClick={() => runBulkAction("reset_password")} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-[#c5d5de]">Resetear password</button>
              <button type="button" onClick={() => runBulkAction("delete")} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">Eliminar</button>
            </div>
          </div>

          {bulkPasswords.length ? (
            <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Passwords temporales generadas</p>
              <div className="mt-2 space-y-1 text-sm text-[#f7e9c2]">
                {bulkPasswords.map((item) => (
                  <p key={item._id}>{item.nombre} - {item.email} - {item.temporaryPassword}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {searchQuery ? (
              <div className="pf-alert-info flex flex-wrap items-center justify-between gap-3">
                <span>Hay una búsqueda activa. Limpiála para ver todos los usuarios.</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : null}
            {isLoading ? (
              <LoadingState
                compact
                title="Cargando usuarios"
                description="Estamos trayendo accesos, roles y credenciales."
              />
            ) : null}
            {!isLoading && messageType === "error" && !users.length ? (
              <ErrorState
                compact
                title="No pudimos cargar los usuarios"
                description="Reintenta para recuperar la lista de accesos."
                actionLabel="Reintentar"
                onAction={() =>
                  loadData().catch((error) => {
                    setMessageType("error");
                    setMessage(error.message);
                  })
                }
              />
            ) : null}
            {!isLoading && filteredUsers.length ? (
              filteredUsers.map((user) => (
                <article key={user._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.includes(user._id)} onChange={() => toggleSelection(user._id)} className="mt-1" />
                      <div>
                        <p className="font-semibold text-white">{user.nombre}</p>
                        <p className="text-sm text-[#9fb6c4]">{user.email}</p>
                        <p className="text-xs text-[#7f99a8]">{user.roleId?.nombre || "Sin rol"} - {user.activo ? "Activo" : "Inactivo"}</p>
                      </div>
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(user)} className="rounded-lg border border-[#22c55e]/40 px-3 py-1.5 text-xs text-[#8be6ac]">Editar</button>
                      <button type="button" onClick={() => removeUser(user._id)} className="rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200">Eliminar</button>
                    </div>
                  </div>
                </article>
              ))
            ) : null}
            {!isLoading && messageType !== "error" && !filteredUsers.length ? (
              <EmptyState
                compact
                title="No hay usuarios para mostrar"
                description={
                  query || searchQuery
                    ? "Prueba con otra busqueda o limpia el filtro actual."
                    : "Crea el primer acceso para empezar a asignar roles."
                }
              />
            ) : null}
          </div>
        </section>
      </div>

      {message ? (
        <p
          className={
            messageType === "error"
              ? "pf-alert-error"
              : messageType === "success"
                ? "pf-alert-success"
                : messageType === "warning"
                  ? "pf-alert-warning"
                  : "pf-alert-info"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

