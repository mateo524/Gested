import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL;

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [cargando, setCargando] = useState(false);
  const [despertando, setDespertando] = useState(false);

  const handleSubmit = async () => {
    setMessage("");

    // 1. Despertar servidor si está dormido
    if (!despertando) {
      setDespertando(true);
      setMessage("Conectando con el servidor...");
      try {
        await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
      } catch {
        // si falla igual intentamos login
      }
      setDespertando(false);
    }

    setCargando(true);
    setMessage("Iniciando sesión...");

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await response.text();

      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `El servidor no respondió correctamente. ${text ? "Respuesta: " + text : "Intentalo de nuevo."}`
        );
      }

      if (!response.ok) {
        throw new Error(data.mensaje || "Error al iniciar sesión");
      }

      login(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCargando(false);
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
            disabled={cargando}
            className="w-full border border-slate-300 rounded-2xl px-4 py-3 disabled:opacity-50"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={cargando}
            className="w-full border border-slate-300 rounded-2xl px-4 py-3 disabled:opacity-50"
          />

          <button
            onClick={handleSubmit}
            disabled={cargando || despertando}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            {(cargando || despertando) && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {cargando || despertando ? "Esperando..." : "Entrar"}
          </button>
        </div>

        {message && (
          <p className="mt-4 text-red-500 whitespace-pre-wrap text-sm flex items-center gap-2">
            <span>{message === "Conectando con el servidor..." || message === "Iniciando sesión..." ? "⏳" : "⚠️"}</span>
            {message}
          </p>
        )}

        <div className="mt-6 text-sm text-slate-500">
          <p>Correo electrónico: admin@demo.com</p>
          <p>Contraseña: 123456</p>
        </div>
      </div>
    </div>
  );
}
