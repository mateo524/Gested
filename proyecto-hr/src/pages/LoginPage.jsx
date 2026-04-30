import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const defaultBranding = {
  nombreVisible: "Performia",
  logoUrl: "",
  primaryColor: "#10b981",
};

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [portalBranding] = useState(defaultBranding);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageStyle = useMemo(
    () => ({
      borderColor: `${portalBranding.primaryColor}22`,
      background: "linear-gradient(180deg, #f8f4ec, #f8f4ec)",
    }),
    [portalBranding.primaryColor]
  );

  const handleSubmit = async (event) => {
    try {
      event?.preventDefault();
      setMessage("");
      setIsSubmitting(true);

      const data = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      await login(data);
    } catch (error) {
      setMessage(error.message || "No se pudo iniciar sesion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1A20] px-6 py-8 text-[#E8EEF1]">
      <div
        className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[2rem] border shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.15fr_0.85fr]"
        style={pageStyle}
      >
        <section className="relative overflow-hidden bg-[#0E1A20] p-8 text-white md:p-12 lg:p-14">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at top left, ${portalBranding.primaryColor}40, transparent 30%), radial-gradient(circle at bottom right, rgba(255,255,255,0.08), transparent 28%)`,
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              {portalBranding.logoUrl ? (
                <img
                  src={portalBranding.logoUrl}
                  alt={portalBranding.nombreVisible}
                  className="h-12 w-12 rounded-full border border-white/15 object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-amber-200">
                  P
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-200">
                  {portalBranding.nombreVisible}
                </p>
                <p className="text-sm text-[#7A9AAA]">Gestion del desempeno</p>
              </div>
            </div>

            <div className="mt-12 max-w-3xl">
              <p
                className="text-xs uppercase tracking-[0.3em]"
                style={{ color: portalBranding.primaryColor }}
              >
                Plataforma interna
              </p>
              <h1 className="mt-4 text-5xl leading-[0.95] md:text-6xl" style={{ fontFamily: "Instrument Serif, serif" }}>
                Datos mejor organizados para tomar decisiones con mas claridad
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#AFC3CE] md:text-lg">
                Performia concentra acceso, control, seguridad y operacion diaria en una
                experiencia mas ordenada y profesional para gestionar informacion.
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#142028] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7A9AAA]">Gestion</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Centralizada</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#142028] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7A9AAA]">Auditoria</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Activa</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#142028] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7A9AAA]">Operacion</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Ordenada</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[#142028] p-8 md:p-12">
          <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#1A2C38] p-7 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-[#7A9AAA]">Ingreso seguro</p>
            <h2 className="mt-3 text-4xl leading-tight text-white" style={{ fontFamily: "Instrument Serif, serif" }}>
              Entrar a {portalBranding.nombreVisible}
            </h2>
            <p className="mt-3 text-base leading-7 text-[#AFC3CE]">
              Gestion del desempeno, control de accesos y operacion interna desde un solo lugar.
            </p>

            <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Correo electronico"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-[1.25rem] border border-white/15 bg-[#0E1A20] px-4 py-3.5 text-white outline-none transition focus:border-[#28964D]"
              />

              <input
                type="password"
                placeholder="Contrasena"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-[1.25rem] border border-white/15 bg-[#0E1A20] px-4 py-3.5 text-white outline-none transition focus:border-[#28964D]"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[1.25rem] py-3.5 font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: portalBranding.primaryColor }}
              >
                {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
              </button>
            </form>

            {message ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {message}
              </p>
            ) : (
              <p className="mt-4 text-sm text-[#7A9AAA]">
                Si el servidor estaba inactivo, el primer ingreso puede tardar algunos segundos.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
