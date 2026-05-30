import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { TableSkeleton } from "../components/Skeleton";

export default function UsersPage() {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", roleId: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    cargarDatos();
  }, [token]);

  async function cargarDatos(intento = 0) {
    try {
      setCargando(true);
      setError(null);
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/auth`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/roles`, { headers }),
      ]);
      if (usersRes.ok) setUsuarios(await usersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch (err) {
      if (intento < 2) {
        setTimeout(() => cargarDatos(intento + 1), 1500);
        return;
      }
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "Error al crear");
      setMessage(`Usuario ${form.email} creado`);
      setShowForm(false);
      setForm({ nombre: "", email: "", password: "", roleId: "" });
      cargarDatos();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  if (cargando) return <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"><TableSkeleton rows={4} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Usuarios del Sistema</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600">
          + Nuevo Usuario
        </button>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCrear} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-lg">Crear Usuario</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="border border-slate-300 rounded-xl px-4 py-3" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-slate-300 rounded-xl px-4 py-3" />
            <input required type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border border-slate-300 rounded-xl px-4 py-3" />
            <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="border border-slate-300 rounded-xl px-4 py-3">
              <option value="">Seleccionar rol</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.nombre}</option>)}
            </select>
          </div>
          <button type="submit" className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600">
            Crear Usuario
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        {error && (
          <div className="text-center py-4">
            <p className="text-red-500 mb-2">Error: {error}</p>
            <button onClick={() => cargarDatos()} className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm">Reintentar</button>
          </div>
        )}
        {!error && usuarios.length === 0 && (
          <p className="text-slate-500">No hay usuarios registrados</p>
        )}
        {!error && usuarios.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Nombre</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Rol</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{u.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.roleId?.nombre || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${u.activo ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
