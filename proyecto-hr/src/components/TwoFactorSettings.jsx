import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";

// ── inline SVG icons ────────────────────────────────────────────────────────
function ShieldCheckIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2l7 4v6c0 5-3.5 9-7 10C5.5 21 2 17 2 12V6l7-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldOffIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2l7 4v6c0 5-3.5 9-7 10C5.5 21 2 17 2 12V6l7-4z" strokeLinejoin="round" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="8" cy="15" r="5" />
      <path d="M13 15h8M17 12v6" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" />
    </svg>
  );
}

// ── steps ────────────────────────────────────────────────────────────────────
// idle → loading → enabled | setup → verifying → backup_codes
// enabled → disabling

const STEP = {
  LOADING: "loading",
  ENABLED: "enabled",
  DISABLED: "disabled",
  SETUP: "setup",
  VERIFYING: "verifying",
  BACKUP_CODES: "backup_codes",
  DISABLING: "disabling",
};

export default function TwoFactorSettings() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [step, setStep] = useState(STEP.LOADING);
  const [verifiedAt, setVerifiedAt] = useState(null);

  // setup
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // backup codes (shown after verify)
  const [backupCodes, setBackupCodes] = useState([]);

  // disable
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState("");

  // ── load status ─────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    setStep(STEP.LOADING);
    try {
      const data = await apiFetch("/auth/2fa/status", { token });
      if (data.enabled) {
        setVerifiedAt(data.verifiedAt || null);
        setStep(STEP.ENABLED);
      } else {
        setStep(STEP.DISABLED);
      }
    } catch (err) {
      addToast({ message: err.message || "Error al cargar el estado 2FA.", type: "error" });
      setStep(STEP.DISABLED);
    }
  }, [token, addToast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── start setup ──────────────────────────────────────────────────────────
  async function startSetup() {
    try {
      setStep(STEP.LOADING);
      const data = await apiFetch("/auth/2fa/setup", { method: "POST", token });
      setQrCodeUrl(data.qrCodeUrl || "");
      setManualKey(data.manualKey || data.secret || "");
      setVerifyCode("");
      setVerifyError("");
      setStep(STEP.SETUP);
    } catch (err) {
      addToast({ message: err.message || "No se pudo iniciar la configuración 2FA.", type: "error" });
      setStep(STEP.DISABLED);
    }
  }

  // ── verify code ──────────────────────────────────────────────────────────
  async function verifySetup(e) {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      setVerifyError("El código debe tener 6 dígitos.");
      return;
    }
    try {
      setStep(STEP.VERIFYING);
      const data = await apiFetch("/auth/2fa/verify", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      setBackupCodes(data.backupCodes || []);
      addToast({ message: "Autenticación en dos pasos activada correctamente.", type: "success" });
      setStep(STEP.BACKUP_CODES);
    } catch (err) {
      setVerifyError(err.message || "Código incorrecto. Verificá e intentá de nuevo.");
      setStep(STEP.SETUP);
    }
  }

  // ── disable ──────────────────────────────────────────────────────────────
  async function disable(e) {
    e.preventDefault();
    if (disableCode.length !== 6) {
      setDisableError("El código debe tener 6 dígitos.");
      return;
    }
    try {
      setStep(STEP.LOADING);
      await apiFetch("/auth/2fa/disable", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      addToast({ message: "Autenticación en dos pasos desactivada.", type: "info" });
      setDisableCode("");
      setDisableError("");
      setStep(STEP.DISABLED);
    } catch (err) {
      setDisableError(err.message || "Código incorrecto.");
      setStep(STEP.DISABLING);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => {
      addToast({ message: "Copiado al portapapeles.", type: "success" });
    });
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
      <div className="flex items-center gap-3">
        {step === STEP.ENABLED || step === STEP.DISABLING ? (
          <ShieldCheckIcon className="h-6 w-6 text-[#14b8a6]" />
        ) : (
          <ShieldOffIcon className="h-6 w-6 text-[#9fb6c4]" />
        )}
        <h3 className="text-xl font-semibold text-white">Autenticación en dos pasos (2FA)</h3>
      </div>
      <p className="mt-1 text-sm text-[#9fb6c4]">
        Protegé tu cuenta con una capa adicional de seguridad usando una app autenticadora (Google Authenticator, Authy, etc.).
      </p>

      <div className="mt-6">
        {/* ── loading ── */}
        {step === STEP.LOADING && (
          <div className="flex items-center gap-2 text-sm text-[#9fb6c4]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            Cargando estado...
          </div>
        )}

        {/* ── disabled ── */}
        {step === STEP.DISABLED && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#9fb6c4]" />
              <span className="text-sm text-[#9fb6c4]">2FA desactivado</span>
            </div>
            <button
              type="button"
              onClick={startSetup}
              className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
            >
              Activar autenticación en dos pasos
            </button>
          </div>
        )}

        {/* ── setup: QR + manual key + code input ── */}
        {step === STEP.SETUP && (
          <div className="space-y-5">
            <p className="text-sm text-[#c7d5dc]">
              Escaneá el código QR con tu app autenticadora o ingresá la clave manualmente.
            </p>

            {qrCodeUrl && (
              <div className="inline-block rounded-2xl border border-white/10 bg-white p-3">
                <img src={qrCodeUrl} alt="Código QR para 2FA" className="h-44 w-44" />
              </div>
            )}

            {manualKey && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#8fa9b7]">Clave manual</p>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                  <KeyIcon className="h-4 w-4 shrink-0 text-[#14b8a6]" />
                  <code className="flex-1 break-all font-mono text-sm tracking-widest text-white">{manualKey}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(manualKey)}
                    className="shrink-0 text-[#9fb6c4] transition hover:text-white"
                    aria-label="Copiar clave"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={verifySetup} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Ingresá el código de 6 dígitos de tu app</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setVerifyError("");
                  }}
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 font-mono text-xl tracking-[0.4em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
                />
              </label>
              {verifyError && (
                <p className="text-xs text-rose-300">{verifyError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
                >
                  Verificar y activar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(STEP.DISABLED)}
                  className="rounded-2xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-[#c5d5dc] transition hover:bg-white/5"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── verifying spinner ── */}
        {step === STEP.VERIFYING && (
          <div className="flex items-center gap-2 text-sm text-[#9fb6c4]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            Verificando código...
          </div>
        )}

        {/* ── backup codes ── */}
        {step === STEP.BACKUP_CODES && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-sm text-emerald-100">2FA activado correctamente. Guardá estos códigos de respaldo en un lugar seguro.</p>
            </div>

            {backupCodes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#8fa9b7]">Códigos de respaldo (de un solo uso)</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(backupCodes.join("\n"))}
                    className="flex items-center gap-1 text-xs text-[#14b8a6] transition hover:text-[#0d9488]"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    Copiar todos
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-2 text-center font-mono text-sm tracking-widest text-white">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={loadStatus}
              className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
            >
              Entendido
            </button>
          </div>
        )}

        {/* ── enabled ── */}
        {step === STEP.ENABLED && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-4 py-3">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-[#14b8a6]" />
              <div>
                <p className="text-sm font-semibold text-[#14b8a6]">2FA activo</p>
                {verifiedAt && (
                  <p className="text-xs text-[#9fb6c4]">
                    Activado el {new Date(verifiedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setDisableCode(""); setDisableError(""); setStep(STEP.DISABLING); }}
              className="rounded-2xl border border-rose-300/40 px-6 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
            >
              Desactivar 2FA
            </button>
          </div>
        )}

        {/* ── disabling: ask for code ── */}
        {step === STEP.DISABLING && (
          <form onSubmit={disable} className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-amber-300">
                <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-amber-100">Ingresá el código de tu app autenticadora para confirmar la desactivación.</p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Código de verificación</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="123456"
                value={disableCode}
                onChange={(e) => {
                  setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setDisableError("");
                }}
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 font-mono text-xl tracking-[0.4em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
              />
            </label>
            {disableError && (
              <p className="text-xs text-rose-300">{disableError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-2xl border border-rose-300/40 px-6 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
              >
                Confirmar desactivación
              </button>
              <button
                type="button"
                onClick={() => setStep(STEP.ENABLED)}
                className="rounded-2xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-[#c5d5dc] transition hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
