import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const permissionOptions = [
  { key: "manage_users", label: "Gestionar usuarios" },
  { key: "manage_roles", label: "Gestionar roles" },
  { key: "view_audit", label: "Ver auditoría" },
  { key: "export_reports", label: "Exportar reportes" },
  { key: "manage_settings", label: "Gestionar parámetros" },
];

export default function RolesPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [message, setMessage] = useState("");

  async function loadRoles() {
    const data = await apiFetch("/roles", { token });
    setRoles(data);
  }

  useEffect(() => {
    loadRoles().catch((error) => setMessage(error.message));
  }, [token]);

  function resetForm() {
    setEditingId("");
    setNombre("");
    setPermisos([]);
  }

  function togglePermission(permission) {
    setPermisos((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function startEdit(role) {
    setEditingId(role._id);
    setNombre(role.nombre);
    setPermisos(role.permisos || []);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const path = editingId ? `/roles/${editingId}` : "/roles";
      const method = editingId ? "PUT" : "POST";

      await apiFetch(path, {
        method,
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nombre, permisos }),
      });

      await loadRoles();
      const wasEditing = Boolean(editingId);
      resetForm();
      setMessage(wasEditing ? "Rol actualizado" : "Rol creado");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeRole(roleId) {
    try {
      await apiFetch(`/roles/${roleId}`, { method: "DELETE", token });
      await loadRoles();
      if (editingId === roleId) resetForm();
      setMessage("Rol eliminado");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">
              {editingId ? "Editar rol" : "Nuevo rol"}
            </h3>
            <p className="mt-1 text-slate-500">
              Definí permisos reales para cada tipo de usuario.
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

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            placeholder="Nombre del rol"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
          />

          <div className="grid gap-3">
            {permissionOptions.map((permission) => (
              <label
                key={permission.key}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={permisos.includes(permission.key)}
                  onChange={() => togglePermission(permission.key)}
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-500 py-3 font-semibold text-white"
          >
            {editingId ? "Guardar rol" : "Crear rol"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Roles configurados</h3>
        <p className="mt-1 text-slate-500">
          Cada rol define qué módulos aparecen y qué acciones se pueden ejecutar.
        </p>

        <div className="mt-6 space-y-4">
          {roles.map((role) => (
            <article key={role._id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{role.nombre}</p>
                  <p className="text-sm text-slate-500">
                    Usuarios asignados: {role.usersCount || 0}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(role)}
                    className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRole(role._id)}
                    className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {role.permisos?.length ? (
                  role.permisos.map((permiso) => (
                    <span
                      key={permiso}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                    >
                      {permiso}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Sin permisos asignados</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
