import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import CollapsibleList from "../components/CollapsibleList";

const ROLE_ORDER = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "HR",
  "MANAGER",
  "EMPLOYEE",
  "VIEWER",
  "AUDITOR",
];

const SCOPE_LABELS = {
  ORGANIZATION: "Acceso a toda la organización.",
  DEPARTMENT: "Acceso limitado a un departamento o área.",
  TEAM: "Acceso limitado a un equipo.",
  SELF: "Acceso solo a la información propia.",
};

const ROLE_ICONS = {
  ORG_OWNER: (
    <path d="M12 3l6 3v4c0 4.2-2.5 8.1-6 10-3.5-1.9-6-5.8-6-10V6l6-3zm0 4.5l-1.6 3.1-3.4.5 2.5 2.5-.6 3.4 3.1-1.7 3.1 1.7-.6-3.4 2.5-2.5-3.4-.5L12 7.5z" />
  ),
  ORG_ADMIN: (
    <>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M18.5 7.5H22M20.25 5.75v3.5" />
    </>
  ),
  HR: (
    <>
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path d="M3.5 20a5.5 5.5 0 0 1 9 0" />
      <path d="M13 20a4.5 4.5 0 0 1 7.5-2.8" />
    </>
  ),
  MANAGER: (
    <>
      <path d="M7.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M16.5 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path d="M3 20a5.5 5.5 0 0 1 9 0" />
      <path d="M14.5 20H21" />
      <path d="M17.75 16.75V20" />
    </>
  ),
  EMPLOYEE: (
    <>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  VIEWER: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <path d="M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </>
  ),
  AUDITOR: (
    <>
      <path d="M12 3l6 3v4c0 4.2-2.5 8.1-6 10-3.5-1.9-6-5.8-6-10V6l6-3z" />
      <path d="M9.5 12.5l1.7 1.7 3.3-4" />
    </>
  ),
};

const MATRIX_COLUMNS = [
  { key: "ORG_OWNER", label: "ORG_OWNER" },
  { key: "ORG_ADMIN", label: "ORG_ADMIN" },
  { key: "HR", label: "HR" },
  { key: "MANAGER", label: "MANAGER" },
  { key: "COORDINADOR", label: "Coordinador Academico" },
  { key: "EMPLOYEE", label: "EMPLOYEE" },
  { key: "VIEWER", label: "VIEWER" },
  { key: "AUDITOR", label: "AUDITOR" },
];

const MATRIX_ROWS = [
  { label: "Personas", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "allow", MANAGER: "limited", COORDINADOR: "limited", EMPLOYEE: "deny", VIEWER: "limited", AUDITOR: "limited" } },
  { label: "Evaluaciones", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "allow", MANAGER: "allow", COORDINADOR: "allow", EMPLOYEE: "limited", VIEWER: "deny", AUDITOR: "limited" } },
  { label: "Objetivos / Indicadores", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "allow", MANAGER: "limited", COORDINADOR: "allow", EMPLOYEE: "limited", VIEWER: "limited", AUDITOR: "limited" } },
  { label: "Desarrollo", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "allow", MANAGER: "allow", COORDINADOR: "allow", EMPLOYEE: "limited", VIEWER: "deny", AUDITOR: "limited" } },
  { label: "Reportes", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "allow", MANAGER: "limited", COORDINADOR: "limited", EMPLOYEE: "limited", VIEWER: "limited", AUDITOR: "allow" } },
  { label: "Configuración", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "limited", MANAGER: "deny", COORDINADOR: "deny", EMPLOYEE: "na", VIEWER: "deny", AUDITOR: "deny" } },
  { label: "Datos / Importación", values: { ORG_OWNER: "allow", ORG_ADMIN: "allow", HR: "limited", MANAGER: "deny", COORDINADOR: "deny", EMPLOYEE: "na", VIEWER: "deny", AUDITOR: "deny" } },
];

