import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import DevelopmentPlanForm from "../components/DevelopmentPlanForm";
import DevelopmentPlanDetail from "../components/DevelopmentPlanDetail";

export default function DevelopmentPlansPage() {
  const { token } = useAuth();
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  useEffect(() => {
    cargarPlanes();
  }, []);

  const cargarPlanes = async () => {
    try {
      setCargando(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/development-plans`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Error al cargar planes");
      const data = await response.json();
      setPlanes(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este plan?")) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/development-plans/${planId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Error al eliminar");
      cargarPlanes();
      setSelectedPlan(null);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (selectedPlan) {
    return (
      <DevelopmentPlanDetail
        plan={selectedPlan}
        onVolver={() => setSelectedPlan(null)}
        onDelete={() => handleDeletePlan(selectedPlan._id)}
        onUpdate={() => {
          cargarPlanes();
          setSelectedPlan(null);
        }}
      />
    );
  }

  if (showForm) {
    return (
      <DevelopmentPlanForm
        plan={editingPlan}
        onVolver={() => {
          setShowForm(false);
          setEditingPlan(null);
        }}
        onSave={() => {
          cargarPlanes();
          setShowForm(false);
          setEditingPlan(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Planes de Desarrollo</h2>
        <button
          onClick={() => {
            setEditingPlan(null);
            setShowForm(true);
          }}
          className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600"
        >
          + Nuevo Plan
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        {cargando && <p className="text-slate-500">Cargando planes...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}

        {!cargando && planes.length === 0 && (
          <p className="text-slate-500 text-center py-8">
            No hay planes de desarrollo registrados
          </p>
        )}

        {!cargando && planes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planes.map((plan) => (
              <div
                key={plan._id}
                onClick={() => setSelectedPlan(plan)}
                className="border border-slate-200 rounded-2xl p-4 hover:shadow-lg hover:border-emerald-500 cursor-pointer transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-slate-900">{plan.titulo}</h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      plan.estado === "en_curso"
                        ? "bg-blue-100 text-blue-800"
                        : plan.estado === "completado"
                        ? "bg-emerald-100 text-emerald-800"
                        : plan.estado === "pausado"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {plan.estado}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mb-3">{plan.descripcion}</p>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Progreso</span>
                    <span className="font-semibold">{plan.progreso}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${plan.progreso}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Empleado: {plan.empleadoEmail}
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPlan(plan);
                      setShowForm(true);
                    }}
                    className="flex-1 text-sm px-2 py-1 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
