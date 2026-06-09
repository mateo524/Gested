import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";

function splitUserName(user) {
  const rawName = String(user?.nombre || "").trim();
  const rawLastName = String(user?.apellido || "").trim();
  if (rawLastName) return { nombre: rawName, apellido: rawLastName };
  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: rawName, apellido: "" };
  return { nombre: parts[0], apellido: parts.slice(1).join(" ") };
}

function getDisplayName(user) {
  return [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim() || user?.nombre || "Usuario";
}

function getInitials(user) {
  const parts = getDisplayName(user).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

const emptyPasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function ProfilePage() {
  const { token, user, activeCompany, updateSession } = useAuth();
  const { addToast } = useToast();
  const [profileForm, setProfileForm] = useState(() => {
    const n = splitUserName(user);
    return { nombre: n.nombre, apellido: n.apellido, avatarUrl: user?.avatarUrl || "" };
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
      setProfileError("El nombre es obligatorio.");
      return;
    }
    try {
      setSavingProfile(true);
      setProfileError("");
      const data = await apiFetch("/auth/me/profile", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      await updateSession({ token: data.token, user: data.user });
      addToast({ message: data.mensaje || "Perfil actualizado.", type: "success" });
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Completá los tres campos de contraseña.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("La nueva contraseña necesita al menos 6 caracteres.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    try {
      setSavingPassword(true);
      setPasswordError("");
      const data = await apiFetch("/auth/me/password", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      await updateSession({ token: data.token, user: data.user });
      setPasswordForm(emptyPasswordForm);
      addToast({ message: data.mensaje || "Contraseña actualizada.", type: "success" });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Cuenta</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Mi perfil</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Identity card */}
        <div className="pf-card p-6">
          <div className="flex items-center gap-4">
            {profileForm.avatarUrl ? (
              <img src={profileForm.avatarUrl} alt={displayName} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-[#14b8a6]/30" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-xl font-semibold text-[#0f172a] shadow-[0_8px_20px_rgba(20,184,166,0.3)]">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white">{displayName}</p>
              <p className="mt-0.5 text-sm text-[#14b8a6]">{user?.roleLabel || user?.roleName || user?.roleKey || "Sin rol"}</p>
              <p className="mt-0.5 text-xs text-[#7a98a8]">{user?.email}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111f28] to-[#0c1920] p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#5e7d8e]">Rol</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{user?.roleLabel || user?.roleName || "Sin rol asignado"}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111f28] to-[#0c1920] p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#5e7d8e]">Alcance</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{user?.scope || user?.roleScope || "Global"}</p>
            </div>
            <div className="col-span-full rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111f28] to-[#0c1920] p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#5e7d8e]">Organización activa</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{organizationLabel}</p>
            </div>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleProfileSubmit} className="pf-card p-6">
          <h3 className="text-sm font-semibold text-white">Datos básicos</h3>
          <p className="mt-0.5 text-xs text-[#7a98a8]">Nombre, apellido y avatar URL.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-[#9fb6c4]">Nombre</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
                value={profileForm.nombre}
                onChange={(e) => setProfileForm((c) => ({ ...c, nombre: e.target.value }))}
                placeholder="Ej: Ana"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-[#9fb6c4]">Apellido</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
                value={profileForm.apellido}
                onChange={(e) => setProfileForm((c) => ({ ...c, apellido: e.target.value }))}
                placeholder="Ej: Pérez"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs text-[#9fb6c4]">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-[#7a98a8] cursor-not-allowed"
                value={user?.email || ""}
                readOnly
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs text-[#9fb6c4]">Avatar (URL)</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
                value={profileForm.avatarUrl}
                onChange={(e) => setProfileForm((c) => ({ ...c, avatarUrl: e.target.value }))}
                placeholder="https://..."
              />
            </label>
          </div>

          {profileError ? (
            <p className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{profileError}</p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-2xl bg-[#14b8a6] px-5 py-2.5 text-sm font-semibold text-[#0f172a] shadow-[0_4px_16px_rgba(20,184,166,0.25)] transition hover:bg-[#0d9488] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      {/* Password section */}
      <div className="pf-card p-6">
        <h3 className="text-sm font-semibold text-white">Contraseña</h3>
        <p className="mt-0.5 text-xs text-[#7a98a8]">Mínimo 6 caracteres. El rol y la organización no cambian.</p>

        <form onSubmit={handlePasswordSubmit} className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#9fb6c4]">Contraseña actual</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((c) => ({ ...c, currentPassword: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#9fb6c4]">Nueva contraseña</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((c) => ({ ...c, newPassword: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#9fb6c4]">Confirmación</span>
            <input
              type="password"
              className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white outline-none transition focus:border-[#14b8a6]"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((c) => ({ ...c, confirmPassword: e.target.value }))}
            />
          </label>

          <div className="flex items-center justify-between gap-3 lg:col-span-3">
            {passwordError ? (
              <p className="text-sm text-rose-300">{passwordError}</p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-2xl border border-white/15 bg-[#122530] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#172f3c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
