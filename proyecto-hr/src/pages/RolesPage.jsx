import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export default function RolesPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [qaStatus, setQaStatus] = useState([]);
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
    const qa = await apiFetch("/roles/qa/status", { token });
    setQaStatus(qa.items || []);
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

    try {
      const path = editingId ? `/roles/${editingId}` : "/roles";
      const method = editingId ? "PUT" : "POST";
      await apiFetch(path, {
        method,
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion, permisos, code: editingId ? undefined : code || undefined }),
      });
      await loadData();
      resetForm();
      setMessage(editingId ? "Rol actualizado" : "Rol creado");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function syncDefaults() {
    try {
      await apiFetch("/roles/sync-defaults", { method: "POST", token });
      await loadData();
      setMessage("Roles recomendados sincronizados");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createDemoRoleUsers() {
    try {
      await apiFetch("/users/seed-demo-roles", { method: "POST", token });
      setMessage("Usuarios de prueba por rol creados para QA");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeRole(roleId) {
    try {
      await apiFetch(`/roles/${roleId}`, { method: "DELETE", token });
      await loadData();
      if (editingId === roleId) resetForm();
      setMessage("Rol eliminado");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="pf-card p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-400">Gobernanza de accesos</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Roles claros para cada perfil</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Definí qué ve y qué puede hacer cada usuario. Recomendado: usar roles base del sistema y
          personalizar solo cuando sea necesario.
        </p>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={syncDefaults}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Restaurar roles recomendados
            </button>
            <button
              type="button"
              onClick={createDemoRoleUsers}
              className="rounded-xl border border-white/15 bg-[#1A2C38] px-4 py-2 text-sm text-white"
            >
              Generar usuarios QA por rol
            </button>
          </div>
        </div>
      </section>

      <section className="pf-card p-6">
        <h4 className="text-lg font-semibold text-slate-950">Estado QA de roles</h4>
        <div className="mt-4 grid gap-3">
          {qaStatus.map((item) => (
            <article key={item.code} className="rounded-xl border border-white/10 bg-[#1A2C38] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-[#E8EEF1]">{item.nombre} ({item.code})</p>
                <span className={`rounded-full px-2.5 py-1 text-xs ${item.ok ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
                  {item.ok ? "OK" : "Revisar"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#9FB6C1]">Usuarios: {item.usersCount} · Faltantes: {item.missing.length} · Extra: {item.extra.length}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="pf-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{editingId ? "Editar rol" : "Nuevo rol"}</h3>
              <p className="mt-1 text-slate-500">Podés crear desde plantilla o armar uno a medida.</p>
            </div>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-white/15 bg-[#1A2C38] px-3 py-2 text-sm text-white">
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {!editingId ? (
              <select className="pf-input" value={code} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Plantilla opcional</option>
                {templates.map((template) => (
                  <option key={template.code} value={template.code}>
                    {template.nombre} ({template.code})
                  </option>
                ))}
              </select>
            ) : null}

            <input className="pf-input" placeholder="Nombre del rol" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <textarea
              className="pf-input min-h-24"
              placeholder="Descripcion (que puede hacer este rol)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />

            <div className="grid gap-2">
              {permissionsCatalog.map((permission) => (
                <label key={permission.code} className="rounded-xl border border-white/10 bg-[#1A2C38] px-3 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={permisos.includes(permission.code)}
                      onChange={() => togglePermission(permission.code)}
                    />
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF1]">{permission.label}</p>
                      <p className="text-xs text-[#9FB6C1]">
                        {permission.code} · módulo {permission.module}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button type="submit" className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">
              {editingId ? "Guardar cambios" : "Crear rol"}
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-[#A9BFCA]">{message}</p> : null}
        </section>

        <section className="pf-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">Roles configurados</h3>
              <p className="mt-1 text-slate-500">Base clara para superadmin, admin, rrhh, jefe, empleado y lector.</p>
            </div>
            <input
              className="pf-input w-full max-w-xs"
              placeholder="Buscar rol, codigo o permiso"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            {filteredRoles.map((role) => (
              <article key={role._id} className="rounded-2xl border border-white/10 bg-[#1A2C38] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#E8EEF1]">
                      {role.nombre} {role.code ? <span className="text-xs text-[#9FB6C1]">({role.code})</span> : null}
                    </p>
                    <p className="text-xs text-[#9FB6C1]">Usuarios asignados: {role.usersCount || 0}</p>
                    {role.descripcion ? <p className="mt-1 text-sm text-[#D4E1E8]">{role.descripcion}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(role)} className="rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs text-white">
                      Editar
                    </button>
                    {!role.isSystem ? (
                      <button type="button" onClick={() => removeRole(role._id)} className="rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs text-rose-300">
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(role.permisos || []).length ? (
                    role.permisos.map((permiso) => (
                      <span key={permiso} className="rounded-full border border-white/10 bg-[#142028] px-2.5 py-1 text-xs text-[#AFC3CE]">
                        {permiso}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#9FB6C1]">Sin permisos</span>
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
