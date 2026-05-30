import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { CardSkeleton, ListSkeleton } from "../components/Skeleton";

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [recordsRes, plansRes, auditRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/records`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/development-plans`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/audit`, { headers }),
        ]);

        if (cancelled) return;

        const records = recordsRes.ok ? await recordsRes.json() : [];
        const plans = plansRes.ok ? await plansRes.json() : [];
        const logs = auditRes.ok ? await auditRes.json() : [];

        const activos = records.filter((r) => r.estado_empleado === "activo");
        const licencia = records.filter((r) => r.estado_empleado === "licencia");
        const deptos = [...new Set(records.map((r) => r.departamento).filter(Boolean))];
        const planesEnCurso = plans.filter((p) => p.estado === "en_curso");
        const planesCompletados = plans.filter((p) => p.estado === "completado");

        setStats({
          totalEmpleados: records.length,
          activos: activos.length,
          licencia: licencia.length,
          departamentos: deptos.length,
          planesEnCurso: planesEnCurso.length,
          planesCompletados: planesCompletados.length,
          totalPlanes: plans.length,
        });

        setRecentLogs(logs.slice(0, 6));
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  if (!stats) {
    return (
      <div className="grid md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-slate-500">Total Empleados</p>
          <h3 className="text-3xl font-bold mt-2 text-slate-900">{stats.totalEmpleados}</h3>
          <p className="text-sm text-emerald-600 mt-1">{stats.activos} activos</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-slate-500">En Licencia</p>
          <h3 className="text-3xl font-bold mt-2 text-amber-600">{stats.licencia}</h3>
          <p className="text-sm text-slate-500 mt-1">{stats.departamentos} departamentos</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-slate-500">Planes en Curso</p>
          <h3 className="text-3xl font-bold mt-2 text-blue-600">{stats.planesEnCurso}</h3>
          <p className="text-sm text-emerald-600 mt-1">{stats.planesCompletados} completados</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-slate-500">Total Planes</p>
          <h3 className="text-3xl font-bold mt-2 text-slate-900">{stats.totalPlanes}</h3>
          <p className="text-sm text-slate-500 mt-1">{stats.departamentos} áreas</p>
        </div>
      </div>

      {recentLogs.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Actividad Reciente</h3>
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log._id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 min-w-[90px] text-center">
                  {log.accion?.replace(/_/g, " ")}
                </span>
                <span className="text-slate-500 text-xs">{log.modulo}</span>
                <span className="text-slate-600 flex-1 truncate">{log.detalle}</span>
                <span className="text-slate-400 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
