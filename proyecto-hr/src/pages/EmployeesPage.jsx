import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import EmployeeProfile from "../components/EmployeeProfile";
import { TableSkeleton } from "../components/Skeleton";

export default function EmployeesPage() {
  const { token } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async (intento = 0) => {
    try {
      setCargando(true);
      setError(null);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/records`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Error al cargar empleados");
      const data = await response.json();
      setEmpleados(data);
    } catch (err) {
      if (intento < 2) {
        setTimeout(() => cargarEmpleados(intento + 1), 1500);
        return;
      }
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const empleadosFiltrados = empleados.filter((emp) =>
    emp.nombreCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.rol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedEmpleado) {
    return (
      <EmployeeProfile
        empleado={selectedEmpleado}
        onVolver={() => setSelectedEmpleado(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Búsqueda de Empleados</h3>
        <input
          type="text"
          placeholder="Buscar por nombre, email o rol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">
          Empleados ({empleadosFiltrados.length})
        </h3>

        {cargando && <TableSkeleton rows={5} />}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 mb-3">Error: {error}</p>
            <button onClick={() => cargarEmpleados()} className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm">
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && empleadosFiltrados.length === 0 && (
          <p className="text-slate-500">No hay empleados registrados</p>
        )}

        {!cargando && !error && empleadosFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Nombre</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Rol</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Departamento</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Estado</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Acción</th>
                </tr>
              </thead>
              <tbody>
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{emp.nombreCompleto}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{emp.email}</td>
                    <td className="px-4 py-3 text-sm">{emp.rol}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{emp.departamento || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        emp.estado_empleado === "activo" ? "bg-emerald-100 text-emerald-800"
                        : emp.estado_empleado === "inactivo" ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {emp.estado_empleado || "activo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedEmpleado(emp)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm">
                        Ver Ficha
                      </button>
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
