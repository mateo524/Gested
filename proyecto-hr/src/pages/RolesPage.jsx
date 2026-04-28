import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const permissionOptions = [
  { key: "manage_users", label: "Gestion de usuarios", help: "Alta, edicion y baja de accesos." },
  { key: "manage_roles", label: "Gestion de roles", help: "Creacion y ajuste de perfiles." },
  { key: "view_audit", label: "Panel de trazabilidad", help: "Consulta de actividad y controles." },
  { key: "export_reports", label: "Datos y exportaciones", help: "Importar bases y descargar reportes." },
  { key: "manage_settings", label: "Parametros", help: "Ajustes visibles y operativos." },
];

export default function RolesPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const filteredRoles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return roles;

    return roles.filter((role) =>
      [role.nombre, ...(role.permisos || [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [roles, query]);

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
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Gobernanza de acceso</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Roles y permisos</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Los roles definen que ve cada usuario dentro de su empresa y que acciones puede ejecutar
          sobre datos, parametros, usuarios o trazabilidad.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">{editingId ? "Editar rol" : "Nuevo rol"}</h3>
              <p className="mt-1 text-slate-500">Define permisos claros para cada tipo de acceso.</p>
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
                  className="rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={permisos.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                    />
                    <div>
                      <p className="font-medium text-slate-950">{permission.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{permission.help}</p>
                    </div>
                  </div>
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Roles configurados</h3>
              <p className="mt-1 text-slate-500">
                Cada rol define que modulos aparecen y que acciones se pueden ejecutar.
              </p>
            </div>

            <input
              className="w-full max-w-xs rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Buscar por rol o permiso"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            {filteredRoles.map((role) => (
              <article key={role._id} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{role.nombre}</p>
                    <p className="text-sm text-slate-500">Usuarios asignados: {role.usersCount || 0}</p>
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
    </div>
  );
}
