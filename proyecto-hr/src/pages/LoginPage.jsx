import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    try {
      setMessage("");

      const url = `${import.meta.env.VITE_API_URL}/auth/login`;
      console.log("LOGIN URL:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const text = await response.text();
      console.log("LOGIN STATUS:", response.status);
      console.log("LOGIN RESPONSE TEXT:", text);

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `El backend no devolvió JSON válido. Respuesta recibida: ${text || "vacía"}`
        );
      }

      if (!response.ok) {
        throw new Error(data.mensaje || "Error al iniciar sesión");
      }

      login(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          Centro de operaciones de personal
        </p>

        <h1 className="text-4xl font-bold mt-3">Iniciar sesión</h1>

        <p className="text-slate-500 mt-2">
          Acceso seguro para administración RRHH multiempresa.
        </p>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-slate-300 rounded-2xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-slate-300 rounded-2xl px-4 py-3"
          />

          <button
            onClick={handleSubmit}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-3 font-semibold"
          >
            Entrar
          </button>
        </div>

        {message && (
          <p className="mt-4 text-red-500 whitespace-pre-wrap">{message}</p>
        )}

        <div className="mt-6 text-sm text-slate-500">
          <p>Correo electrónico: admin@demo.com</p>
          <p>Contraseña: 123456</p>
        </div>
      </div>
    </div>
  );
}