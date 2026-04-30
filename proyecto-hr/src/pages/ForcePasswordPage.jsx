import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export default function ForcePasswordPage() {
  const { token, user, updateSession, logout } = useAuth();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setMessage("La nueva contraseña y la confirmación no coinciden");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const data = await apiFetch("/auth/change-password", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      await updateSession(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-6 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] md:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Primer acceso</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-950">Actualiza tu contraseña</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            {user?.nombre}, este acceso fue creado con una contraseña temporal. Antes de seguir
            trabajando en Performia, define una nueva clave personal.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Contraseña actual"
              value={form.currentPassword}
              onChange={(event) =>
                setForm({ ...form, currentPassword: event.target.value })
              }
              className="w-full rounded-[1.25rem] border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <input
              type="password"
              placeholder="Nueva contraseña"
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
              className="w-full rounded-[1.25rem] border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm({ ...form, confirmPassword: event.target.value })
              }
              className="w-full rounded-[1.25rem] border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[1.25rem] bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? "Guardando..." : "Actualizar contraseña"}
              </button>

              <button
                type="button"
                onClick={logout}
                className="rounded-[1.25rem] border border-slate-200 px-6 py-3.5 font-semibold text-slate-600"
              >
                Salir
              </button>
            </div>
          </form>

          {message ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
