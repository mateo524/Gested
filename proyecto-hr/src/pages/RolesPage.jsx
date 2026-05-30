import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const PERMISOS_DISPONIBLES = [
  "manage_users", "manage_roles", "view_audit",
  "export_reports", "manage_settings", "export_all_reports",
  "export_team_reports", "view_reports", "download_reports",
];

export default function RolesPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", permisos: [] });
  const [message, setMessage] = useState("");

  useEffect(() => {
    cargarRoles();
  }, [token]);

  async function cargarRoles() {
    try {
      setCargando(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRoles(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  function togglePermiso(perm) {
    setForm((prev) => ({
      ...prev,
      permisos: prev.permisos.includes(perm)
        ? prev.permisos.filter((p) => p !== perm)
        : [...prev.permisos, perm],
    }));
  }

  async function handleCrear(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "Error al crear rol");
      setMessage(`Rol "${form.nombre}" creado`);
      setShowForm(false);
      setForm({ nombre: "", permisos: [] });
      cargarRoles();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  if (cargando) return <p className="text-slate-500">Cargando roles...</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Roles y Permisos</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600">
          + Nuevo Rol
        </button>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCrear} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-lg">Crear Rol</h3>
          <input required placeholder="Nombre del rol" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3" />
          <div>
            <p className="font-medium text-slate-700 mb-2">Permisos</p>
            <div className="flex flex-wrap gap-2">
              {PERMISOS_DISPONIBLES.map((perm) => (
                <label key={perm} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 text-sm">
                  <input type="checkbox" checked={form.permisos.includes(perm)} onChange={() => togglePermiso(perm)} />
                  {perm.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600">
            Crear Rol
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {roles.map((rol) => (
          <div key={rol._id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-lg text-slate-900 mb-3">{rol.nombre}</h3>
            <div className="flex flex-wrap gap-2">
              {rol.permisos.map((perm) => (
                <span key={perm} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                  {perm.replace(/_/g, " ")}
                </span>
              ))}
              {rol.permisos.length === 0 && (
                <span className="text-slate-400 text-sm">Sin permisos asignados</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