const STATE_META = {
  allow: { label: "Permite", symbol: "check", className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" },
  limited: { label: "Limitado", symbol: "minus", className: "border-amber-300/30 bg-amber-500/10 text-amber-100" },
  deny: { label: "Deniega", symbol: "cross", className: "border-rose-300/30 bg-rose-500/10 text-rose-100" },
  na: { label: "No aplica", symbol: "dot", className: "border-white/10 bg-[#0f1f28] text-[#9eb3bf]" },
};

const PAGE_TABS = [
  { key: "base", label: "Roles base" },
  { key: "assignments", label: "Asignaciones" },
  { key: "matrix", label: "Matriz de permisos" },
  { key: "builder", label: "Crear / editar rol" },
];

const CONFIG_ITEMS = [
  { key: "settings", label: "Organización" },
  { key: "empleados", label: "Departamentos" },
  { key: "ciclos", label: "Ciclos" },
  { key: "carga-masiva", label: "Plantillas" },
  { key: "roles", label: "Roles y accesos", active: true },
  { key: "settings", label: "Integraciones" },
  { key: "settings", label: "Seguridad" },
  { key: "settings", label: "Auditoria" },
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function getUserLabel(userRef) {
  if (!userRef || typeof userRef !== "object") return "Usuario sin datos";
  return userRef.nombre || userRef.email || "Usuario sin nombre";
}

function getUserEmail(userRef) {
  if (!userRef || typeof userRef !== "object") return "";
  return userRef.email || "";
}

function getScopeLabel(scope) {
  return scope === "ORGANIZATION"
    ? "ORGANIZATION"
    : scope === "DEPARTMENT"
      ? "DEPARTMENT"
      : scope === "TEAM"
        ? "TEAM"
        : scope === "SELF"
          ? "SELF"
          : scope;
}

function buildScopeDescription(item) {
  if (item.scope === "DEPARTMENT" && item.departmentCode) return item.departmentCode;
  if (item.scope === "TEAM" && item.teamId) return item.teamId;
  return item.scope === "SELF" ? "Solo la persona" : "Toda la organización";
}

function summarizeCapabilities(preset) {
  return normalizeList(preset.highlights || preset.capabilities || preset.defaultPermissions).slice(0, 3);
}

function sortPresets(presets) {
  const orderMap = new Map(ROLE_ORDER.map((roleKey, index) => [roleKey, index]));
  return [...presets].sort((left, right) => (orderMap.get(left.roleKey) ?? 999) - (orderMap.get(right.roleKey) ?? 999));
}

function IconBadge({ children, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : tone === "info"
        ? "border-blue-300/30 bg-blue-500/10 text-blue-100"
        : "border-white/10 bg-[#122530] text-[#d5e2e9]";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>{children}</span>;
}

function RoleIcon({ roleKey }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#101d25] text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        {ROLE_ICONS[roleKey] || ROLE_ICONS.EMPLOYEE}
      </svg>
    </span>
  );
}

function MatrixMark({ stateKey }) {
  const meta = STATE_META[stateKey];
  const glyph =
    meta.symbol === "check" ? (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M4.5 10.5l3.5 3.5 7-7" />
      </svg>
    ) : meta.symbol === "minus" ? (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M5 10h10" />
      </svg>
    ) : meta.symbol === "cross" ? (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M6 6l8 8M14 6l-8 8" />
      </svg>
    ) : (
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    );

  return (
    <span className={`inline-flex min-w-[108px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${meta.className}`}>
      {glyph}
      {meta.label}
    </span>
  );
}

export default function RolesPage() {
  const { token, hasPermission } = useAuth();
  const { setView } = useView();
  const [presets, setPresets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [activeTab, setActiveTab] = useState("builder");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [form, setForm] = useState({
    userId: "",
    roleKey: "ORG_ADMIN",
    scope: "ORGANIZATION",
    scopeReference: "",
    active: true,
    startDate: "",
    endDate: "",
    notes: "",
  });

  const canManageAssignments = hasPermission("manage_roles") || hasPermission("manage_users");
  const canReadAssignments = canManageAssignments || hasPermission("view_audit");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        apiFetch("/roles/presets", { token }),
        canReadAssignments ? apiFetch("/roles/assignments", { token }) : Promise.resolve({ items: [] }),
        canManageAssignments ? apiFetch("/users", { token }) : Promise.resolve([]),
      ];
      const [presetData, assignmentData, usersData] = await Promise.all(requests);
      setPresets(sortPresets(normalizeList(presetData?.presets)));
      setAssignments(normalizeList(assignmentData?.items));
      setUsers(normalizeList(usersData));
      setMessage("");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [canManageAssignments, canReadAssignments, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const presetMap = useMemo(() => new Map(presets.map((preset) => [preset.roleKey, preset])), [presets]);

  const assignmentGroups = useMemo(
    () =>
      assignments.reduce((acc, item) => {
        const current = acc[item.roleKey] || [];
        current.push(item);
        acc[item.roleKey] = current;
        return acc;
      }, {}),
    [assignments]
  );

  const filteredAssignments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter((item) => {
      const preset = presetMap.get(item.roleKey);
      const values = [
        getUserLabel(item.userId),
        getUserEmail(item.userId),
        preset?.label,
        item.roleKey,
        item.scope,
        item.departmentCode,
        item.teamId,
      ];
      return values.some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [assignments, presetMap, query]);

  const selectedPreset = presetMap.get(form.roleKey) || presets[0] || null;
  const availableScopes = useMemo(
    () => normalizeList(selectedPreset?.allowedScopes).filter((scope) => ["ORGANIZATION", "DEPARTMENT", "TEAM", "SELF"].includes(scope)),
    [selectedPreset]
  );

  useEffect(() => {
    if (!selectedPreset) return;
    if (!availableScopes.includes(form.scope)) {
      setForm((current) => ({
        ...current,
        scope: availableScopes[0] || "ORGANIZATION",
        scopeReference: "",
      }));
    }
  }, [availableScopes, form.scope, selectedPreset]);

  const visibleScopeCards = useMemo(
    () =>
      ["ORGANIZATION", "DEPARTMENT", "TEAM", "SELF"].filter((scope) =>
        presets.some((preset) => normalizeList(preset.allowedScopes).includes(scope))
      ),
    [presets]
  );

  const summary = useMemo(
    () => ({
      activeAssignments: assignments.filter((item) => item.active !== false).length,
      rolesCount: presets.length,
      customExampleUsers: filteredAssignments.filter((item) => item.scope === "DEPARTMENT").length,
    }),
    [assignments, filteredAssignments, presets]
  );

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({
      userId: "",
      roleKey: presets[0]?.roleKey || "ORG_ADMIN",
      scope: presets[0]?.allowedScopes?.[0] || "ORGANIZATION",
      scopeReference: "",
      active: true,
      startDate: "",
      endDate: "",
      notes: "",
    });
  }

  function startEdit(assignment) {
    setDrawerOpen(true);
    setActiveTab("assignments");
    setEditingId(assignment._id);
    setForm({
      userId: typeof assignment.userId === "object" && assignment.userId?._id ? assignment.userId._id : assignment.userId || "",
      roleKey: assignment.roleKey,
      scope: assignment.scope,
      scopeReference:
        assignment.scope === "DEPARTMENT"
          ? assignment.departmentCode || ""
          : assignment.scope === "TEAM"
            ? assignment.teamId || ""
            : "",
      active: assignment.active !== false,
      startDate: "",
      endDate: "",
      notes: "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.userId || !form.roleKey || !form.scope) {
      setMessageType("warning");
      setMessage("Completa usuario, rol base y alcance.");
      return;
    }

    if ((form.scope === "DEPARTMENT" || form.scope === "TEAM") && !form.scopeReference.trim()) {
      setMessageType("warning");
      setMessage("Completa el área o equipo antes de guardar.");
      return;
    }

    const body = {
      userId: form.userId,
      roleKey: form.roleKey,
      scope: form.scope,
      active: form.active,
      departmentCode: form.scope === "DEPARTMENT" ? form.scopeReference.trim() : "",
      teamId: form.scope === "TEAM" ? form.scopeReference.trim() : "",
    };

    try {
      setSubmitting(true);
      await apiFetch(editingId ? `/roles/assignments/${editingId}` : "/roles/assignments", {
        method: editingId ? "PUT" : "POST",
        token,
        timeoutMs: 20000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadData();
      resetForm();
      setMessageType("success");
      setMessage(editingId ? "Asignación actualizada." : "Asignación creada.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="pf-card p-4">
          <p className="pf-section-title">Configuración</p>
          <div className="mt-4 space-y-1.5">
            {CONFIG_ITEMS.map((item) => (
              <button
                key={`${item.label}-${item.key}`}
                type="button"
                onClick={() => setView(item.key)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                  item.active
                    ? "bg-[#1e3a8a] text-white"
                    : "text-[#a9bfca] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {item.active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm font-semibold text-white">¿Necesitas ayuda?</p>
            <p className="mt-2 text-sm text-[#95aebc]">
              Usa esta pantalla para definir roles base, alcances y asignaciones sin exponer detalles técnicos.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white"
            >
              Ver guía rápida
            </button>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="pf-surface pf-surface-pad">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="pf-section-title">Configuración &gt; Roles y accesos</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Roles y accesos</h1>
                <p className="mt-3 text-sm leading-relaxed text-[#a5bcc8] md:text-base">
                  Define roles base, scopes y permisos para controlar el acceso a la información y las acciones en Performia.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Lugar principal para permisos y scopes
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs font-medium text-[#d6e2e8]">
                    Gobierno de acceso
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("matrix")}
                className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
              >
                Ver guía
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="text-sm text-[#8fa8b6]">Roles base</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.rolesCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="text-sm text-[#8fa8b6]">Asignaciones activas</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.activeAssignments}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="text-sm text-[#8fa8b6]">Usuarios del ejemplo</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.customExampleUsers}</p>
              </div>
            </div>
          </section>

          <section className="pf-card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Roles base</h2>
                <p className="mt-1 text-sm text-[#95aebc]">
                  Cada tarjeta resume un rol base y la cantidad de usuarios asignados.
                </p>
              </div>
              {!canManageAssignments ? (
                <IconBadge tone="info">Vista solo lectura</IconBadge>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {presets.map((preset) => {
                const count = (assignmentGroups[preset.roleKey] || []).length;
                const highlights = summarizeCapabilities(preset);
                return (
                  <article key={preset.roleKey} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                    <div className="flex items-start gap-4">
                      <RoleIcon roleKey={preset.roleKey} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold text-white">{preset.roleKey}</h3>
                          <span className="rounded-full border border-white/10 bg-[#132530] px-3 py-1 text-xs text-[#d6e2e8]">
                            {count} usuarios
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#c7d6de]">{preset.description || preset.label}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {normalizeList(preset.allowedScopes)
                            .filter((scope) => ["ORGANIZATION", "DEPARTMENT", "TEAM", "SELF"].includes(scope))
                            .map((scope) => (
                              <IconBadge key={scope} tone={scope === "SELF" ? "success" : "default"}>
                                {scope}
                              </IconBadge>
                            ))}
                        </div>
                        {highlights.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {highlights.map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-white/10 bg-[#132530] px-3 py-1 text-xs text-[#9fb6c4]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="pf-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Scopes / alcance</h2>
                <p className="mt-1 text-sm text-[#95aebc]">roleKey + scope = acceso efectivo.</p>
              </div>
              <IconBadge>Orientativo para cliente</IconBadge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleScopeCards.map((scope) => (
                <article key={scope} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-4">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#86e0a9]">{scope}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#d6e2e8]">{SCOPE_LABELS[scope]}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="pf-card overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 pt-4">
              {PAGE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-t-2xl px-4 py-3 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "border-b-2 border-[#2f64ff] text-[#7ea3ff]"
                      : "text-[#9db2be] hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                {(activeTab === "builder" || activeTab === "base") && (
                  <section className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">Rol personalizado: Coordinador Academico</h3>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#132530] px-3 py-2 text-xs text-[#d6e2e8]"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <IconBadge tone="info">Base: MANAGER</IconBadge>
                          <IconBadge tone="info">Scope: DEPARTMENT</IconBadge>
                          <IconBadge>Área: Académico</IconBadge>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Activo
                        </span>
                        <button type="button" className="rounded-xl border border-white/10 bg-[#132530] px-3 py-2 text-xs text-[#d6e2e8]">
                          Duplicar rol
                        </button>
                        <button type="button" className="rounded-xl border border-white/10 bg-[#132530] px-3 py-2 text-xs text-[#d6e2e8]">
                          Mas
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
                      <article className="rounded-2xl border border-white/10 bg-[#122530] p-4">
                        <p className="text-sm font-semibold text-white">Puede hacer</p>
                        <ul className="mt-3 space-y-2 text-sm text-[#d5e2e9]">
                          <li>- Gestionar objetivos e indicadores del área</li>
                          <li>- Iniciar y dar seguimiento a evaluaciones del área</li>
                          <li>- Ver reportes del área</li>
                          <li>- Gestionar desarrollo del equipo</li>
                        </ul>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#122530] p-4">
                        <p className="text-sm font-semibold text-white">No puede hacer</p>
                        <ul className="mt-3 space-y-2 text-sm text-[#d5e2e9]">
                          <li>- Modificar configuración de la organización</li>
                          <li>- Ver información de otras áreas o departamentos</li>
                          <li>- Gestionar roles y permisos</li>
                          <li>- Eliminar información histórica</li>
                        </ul>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-[#122530] p-4">
                        <p className="text-sm font-semibold text-white">Sobre los roles y permisos</p>
                        <p className="mt-3 text-sm leading-relaxed text-[#9db2be]">
                          La matriz es orientativa. La autorización real siempre la valida el backend según el scope y la organización activa.
                        </p>
                      </article>
                    </div>
                  </section>
                )}

                {(activeTab === "matrix" || activeTab === "builder") && (
                  <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Matriz de permisos</h3>
                          <p className="mt-1 text-sm text-[#95aebc]">
                            Vista simple para explicar que puede hacer cada rol.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(STATE_META).map(([key, meta]) => (
                            <span
                              key={key}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${meta.className}`}
                            >
                              <MatrixMark stateKey={key} />
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 overflow-x-auto">
                        <table className="min-w-[920px] border-separate border-spacing-y-2 text-sm">
                          <thead>
                            <tr className="text-left text-[#97adba]">
                              <th className="px-3 py-2">Modulo</th>
                              {MATRIX_COLUMNS.map((column) => (
                                <th key={column.key} className="px-3 py-2">
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {MATRIX_ROWS.map((row) => (
                              <tr key={row.label}>
                                <td className="rounded-l-2xl border border-white/10 bg-[#122530] px-3 py-3 font-medium text-white">
                                  {row.label}
                                </td>
                                {MATRIX_COLUMNS.map((column, index) => (
                                  <td
                                    key={column.key}
                                    className={`border border-white/10 bg-[#122530] px-3 py-3 text-center ${
                                      index === MATRIX_COLUMNS.length - 1 ? "rounded-r-2xl" : ""
                                    }`}
                                  >
                                    <MatrixMark stateKey={row.values[column.key]} />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>

                    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Asignaciones activas</h3>
                          <p className="mt-1 text-sm text-[#95aebc]">
                            Resumen de usuarios con rol asignado y su alcance actual.
                          </p>
                        </div>
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                          placeholder="Buscar usuario o scope"
                        />
                      </div>

                      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                        <table className="min-w-full text-sm">
                          <thead className="bg-[#132530] text-left text-[#97adba]">
                            <tr>
                              <th className="px-4 py-3">Usuario</th>
                              <th className="px-4 py-3">Scope</th>
                              <th className="px-4 py-3">Área / Departamento</th>
                              <th className="px-4 py-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 bg-[#0f1f28]">
                            {filteredAssignments.slice(0, 5).map((item) => (
                              <tr key={item._id} className="text-[#d7e2e8]">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-white">{getUserLabel(item.userId)}</p>
                                    <p className="text-xs text-[#8ea5b3]">{getUserEmail(item.userId) || "Sin email"}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">{getScopeLabel(item.scope)}</td>
                                <td className="px-4 py-3">{buildScopeDescription(item)}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                      item.active !== false
                                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                                        : "border-white/10 bg-[#122530] text-[#9eb3bf]"
                                    }`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        item.active !== false ? "bg-emerald-400" : "bg-[#8ca2af]"
                                      }`}
                                    />
                                    {item.active !== false ? "Activo" : "Inactivo"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {!filteredAssignments.length ? (
                              <tr>
                                <td colSpan="4" className="px-4 py-6 text-center text-sm text-[#95aebc]">
                                  No hay asignaciones para mostrar con los filtros actuales.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm">
                        <button
                          type="button"
                          onClick={() => setActiveTab("assignments")}
                          className="text-[#7ea3ff] hover:text-white"
                        >
                          Ver todas las asignaciones
                        </button>
                        <span className="text-[#8ea5b3]">
                          {Math.min(filteredAssignments.length, 5)} de {filteredAssignments.length}
                        </span>
                      </div>
                    </article>
                  </section>
                )}

                {activeTab === "assignments" && (
                  <section className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Todas las asignaciones</h3>
                        <p className="mt-1 text-sm text-[#95aebc]">
                          Panel operativo de lectura y edición de asignaciones activas.
                        </p>
                      </div>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                        placeholder="Buscar usuario, rol o alcance"
                      />
                    </div>

                    <div className="mt-5 space-y-3">
                      {canReadAssignments ? (
                        <CollapsibleList
                          items={filteredAssignments}
                          initialCount={3}
                          buttonLabelMore={`Ver más (${filteredAssignments.length - 3})`}
                          renderItem={(item) => {
                            const preset = presetMap.get(item.roleKey);
                            return (
                              <article key={item._id} className="rounded-2xl border border-white/10 bg-[#122530] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-white">{getUserLabel(item.userId)}</p>
                                    <p className="text-sm text-[#9fb6c4]">
                                      {(preset?.label || item.roleKey) + " - " + getScopeLabel(item.scope)}
                                    </p>
                                    <p className="mt-1 text-xs text-[#7f97a5]">
                                      {getUserEmail(item.userId) || "Sin email"} - {buildScopeDescription(item)}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span
                                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                                        item.active !== false
                                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                                          : "border-white/10 bg-[#0f1f28] text-[#9eb3bf]"
                                      }`}
                                    >
                                      {item.active !== false ? "Activa" : "Inactiva"}
                                    </span>
                                    {canManageAssignments ? (
                                      <button
                                        type="button"
                                        onClick={() => startEdit(item)}
                                        className="rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100"
                                      >
                                        Editar
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            );
                          }}
                        />
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-5 text-sm text-[#95aebc]">
                          No hay permisos de lectura para ver asignaciones detalladas.
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>

              <aside
                className={`rounded-3xl border border-white/10 bg-[#0f1f28] p-5 ${drawerOpen ? "block" : "hidden xl:block"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{editingId ? "Editar asignación" : "Asignar rol"}</h3>
                    <p className="mt-2 text-sm text-[#95aebc]">
                      El backend valida nuevamente rol, scope y organización activa antes de guardar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl border border-white/10 bg-[#122530] px-3 py-2 text-sm text-[#d6e2e8] xl:hidden"
                  >
                    Cerrar
                  </button>
                </div>

                {canManageAssignments ? (
                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Usuario</span>
                      <select
                        value={form.userId}
                        onChange={(event) => setField("userId", event.target.value)}
                        disabled={Boolean(editingId)}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                      >
                        <option value="">Buscar usuario...</option>
                        {users.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.nombre} - {item.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Rol base</span>
                      <select
                        value={form.roleKey}
                        onChange={(event) => setField("roleKey", event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                      >
                        {presets.map((preset) => (
                          <option key={preset.roleKey} value={preset.roleKey}>
                            {preset.roleKey}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Scope (alcance)</span>
                      <select
                        value={form.scope}
                        onChange={(event) => setField("scope", event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                      >
                        {availableScopes.map((scope) => (
                          <option key={scope} value={scope}>
                            {scope}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Área / Departamento</span>
                      <input
                        value={form.scope === "DEPARTMENT" || form.scope === "TEAM" ? form.scopeReference : ""}
                        onChange={(event) => setField("scopeReference", event.target.value)}
                        placeholder={form.scope === "TEAM" ? "Seleccionar equipo..." : "Ej: Academico"}
                        disabled={form.scope !== "DEPARTMENT" && form.scope !== "TEAM"}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white disabled:opacity-50"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Equipo (opcional)</span>
                      <input
                        value={form.scope === "TEAM" ? form.scopeReference : ""}
                        onChange={(event) => setField("scopeReference", event.target.value)}
                        placeholder="Seleccionar equipo..."
                        disabled={form.scope !== "TEAM"}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white disabled:opacity-50"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Estado</span>
                      <select
                        value={form.active ? "active" : "inactive"}
                        onChange={(event) => setField("active", event.target.value === "active")}
                        className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm text-[#d6e2e8]">Fecha de inicio</span>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(event) => setField("startDate", event.target.value)}
                          className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm text-[#d6e2e8]">Fecha de fin</span>
                        <input
                          type="date"
                          value={form.endDate}
                          onChange={(event) => setField("endDate", event.target.value)}
                          className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#d6e2e8]">Notas</span>
                      <textarea
                        value={form.notes}
                        onChange={(event) => setField("notes", event.target.value)}
                        className="min-h-28 w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm text-white"
                        placeholder="Contexto de la asignación, observaciones o vigencia."
                      />
                    </label>

                    <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                      El usuario recibirá permisos según el rol seleccionado y el alcance definido. Fechas y notas quedan por ahora como apoyo visual en esta UI.
                    </div>

                    <div className="flex gap-3">
                      <button type="button" onClick={resetForm} className="flex-1 rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-[#d6e2e8]">
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || loading}
                        className="flex-1 rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Asignar rol"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#122530] p-4 text-sm text-[#95aebc]">
                    Si el usuario actual no puede asignar roles, esta acción queda oculta o en solo lectura. La autorización final sigue en backend.
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>


      </section>

      {loading ? (
        <section className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-5 text-sm text-[#9fb6c4]">
          Cargando roles y accesos...
        </section>
      ) : null}

      {message ? (
        <p
          className={
            messageType === "error"
              ? "pf-alert-error"
              : messageType === "success"
                ? "pf-alert-success"
                : messageType === "warning"
                  ? "pf-alert-warning"
                  : "pf-alert-info"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
