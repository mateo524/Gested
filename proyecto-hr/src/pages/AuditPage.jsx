import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/audit`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje || "Error al cargar auditoría");
        return data;
      })
      .then(setLogs)
      .catch((err) => setMessage(err.message));
  }, [token]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-4">Auditoría</h3>

      {message && <p className="text-red-500 mb-4">{message}</p>}

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log._id} className="border border-slate-200 rounded-2xl p-4">
            <p className="font-semibold">{log.accion}</p>
            <p className="text-slate-500">{log.modulo}</p>
            <p className="text-sm text-slate-400">{log.detalle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}