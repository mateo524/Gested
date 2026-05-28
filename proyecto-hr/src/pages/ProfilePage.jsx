import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function splitUserName(user) {
  const rawName = String(user?.nombre || "").trim();
  const rawLastName = String(user?.apellido || "").trim();
  if (rawLastName) {
    return { nombre: rawName, apellido: rawLastName };
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { nombre: rawName, apellido: "" };
  }

  return {
    nombre: parts[0],
    apellido: parts.slice(1).join(" "),
  };
}

function getDisplayName(user) {
  return [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim() || user?.nombre || "Usuario";
}

function getInitials(user) {
  const parts = getDisplayName(user).split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfilePage() {
  const { token, user, activeCompany, updateSession } = useAuth();
  const [profileForm, setProfileForm] = useState({
    nombre: "",
    apellido: "",
    avatarUrl: "",
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageType, setProfileMessageType] = useState("info");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] = useState("info");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const next = splitUserName(user);
    setProfileForm({
      nombre: next.nombre,
      apellido: next.apellido,
      avatarUrl: user?.avatarUrl || "",
    });
  }, []);

  const organizationLabel = activeCompany?.nombre || user?.companyName || "Organización activa";
  const displayName = useMemo(
    () => getDisplayName({ nombre: profileForm.nombre, apellido: profileForm.apellido }),
    [profileForm.apellido, profileForm.nombre]
  );
  const initials = useMemo(
    () => getInitials({ nombre: profileForm.nombre, apellido: profileForm.apellido }),
    [profileForm.apellido, profileForm.nombre]
  );

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!profileForm.nombre.trim()) {
      setProfileMessageType("warning");
      setProfileMessage("El nombre es obligatorio.");
      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage("");
      const data = await apiFetch("/auth/me/profile", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      await updateSession({ token: data.token, user: data.user });
      setProfileMessageType("success");
      setProfileMessage(data.mensaje || "Perfil actualizado.");
    } catch (error) {
      setProfileMessageType("error");
      setProfileMessage(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessageType("warning");
      setPasswordMessage("Completa la contraseña actual, la nueva y la confirmación.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordMessageType("warning");
      setPasswordMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessageType("warning");
      setPasswordMessage("La confirmación de la nueva contraseña no coincide.");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordMessage("");
      const data = await apiFetch("/auth/me/password", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      await updateSession({ token: data.token, user: data.user });
      setPasswordForm(emptyPasswordForm);
      setPasswordMessageType("success");
      setPasswordMessage(data.mensaje || "Contraseña actualizada.");
    } catch (error) {
      setPasswordMessageType("error");
      setPasswordMessage(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <p className="pf-section-title">Mi perfil</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Configuración personal</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#a8bdc8] md:text-base">
          Revisá tus datos básicos, tu alcance actual y cómo se muestra tu rol dentro de la organización.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="pf-card p-6">
          <div className="flex items-center gap-4">
            {profileForm.avatarUrl ? (
              <img src={profileForm.avatarUrl} alt={displayName} className="h-20 w-20 rounded-3xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#1e3a8a] text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-white">{displayName}</p>
              <p className="mt-1 text-sm text-[#7ea3ff]">{user?.roleLabel || user?.roleName || user?.roleKey || "Sin rol visible"}</p>
              <p className="mt-2 text-sm text-[#97adba]">{organizationLabel}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">roleLabel</p>
              <p className="mt-2 text-sm font-semibold text-white">{user?.roleLabel || user?.roleName || "Sin rol visible"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">roleKey</p>
              <p className="mt-2 text-sm font-semibold text-white">{user?.roleKey || user?.roleCode || "-"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Scope</p>
              <p className="mt-2 text-sm font-semibold text-white">{user?.scope || user?.roleScope || "-"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Organización activa</p>
              <p className="mt-2 text-sm font-semibold text-white">{organizationLabel}</p>
            </div>
          </div>
        </article>

        <form onSubmit={handleProfileSubmit} className="pf-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Datos básicos</h2>
              <p className="mt-2 text-sm text-[#9fb6c4]">Podés actualizar tu nombre, apellido y la URL de tu avatar.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-[#c5d5de]">Nombre</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={profileForm.nombre}
                onChange={(event) => setProfileForm((current) => ({ ...current, nombre: event.target.value }))}
                placeholder="Ej: Ana"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-[#c5d5de]">Apellido</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={profileForm.apellido}
                onChange={(event) => setProfileForm((current) => ({ ...current, apellido: event.target.value }))}
                placeholder="Ej: Pérez"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-[#c5d5de]">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-[#8fa9b7]"
                value={user?.email || ""}
                readOnly
              />
              <p className="mt-2 text-xs text-[#7f99a8]">El email queda en solo lectura en esta etapa.</p>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-[#c5d5de]">Avatar por URL</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={profileForm.avatarUrl}
                onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
          </div>

          {profileMessage ? (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              profileMessageType === "success"
                ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                : profileMessageType === "error"
                  ? "border border-rose-300/30 bg-rose-500/10 text-rose-100"
                  : "border border-amber-300/30 bg-amber-500/10 text-amber-100"
            }`}>
              {profileMessage}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>

      <section className="pf-card p-6">
        <h2 className="text-xl font-semibold text-white">Contraseña</h2>
        <p className="mt-2 text-sm text-[#9fb6c4]">Actualizá tu contraseña sin cambiar el rol, el scope ni la organización activa.</p>

        <form onSubmit={handlePasswordSubmit} className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Contraseña actual</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Nueva contraseña</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Confirmación</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            />
          </label>

          <div className="lg:col-span-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[#7f99a8]">La nueva contraseña debe tener al menos 6 caracteres.</p>
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>

        {passwordMessage ? (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            passwordMessageType === "success"
              ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              : passwordMessageType === "error"
                ? "border border-rose-300/30 bg-rose-500/10 text-rose-100"
                : "border border-amber-300/30 bg-amber-500/10 text-amber-100"
          }`}>
            {passwordMessage}
          </div>
        ) : null}
      </section>
    </div>
  );
}
