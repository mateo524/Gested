import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export default function RolesPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisos, setPermisos] = useState([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const filteredRoles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((role) =>
      [role.nombre, role.code, role.descripcion, ...(role.permisos || [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [roles, query]);

  async function loadData() {
    const [rolesData, catalog] = await Promise.all([
      apiFetch("/roles", { token }),
      apiFetch("/roles/catalog", { token }),
    ]);
    setRoles(rolesData);
    setPermissionsCatalog(catalog.permissions || []);
    setTemplates(catalog.templates || []);
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  function resetForm() {
    setEditingId("");
    setNombre("");
    setDescripcion("");
    setPermisos([]);
    setCode("");
  }

  function togglePermission(permission) {
    setPermisos((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function applyTemplate(templateCode) {
    const template = templates.find((item) => item.code === templateCode);
    if (!template) return;
    setCode(template.code || "");
    setNombre(template.nombre || "");
    setDescripcion(template.descripcion || "");
    setPermisos(template.permisos || []);
  }

  function startEdit(role) {
    setEditingId(role._id);
    setNombre(role.nombre || "");
    setDescripcion(role.descripcion || "");
    setPermisos(role.permisos || []);
    setCode(role.code || "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!nombre.trim()) {
      setMessage("El nombre del perfil es obligatorio.");
      return;
    }
    try {
      const isEditing = Boolean(editingId);
      const path = isEditing ? `/roles/${editingId}` : "/roles";
      const method = isEditing ? "PUT" : "POST";
      await apiFetch(path, {
        method,
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          descripcion,
          permisos,
          code: isEditing ? undefined : code || undefined,
        }),
      });
      await loadData();
      resetForm();
      setMessage(isEditing ? "Perfil actualizado." : "Perfil creado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function syncDefaults() {
    try {
      await apiFetch("/roles/sync-defaults", { method: "POST", token });
      await loadData();
      setMessage("Perfiles recomendados restaurados.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeRole(roleId) {
    try {
      await apiFetch(`/roles/${roleId}`, { method: "DELETE", token });
      await loadData();
      if (editingId === roleId) resetForm();
      setMessage("Perfil eliminado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Gobernanza de accesos</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Perfiles y permisos</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Define exactamente que puede ver y hacer cada tipo de usuario.
        </p>
        <button type="button" onClick={syncDefaults} className="mt-4 rounded-xl border border-[#22c55e]/40 px-4 py-2 text-sm text-[#8be6ac]">
          Restaurar perfiles recomendados
        </button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-white">{editingId ? "Editar perfil" : "Nuevo perfil"}</h3>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-white/20 px-3 py-2 text-sm text-[#c5d5de]">
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {!editingId ? (
              <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={code} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Plantilla opcional</option>
                {templates.map((template) => (
                  <option key={template.code} value={template.code}>
                    {template.nombre} ({template.code})
                  </option>
                ))}
              </select>
            ) : null}

            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Nombre del perfil" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <textarea className="min-h-24 w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Descripcion del alcance" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

            <div className="grid gap-2">
              {permissionsCatalog.map((permission) => (
                <label key={permission.code} className="rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" checked={permisos.includes(permission.code)} onChange={() => togglePermission(permission.code)} />
                    <div>
                      <p className="text-sm font-medium text-white">{permission.label}</p>
                      <p className="text-xs text-[#9fb6c4]">{permission.code}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button type="submit" className="w-full rounded-2xl bg-[#1e3a8a] py-3 text-sm font-semibold text-white">
              {editingId ? "Guardar cambios" : "Crear perfil"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="text-xl font-semibold text-white">Perfiles configurados</h3>
            <input className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Buscar perfil o permiso" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="mt-5 space-y-4">
            {filteredRoles.map((role) => (
              <article key={role._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {role.nombre} {role.code ? <span className="text-xs text-[#9fb6c4]">({role.code})</span> : null}
                    </p>
                    {role.descripcion ? <p className="text-sm text-[#9fb6c4]">{role.descripcion}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(role)} className="rounded-lg border border-[#22c55e]/40 px-3 py-1.5 text-xs text-[#8be6ac]">Editar</button>
                    {!role.isSystem ? (
                      <button type="button" onClick={() => removeRole(role._id)} className="rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200">Eliminar</button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(role.permisos || []).length ? (
                    role.permisos.map((permiso) => (
                      <span key={permiso} className="rounded-full border border-white/10 bg-[#122530] px-2.5 py-1 text-xs text-[#c5d5de]">
                        {permiso}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#9fb6c4]">Sin permisos</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#c5d5de]">{message}</p> : null}
    </div>
  );
}

