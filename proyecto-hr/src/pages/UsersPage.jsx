import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:3000/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje || "Error al cargar usuarios");
        return data;
      })
      .then(setUsers)
      .catch((err) => setMessage(err.message));
  }, [token]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-4">Usuarios</h3>

      {message && <p className="text-red-500 mb-4">{message}</p>}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u._id} className="border border-slate-200 rounded-2xl p-4">
            <p className="font-semibold">{u.nombre}</p>
            <p className="text-slate-500">{u.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}