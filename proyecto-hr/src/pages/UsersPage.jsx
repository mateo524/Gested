import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  roleId: "",
  activo: true,
};

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [createdAccess, setCreatedAccess] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPasswords, setBulkPasswords] = useState([]);

  const editingUser = useMemo(
    () => users.find((user) => user._id === editingId) || null,
    [users, editingId]
  );

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) =>
      [user.nombre, user.email, user.roleId?.nombre]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [users, query]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user._id));

  async function loadData() {
    const [usersData, rolesData] = await Promise.all([
      apiFetch("/users", { token }),
      apiFetch("/roles", { token }),
    ]);

    setUsers(usersData);
    setRoles(rolesData);
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    if (!editingUser && editingId) {
      setEditingId("");
      setForm(emptyForm);
    }
  }, [editingUser, editingId]);

  function startEdit(user) {
    setEditingId(user._id);
    setForm({
      nombre: user.nombre,
      email: user.email,
      password: "",
      roleId: user.roleId?._id || user.roleId,
      activo: user.activo,
    });
    setMessage("");
    setCreatedAccess(null);
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
    setCreatedAccess(null);
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

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setMessage("");
      setCreatedAccess(null);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await loadData();
      const wasEditing = Boolean(editingId);
      resetForm();
      setMessage(wasEditing ? "Usuario actualizado" : "Usuario creado");

      if (!wasEditing && data.temporaryPassword) {
        setCreatedAccess({
          nombre: data.user?.nombre || payload.nombre,
          email: data.user?.email || payload.email,
          temporaryPassword: data.temporaryPassword,
        });
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function runBulkAction(action) {
    if (!selectedIds.length) {
      setMessage("Selecciona al menos un usuario");
      return;
    }

    try {
      const data = await apiFetch("/users/bulk", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, userIds: selectedIds }),
      });

      setMessage(data.mensaje);
      setBulkPasswords(data.temporaryPasswords || []);
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeUser(userId) {
    try {
      setMessage("");
      await apiFetch(`/users/${userId}`, { method: "DELETE", token });
      await loadData();
      if (editingId === userId) resetForm();
      setMessage("Usuario eliminado");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Accesos de empresa</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Usuarios y credenciales</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Crea accesos por empresa, asigna roles y define si el ingreso queda habilitado. Si no
          cargas password, Gested genera una temporal y luego pide cambio de clave al ingresar.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">{editingId ? "Editar usuario" : "Nuevo usuario"}</h3>
              <p className="mt-1 text-slate-500">Alta guiada para accesos operativos y administracion de empresa.</p>
            </div>

            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre completo"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              type="password"
              placeholder={editingId ? "Nueva password (opcional)" : "Password inicial (opcional)"}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />

            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: event.target.value })}
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.nombre}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(event) => setForm({ ...form, activo: event.target.checked })}
              />
              <span>Usuario activo</span>
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 py-3 font-semibold text-white"
            >
              {editingId ? "Guardar cambios" : "Crear usuario"}
            </button>
          </form>

          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

          {createdAccess ? (
            <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Acceso generado</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Usuario: {createdAccess.nombre}</p>
                <p>Email: {createdAccess.email}</p>
                <p>Password temporal: {createdAccess.temporaryPassword}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Usuarios creados</h3>
              <p className="mt-1 text-slate-500">Vista general de acceso, rol y estado por empresa.</p>
            </div>

            <input
              className="w-full max-w-xs rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Buscar usuario o rol"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                Seleccionar visibles
              </label>
              <span className="text-sm text-slate-500">{selectedIds.length} seleccionados</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => runBulkAction("activate")}
                className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700"
              >
                Activar
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("deactivate")}
                className="rounded-2xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700"
              >
                Desactivar
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("reset_password")}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Resetear password
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("delete")}
                className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>

          {bulkPasswords.length ? (
            <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                Passwords temporales generadas
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {bulkPasswords.map((item) => (
                  <p key={item._id}>
                    {item.nombre} - {item.email} - {item.temporaryPassword}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {filteredUsers.map((user) => (
              <article
                key={user._id}
                className="rounded-3xl border border-slate-200 p-5 transition hover:border-emerald-300"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <label className="mt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user._id)}
                      onChange={() => toggleSelection(user._id)}
                    />
                  </label>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{user.nombre}</p>
                        <p className="text-slate-500">{user.email}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.activo
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {user.activo ? "Activo" : "Inactivo"}
                        </span>
                        {user.mustChangePassword ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Cambio de clave pendiente
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                        Rol: {user.roleId?.nombre || "Sin rol"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                        Permisos: {user.roleId?.permisos?.length || 0}
                      </span>
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUser(user._id)}
                        className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
