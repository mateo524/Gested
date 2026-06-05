import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import AppLogo from "../components/brand/AppLogo";

const MARKETING_SITE_URL = "https://project-3f34a.vercel.app/";

const defaultBranding = {
  nombreVisible: "ZENTOR",
  logoUrl: "",
  primaryColor: "#14B8A6",
};

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({ token: "", newPassword: "" });
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [portalBranding] = useState(defaultBranding);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({});

  const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const passwordOk = form.password.length >= 6;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setResetForm((prev) => ({ ...prev, token: urlToken }));
      setMode("reset");
      setMessage("Token detectado. Ingresá tu nueva contraseña para continuar.");
    }
  }, []);

  const accent = portalBranding.primaryColor;

  const inputClass =
    "w-full rounded-[1.25rem] border border-white/15 bg-[#0E1A20] px-4 py-3.5 text-white outline-none transition focus:border-[#14B8A6] placeholder-[#7A9AAA]";

  const handleSubmit = async (event) => {
    try {
      event?.preventDefault();
      if (isSubmitting) return;
      setMessage("");
      setIsSubmitting(true);

      const data = await apiFetch("/auth/login", {
        method: "POST",
        timeoutMs: 30000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      await login(data);
    } catch (error) {
      setMessage(error.message || "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event) => {
    try {
      event?.preventDefault();
      setMessage("");
      setIsSubmitting(true);
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (data?.debugResetToken) {
        setResetForm((prev) => ({ ...prev, token: data.debugResetToken }));
      }

      setMessage(
        data?.debugResetToken
          ? `Email no configurado. Token de prueba: ${data.debugResetToken}`
          : "Si el correo existe, te enviamos un enlace para restablecer la contraseña."
      );
      setMode("reset");
    } catch (error) {
      setMessage(error.message || "No se pudo enviar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event) => {
    try {
      event?.preventDefault();
      setMessage("");
      setIsSubmitting(true);
      await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetForm.token,
          newPassword: resetForm.newPassword,
        }),
      });
      setMessage("Contraseña actualizada. Ahora iniciá sesión con la nueva clave.");
      setMode("login");
      setResetForm({ token: "", newPassword: "" });
    } catch (error) {
      setMessage(error.message || "No se pudo restablecer la contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E1A20] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <AppLogo variant="dark" />
        </div>

        {/* Card */}
        <div className="rounded-[1.75rem] border border-white/10 bg-[#1A2C38] p-8 shadow-[0_20px_60px_rgba(2,8,23,0.35)]">
          <p className="text-xs uppercase tracking-[0.28em] text-[#7A9AAA]">Ingreso seguro</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-white">
            {mode === "forgot"
              ? "Recuperar contraseña"
              : mode === "reset"
                ? "Nueva contraseña"
                : `Entrar a ${portalBranding.nombreVisible}`}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#AFC3CE]">
            {mode === "login"
              ? "Gestión del desempeño, control de accesos y operación interna."
              : mode === "forgot"
                ? "Ingresá tu correo y te enviamos un enlace de recuperación."
                : "Ingresá el token de recuperación y tu nueva contraseña."}
          </p>

          {mode === "login" && (
            <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
              <div>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  className={`${inputClass} ${touched.email && !emailValid ? "border-rose-400 focus:border-rose-400" : ""}`}
                  autoComplete="email"
                />
                {touched.email && !emailValid ? (
                  <p className="mt-1.5 px-1 text-xs text-rose-300">Ingresá un correo válido.</p>
                ) : null}
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  className={`${inputClass} ${touched.password && !passwordOk ? "border-rose-400 focus:border-rose-400" : ""}`}
                  autoComplete="current-password"
                />
                {touched.password && !passwordOk ? (
                  <p className="mt-1.5 px-1 text-xs text-rose-300">La contraseña necesita al menos 6 caracteres.</p>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[1.25rem] py-3.5 font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: accent }}
              >
                {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
              </button>
              <button
                type="button"
                onClick={() => { setMessage(""); setMode("forgot"); }}
                className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#AFC3CE] transition hover:border-white/40"
              >
                Olvidé mi contraseña
              </button>
              <button
                type="button"
                disabled
                className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#7A9AAA]"
                title="Próximo paso recomendado: login con Google Workspace"
              >
                Iniciar con Google (próximamente)
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form className="mt-7 space-y-4" onSubmit={handleForgotPassword}>
              <input
                type="email"
                placeholder="Correo registrado"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[1.25rem] py-3.5 font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: accent }}
              >
                {isSubmitting ? "Enviando..." : "Enviar enlace o token"}
              </button>
              <button
                type="button"
                onClick={() => { setMessage(""); setMode("login"); }}
                className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#AFC3CE] transition hover:border-white/40"
              >
                Volver al login
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form className="mt-7 space-y-4" onSubmit={handleResetPassword}>
              <input
                type="text"
                placeholder="Token de recuperación"
                value={resetForm.token}
                onChange={(e) => setResetForm((prev) => ({ ...prev, token: e.target.value }))}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 8)"
                value={resetForm.newPassword}
                onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[1.25rem] py-3.5 font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: accent }}
              >
                {isSubmitting ? "Actualizando..." : "Restablecer contraseña"}
              </button>
              <button
                type="button"
                onClick={() => { setMessage(""); setMode("login"); }}
                className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#AFC3CE] transition hover:border-white/40"
              >
                Volver al login
              </button>
            </form>
          )}

          {message ? (
            <p className="mt-5 rounded-2xl border border-white/15 bg-[#0E1A20] px-4 py-3 text-sm text-[#E8EEF1]">
              {message}
            </p>
          ) : (
            <p className="mt-5 text-sm text-[#7A9AAA]">
              Si el servidor estaba inactivo, el primer ingreso puede tardar algunos segundos.
            </p>
          )}
        </div>

        {/* Link a landing separada */}
        <p className="mt-6 text-center text-sm text-[#7A9AAA]">
          ¿Querés conocer ZENTOR?{" "}
          <a
            href={MARKETING_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#14B8A6] transition hover:underline"
          >
            Ver la landing →
          </a>
        </p>
      </div>
    </div>
  );
}
