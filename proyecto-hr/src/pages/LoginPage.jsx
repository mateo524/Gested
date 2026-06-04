import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import AppLogo from "../components/brand/AppLogo";

const DEMO_MAILTO = "mailto:contacto@zentor.app?subject=Demo%20ZENTOR";

const defaultBranding = {
  nombreVisible: "ZENTOR",
  logoUrl: "",
  primaryColor: "#14B8A6",
};

const NAV_LINKS = [
  { href: "#solucion", label: "Producto" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#modulos", label: "Módulos" },
  { href: "#demo", label: "Demo" },
];

const PROBLEM_POINTS = [
  "Evaluaciones que quedan incompletas o se pierden entre versiones.",
  "Managers sin visibilidad real del equipo.",
  "Datos duplicados en varias planillas.",
  "Reportes armados a mano, una y otra vez.",
  "Planes de desarrollo sin seguimiento.",
];

const SOLUTION_CARDS = [
  {
    title: "Personas y accesos",
    body: "Empleados, usuarios y roles ordenados, con permisos por alcance.",
    accent: "#14B8A6",
  },
  {
    title: "Ciclos y competencias",
    body: "Definí ciclos de evaluación y las competencias que querés medir.",
    accent: "#8B5CF6",
  },
  {
    title: "Evaluaciones y mediciones",
    body: "Autoevaluación, evaluación del responsable y mediciones en un mismo flujo.",
    accent: "#14B8A6",
  },
  {
    title: "Planes de desarrollo",
    body: "Convertí los resultados en acciones concretas con seguimiento.",
    accent: "#8B5CF6",
  },
  {
    title: "Reportes ejecutivos",
    body: "Resúmenes claros para dirección y RRHH, listos para compartir.",
    accent: "#14B8A6",
  },
  {
    title: "Importación desde Excel",
    body: "Subí tus planillas actuales con una plantilla y validación previa.",
    accent: "#8B5CF6",
  },
];

const BENEFIT_POINTS = [
  "Centralizá los datos de desempeño en un solo lugar.",
  "Medí autoevaluación vs. evaluación del responsable.",
  "Detectá brechas y fortalezas del equipo.",
  "Convertí resultados en planes de desarrollo.",
  "Generá reportes ejecutivos sin armarlos a mano.",
  "Controlá permisos por rol y alcance.",
];

const MODULES = [
  "Personas y usuarios",
  "Evaluaciones",
  "Mediciones",
  "Desarrollo",
  "Reportes",
  "Importación",
];

const SECURITY_POINTS = [
  "Roles por alcance.",
  "Control de permisos.",
  "Importación validada.",
  "Backups y recuperación manual documentados.",
  "Monitoreo con endpoint de health.",
];

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#14B8A6]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-7 text-[#AFC3CE]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({ token: "", newPassword: "" });
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [portalBranding] = useState(defaultBranding);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    "w-full rounded-[1.25rem] border border-white/15 bg-[#0E1A20] px-4 py-3.5 text-white outline-none transition focus:border-[#14B8A6]";

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

  const loginPanel = (
    <div
      id="login"
      className="w-full scroll-mt-24 rounded-[1.75rem] border border-white/10 bg-[#1A2C38] p-7 shadow-[0_20px_60px_rgba(2,8,23,0.35)] backdrop-blur"
    >
      <p className="text-xs uppercase tracking-[0.28em] text-[#7A9AAA]">Ingreso seguro</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-white">
        Entrar a {portalBranding.nombreVisible}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#AFC3CE]">
        Gestión del desempeño, control de accesos y operación interna desde un solo lugar.
      </p>

      {mode === "login" && (
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={inputClass}
          />

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
            onClick={() => {
              setMessage("");
              setMode("forgot");
            }}
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
        <form className="mt-8 space-y-4" onSubmit={handleForgotPassword}>
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
            onClick={() => {
              setMessage("");
              setMode("login");
            }}
            className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#AFC3CE] transition hover:border-white/40"
          >
            Volver al login
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form className="mt-8 space-y-4" onSubmit={handleResetPassword}>
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
            onChange={(e) =>
              setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))
            }
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
            onClick={() => {
              setMessage("");
              setMode("login");
            }}
            className="w-full rounded-[1.25rem] border border-white/20 py-3 text-sm text-[#AFC3CE] transition hover:border-white/40"
          >
            Volver al login
          </button>
        </form>
      )}

      {message ? (
        <p className="mt-4 rounded-2xl border border-white/15 bg-[#0E1A20] px-4 py-3 text-sm text-[#E8EEF1]">
          {message}
        </p>
      ) : (
        <p className="mt-4 text-sm text-[#7A9AAA]">
          Si el servidor estaba inactivo, el primer ingreso puede tardar algunos segundos.
        </p>
      )}
    </div>
  );

  const heroChips = useMemo(
    () => ["Sin Excel disperso", "Roles por alcance", "Importación validada"],
    []
  );

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-[#0E1A20] text-[#E8EEF1]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1A20]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 md:px-8">
          <a href="#top" className="flex items-center gap-3">
            <AppLogo variant="dark" />
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[#AFC3CE] transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="#login"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-[#E8EEF1] transition hover:border-white/40"
            >
              Entrar
            </a>
            <a
              href={DEMO_MAILTO}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Pedir demo
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-5 md:px-8">
        {/* Hero */}
        <section className="grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-10 -top-16 h-64 w-64 rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-10 left-24 h-56 w-56 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: "#8B5CF6" }}
              aria-hidden="true"
            />
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#14B8A6]">
                Gestión del desempeño
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] text-white md:text-5xl lg:text-6xl">
                Evaluaciones de desempeño, mediciones y planes de desarrollo en un solo
                lugar.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#AFC3CE] md:text-lg">
                ZENTOR ayuda a equipos de RRHH y dirección a reemplazar planillas dispersas
                por un proceso claro: personas, ciclos, competencias, evaluaciones,
                mediciones, planes y reportes ejecutivos.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={DEMO_MAILTO}
                  className="rounded-[1.25rem] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  Pedir demo
                </a>
                <a
                  href="#login"
                  className="rounded-[1.25rem] border border-white/20 px-6 py-3.5 text-base font-semibold text-[#E8EEF1] transition hover:border-white/40"
                >
                  Entrar a mi cuenta
                </a>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-6 text-[#7A9AAA]">
                Ideal para instituciones, empresas y equipos que necesitan ordenar el
                desempeño sin depender de Excel.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {heroChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-[#142028] px-3.5 py-1.5 text-xs text-[#AFC3CE]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:pl-6">{loginPanel}</div>
        </section>

        {/* Problema */}
        <section id="producto" className="scroll-mt-24 border-t border-white/10 py-14 md:py-20">
          <SectionTitle
            eyebrow="El problema"
            title="Cuando el desempeño vive en planillas, el seguimiento se pierde."
          />
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#142028] p-4"
              >
                <span
                  className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: "#8B5CF6" }}
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[#C5D5DE]">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Solución */}
        <section id="solucion" className="scroll-mt-24 border-t border-white/10 py-14 md:py-20">
          <SectionTitle
            eyebrow="La solución"
            title="ZENTOR ordena el ciclo completo."
            subtitle="Todo el proceso de desempeño en módulos conectados, desde las personas hasta el reporte ejecutivo."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTION_CARDS.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-[#142028] p-5 transition hover:border-white/20"
              >
                <span
                  className="inline-block h-9 w-9 rounded-xl"
                  style={{ backgroundColor: `${card.accent}26`, border: `1px solid ${card.accent}55` }}
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#AFC3CE]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Beneficios */}
        <section id="beneficios" className="scroll-mt-24 border-t border-white/10 py-14 md:py-20">
          <SectionTitle
            eyebrow="Beneficios"
            title="Menos carga operativa, más decisiones."
          />
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFIT_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#142028] p-4"
              >
                <span
                  className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: "#14B8A6" }}
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[#C5D5DE]">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Módulos */}
        <section id="modulos" className="scroll-mt-24 border-t border-white/10 py-14 md:py-20">
          <SectionTitle eyebrow="Módulos" title="Una plataforma, seis módulos." />
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((moduleName, index) => (
              <div
                key={moduleName}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#142028] p-5"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: index % 2 === 0 ? "#14B8A626" : "#8B5CF626" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-base font-medium text-white">{moduleName}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Seguridad / operación */}
        <section className="border-t border-white/10 py-14 md:py-20">
          <SectionTitle
            eyebrow="Seguridad y operación"
            title="Preparado para piloto seguro."
            subtitle="Lo esencial para correr un piloto con confianza, sin promesas que no podamos sostener."
          />
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_POINTS.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-white/10 bg-[#142028] p-4 text-sm leading-6 text-[#C5D5DE]"
              >
                {point}
              </div>
            ))}
          </div>
        </section>

        {/* Demo CTA */}
        <section id="demo" className="scroll-mt-24 py-14 md:py-20">
          <div
            className="overflow-hidden rounded-[2rem] border border-white/10 p-8 md:p-12"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,184,166,0.16), rgba(139,92,246,0.16))",
            }}
          >
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-white md:text-4xl">
              ¿Querés ver ZENTOR con datos reales de ejemplo?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#D3E0E7]">
              Podemos mostrarte un recorrido completo con usuarios por rol, evaluaciones,
              mediciones, planes y reportes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={DEMO_MAILTO}
                className="rounded-[1.25rem] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Pedir demo
              </a>
              <a
                href="#login"
                className="rounded-[1.25rem] border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition hover:border-white/45"
              >
                Entrar a mi cuenta
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0E1A20]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <AppLogo variant="dark" />
            <p className="mt-3 text-sm text-[#7A9AAA]">
              Gestión del desempeño y desarrollo.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-6">
            <a href="#solucion" className="text-sm text-[#AFC3CE] transition hover:text-white">
              Producto
            </a>
            <a href="#demo" className="text-sm text-[#AFC3CE] transition hover:text-white">
              Demo
            </a>
            <a href="#login" className="text-sm text-[#AFC3CE] transition hover:text-white">
              Entrar
            </a>
          </nav>
        </div>
        <div className="border-t border-white/5">
          <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-[#5f7886] md:px-8">
            © {currentYear} ZENTOR. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
