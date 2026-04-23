import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const signalCards = [
  {
    label: "Gestión de datos",
    value: "Centralizada",
    detail: "Usuarios, roles, permisos y trazabilidad en una sola plataforma.",
  },
  {
    label: "Auditoría",
    value: "Activa",
    detail: "Cada cambio importante puede quedar registrado y consultable.",
  },
  {
    label: "Operación",
    value: "Ordenada",
    detail: "Dashboard, settings y exportaciones para trabajar con foco.",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    try {
      event?.preventDefault();
      setMessage("");

      const data = await apiFetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      login(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-6 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-black/10 bg-[#f8f4ec] shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden bg-[#111111] p-8 text-white md:p-12 lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.15),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.16),_transparent_28%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-white/15 bg-white/10" />
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-200">
                  Gested
                </p>
                <p className="text-sm text-slate-300">Gestión de datos</p>
              </div>
            </div>

            <div className="mt-12 max-w-3xl">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                Plataforma interna
              </p>
              <h1 className="mt-4 text-5xl font-semibold leading-[0.95] md:text-6xl">
                Datos mejor organizados para tomar decisiones con más claridad
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Gested concentra acceso, control, seguridad y operación diaria en
                una experiencia más ordenada y profesional para gestionar información.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {signalCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {card.value}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {card.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-200">
                Acceso inicial
              </p>
              <p className="mt-3 text-sm text-slate-200">
                Cuando MongoDB quede conectado correctamente, el sistema genera el admin
                inicial para entrar por primera vez.
              </p>
              <div className="mt-4 space-y-1 text-sm text-white">
                <p>Email: admin@demo.com</p>
                <p>Contraseña: 123456</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[#f8f4ec] p-8 md:p-12">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Ingreso seguro
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">
              Entrar a Gested
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Gestión de datos, control de accesos y operación interna desde un solo lugar.
            </p>

            <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-[1.25rem] border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-[1.25rem] border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <button
                type="submit"
                className="w-full rounded-[1.25rem] bg-slate-950 py-3.5 font-semibold text-white transition hover:bg-slate-800"
              >
                Iniciar sesión
              </button>
            </form>

            {message ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {message}
              </p>
            ) : null}

            <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Gested
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tu página pública muestra el valor del servicio; este login ahora busca
                continuar esa misma identidad visual y verbal dentro del sistema.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
