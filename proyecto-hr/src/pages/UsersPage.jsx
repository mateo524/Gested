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

  const editingUser = useMemo(
    () => users.find((user) => user._id === editingId) || null,
    [users, editingId]
  );

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
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setMessage("");

      const path = editingId ? `/users/${editingId}` : "/users";
      const method = editingId ? "PUT" : "POST";
      const payload = {
        nombre: form.nombre,
        email: form.email,
        roleId: form.roleId,
        activo: form.activo,
        ...(form.password ? { password: form.password } : {}),
      };

      if (!editingId && !form.password) {
        throw new Error("La contraseña es obligatoria al crear un usuario");
      }

      await apiFetch(path, {
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
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">
              {editingId ? "Editar usuario" : "Nuevo usuario"}
            </h3>
            <p className="mt-1 text-slate-500">
              Creá y administrá accesos reales para tu empresa.
            </p>
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
            placeholder={
              editingId ? "Nueva contraseña (opcional)" : "Contraseña inicial"
            }
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />

          <select
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            value={form.roleId}
            onChange={(event) => setForm({ ...form, roleId: event.target.value })}
          >
            <option value="">Seleccioná un rol</option>
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
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Usuarios creados</h3>
        <p className="mt-1 text-slate-500">
          Vista general de acceso, rol y estado de cada usuario.
        </p>

        <div className="mt-6 space-y-4">
          {users.map((user) => (
            <article
              key={user._id}
              className="rounded-3xl border border-slate-200 p-5 transition hover:border-emerald-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{user.nombre}</p>
                  <p className="text-slate-500">{user.email}</p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    user.activo
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {user.activo ? "Activo" : "Inactivo"}
                </span>
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
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
