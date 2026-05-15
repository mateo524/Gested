import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const ROLE_ORDER = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "HR",
  "MANAGER",
  "EMPLOYEE",
  "VIEWER",
  "AUDITOR",
];

const SCOPE_ORDER = [
  "ORGANIZATION",
  "REGION_COUNTRY",
  "BUSINESS_UNIT",
  "DEPARTMENT",
  "TEAM",
  "SELF",
];

const SCOPE_LABELS = {
  ORGANIZATION: "Organizacion",
  REGION_COUNTRY: "Region / pais",
  BUSINESS_UNIT: "Unidad de negocio",
  DEPARTMENT: "Departamento",
  TEAM: "Equipo",
  SELF: "Solo la persona",
};

const PERMISSION_LABELS = {
  manage_schools: "Gestionar organizacion",
  manage_users: "Gestionar usuarios y roles",
  manage_roles: "Gestionar usuarios y roles",
  manage_school_users: "Gestionar usuarios y roles",
  manage_employees: "Ver todos los empleados",
  manage_evaluations: "Crear y editar evaluaciones",
  evaluate_team: "Evaluar empleados",
  self_evaluate: "Evaluaciones propias",
  view_reports: "Ver reportes",
  download_reports: "Exportar informacion",
  download_team_reports: "Exportar informacion",
  download_self_report: "Exportar informacion",
  manage_settings: "Configuracion",
  view_audit: "Auditoria y logs",
  read_only_access: "Solo lectura",
};

const MATRIX_COLUMNS = [
  { key: "ORG_ADMIN", label: "ORG_ADMIN" },
  { key: "HR", label: "HR" },
  { key: "MANAGER", label: "MANAGER" },
  { key: "EMPLOYEE", label: "EMPLOYEE" },
  { key: "VIEWER_AUDITOR", label: "VIEWER / AUDITOR" },
];

const MATRIX_ROWS = [
  {
    label: "Gestionar organizacion",
    values: {
      ORG_ADMIN: "full",
      HR: "none",
      MANAGER: "none",
      EMPLOYEE: "na",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Gestionar usuarios y roles",
    values: {
      ORG_ADMIN: "full",
      HR: "partial",
      MANAGER: "none",
      EMPLOYEE: "na",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Ver todos los empleados",
    values: {
      ORG_ADMIN: "full",
      HR: "full",
      MANAGER: "partial",
      EMPLOYEE: "none",
      VIEWER_AUDITOR: "partial",
    },
  },
  {
    label: "Crear / editar evaluaciones",
    values: {
      ORG_ADMIN: "full",
      HR: "full",
      MANAGER: "partial",
      EMPLOYEE: "none",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Evaluar empleados",
    values: {
      ORG_ADMIN: "partial",
      HR: "partial",
      MANAGER: "full",
      EMPLOYEE: "partial",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Ver reportes",
    values: {
      ORG_ADMIN: "full",
      HR: "full",
      MANAGER: "partial",
      EMPLOYEE: "partial",
      VIEWER_AUDITOR: "full",
    },
  },
  {
    label: "Exportar informacion",
    values: {
      ORG_ADMIN: "full",
      HR: "partial",
      MANAGER: "partial",
      EMPLOYEE: "partial",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Configuracion",
    values: {
      ORG_ADMIN: "full",
      HR: "none",
      MANAGER: "none",
      EMPLOYEE: "na",
      VIEWER_AUDITOR: "none",
    },
  },
  {
    label: "Auditoria / logs",
    values: {
      ORG_ADMIN: "partial",
      HR: "none",
      MANAGER: "none",
      EMPLOYEE: "na",
      VIEWER_AUDITOR: "full",
    },
  },
];

const STATE_META = {
  full: {
    label: "Completo",
    dot: "bg-emerald-400",
    cell: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  },
  partial: {
    label: "Parcial / limitado",
    dot: "bg-amber-300",
    cell: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  },
  none: {
    label: "Sin acceso",
    dot: "bg-rose-300",
    cell: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  },
  na: {
    label: "No aplica",
    dot: "bg-slate-400",
    cell: "border-white/10 bg-[#0f1f28] text-[#8ea2af]",
  },
};

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

function buildScopeDescription(item) {
  const base = SCOPE_LABELS[item.scope] || item.scope;
  if (item.scope === "DEPARTMENT" && item.departmentCode) {
    return `${base}: ${item.departmentCode}`;
  }
  if (item.scope === "TEAM" && item.teamId) {
    return `${base}: ${item.teamId}`;
  }
  return base;
}

function buildStatusTone(active) {
  return active
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
    : "border-white/10 bg-[#0f1f28] text-[#9fb6c4]";
}

function summarizeCapabilities(preset) {
  const labels = Array.from(
    new Set(
      (preset.defaultPermissions || [])
        .map((permission) => PERMISSION_LABELS[permission])
        .filter(Boolean)
    )
  );
  return labels.slice(0, 4);
}

function sortPresets(presets) {
  const orderMap = new Map(ROLE_ORDER.map((roleKey, index) => [roleKey, index]));
  return [...presets].sort((left, right) => {
    return (orderMap.get(left.roleKey) ?? 999) - (orderMap.get(right.roleKey) ?? 999);
  });
}

export default function RolesPage() {
  const { token, hasPermission } = useAuth();
  const [presets, setPresets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    userId: "",
    roleKey: "ORG_ADMIN",
    scope: "ORGANIZATION",
    scopeReference: "",
    active: true,
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

  const assignmentGroups = useMemo(() => {
    return assignments.reduce((acc, item) => {
      const current = acc[item.roleKey] || [];
      current.push(item);
      acc[item.roleKey] = current;
      return acc;
    }, {});
  }, [assignments]);

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
  const availableScopes = useMemo(() => selectedPreset?.allowedScopes || [], [selectedPreset]);

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
    });
  }

  function startEdit(assignment) {
    setEditingId(assignment._id);
    setForm({
      userId:
        typeof assignment.userId === "object" && assignment.userId?._id
          ? assignment.userId._id
          : assignment.userId || "",
      roleKey: assignment.roleKey,
      scope: assignment.scope,
      scopeReference:
        assignment.scope === "DEPARTMENT"
          ? assignment.departmentCode || ""
          : assignment.scope === "TEAM"
            ? assignment.teamId || ""
            : "",
      active: assignment.active !== false,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.userId || !form.roleKey || !form.scope) {
      setMessageType("warning");
      setMessage("Completá usuario, rol base y alcance.");
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

    if ((form.scope === "DEPARTMENT" || form.scope === "TEAM") && !form.scopeReference.trim()) {
      setMessageType("warning");
      setMessage("Completá la referencia del alcance antes de guardar.");
      return;
    }

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
      setMessage(editingId ? "Asignacion actualizada." : "Asignacion creada.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    return {
      totalPresets: presets.length,
      activeAssignments: assignments.filter((item) => item.active !== false).length,
      readOnlyRoles: presets.filter((item) => ["VIEWER", "AUDITOR"].includes(item.roleKey)).length,
    };
  }, [assignments, presets]);

  const hierarchyCards = useMemo(
    () => [
      {
        title: "Plataforma global",
        description: "Performia separa la administracion global de la operacion diaria de cada cliente.",
        tags: ["SUPER_ADMIN solo plataforma", "No configurable por clientes"],
      },
      {
        title: "Organizacion / colegio / empresa",
        description: "Cada organizacion administra solo sus personas, procesos y reportes.",
        tags: ["Aislamiento por organizacion", "Sin fuga multi-tenant"],
      },
      {
        title: "Jerarquias internas",
        description: "Cada rol combina una funcion base y un alcance: organizacion, departamento, equipo o self.",
        tags: ["roleKey + scope", "Mas simple para cliente"],
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Configuracion &gt; Roles y accesos</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Roles y Accesos</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Los roles definen qué puede ver y hacer cada persona dentro de su organización.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Roles base</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.totalPresets}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Asignaciones activas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.activeAssignments}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Roles de solo lectura</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.readOnlyRoles}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {hierarchyCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-white/10 bg-[#122530] p-5">
            <h4 className="text-lg font-semibold text-white">{card.title}</h4>
            <p className="mt-2 text-sm text-[#9fb6c4]">{card.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#d8e4ea]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-semibold text-white">Roles base por funcion</h4>
            <p className="mt-1 text-sm text-[#9fb6c4]">
              Estos son los perfiles base que despues se combinan con un nivel de acceso.
            </p>
          </div>
          {!canManageAssignments ? (
            <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
              Vista de lectura
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {presets.map((preset) => {
            const assignmentsForRole = assignmentGroups[preset.roleKey] || [];
            const highlights = summarizeCapabilities(preset);
            return (
              <article key={preset.roleKey} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="text-lg font-semibold text-white">{preset.roleKey}</h5>
                    <p className="mt-1 text-sm text-[#9fb6c4]">{preset.label}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#c5d5de]">
                    {assignmentsForRole.length} usuarios
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#c8d8df]">{preset.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(preset.allowedScopes || []).map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-[#22c55e]/30 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]"
                    >
                      {SCOPE_LABELS[scope] || scope}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {highlights.map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-[#122530] px-3 py-2 text-sm text-[#d8e4ea]">
                      {item}
                    </div>
                  ))}
                </div>

                <details className="mt-4 rounded-2xl border border-white/10 bg-[#122530] p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[#d8e4ea]">
                    Ver limites y detalle avanzado
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-white">No puede</p>
                      <ul className="mt-2 space-y-1 text-sm text-[#9fb6c4]">
                        {(preset.cannot || []).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-3 text-xs text-[#9fb6c4]">
                      Permisos tecnicos: {(preset.defaultPermissions || []).join(", ")}
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h4 className="text-xl font-semibold text-white">Niveles de acceso</h4>
        <p className="mt-1 text-sm text-[#9fb6c4]">
          El mismo rol puede tener distinto alcance segun la estructura de la organizacion.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SCOPE_ORDER.map((scope) => (
            <article key={scope} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm text-[#8be6ac]">{scope}</p>
              <p className="mt-2 text-base font-semibold text-white">{SCOPE_LABELS[scope]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h4 className="text-xl font-semibold text-white">Matriz general de permisos</h4>
            <p className="mt-1 text-sm text-[#9fb6c4]">
              Lectura rapida para entender el alcance esperado de cada rol base.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATE_META).map(([key, meta]) => (
              <span
                key={key}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0f1f28] px-3 py-1 text-xs text-[#d8e4ea]"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[#9fb6c4]">
                <th className="px-3 py-2">Permiso general</th>
                {MATRIX_COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-2 whitespace-nowrap">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="rounded-l-2xl border border-white/10 bg-[#0f1f28] px-3 py-3 text-white">
                    {row.label}
                  </td>
                  {MATRIX_COLUMNS.map((column, index) => {
                    const state = STATE_META[row.values[column.key]];
                    return (
                      <td
                        key={column.key}
                        className={`border px-3 py-3 text-center text-xs ${state.cell} ${
                          index === MATRIX_COLUMNS.length - 1 ? "rounded-r-2xl" : ""
                        }`}
                      >
                        {state.label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h4 className="text-xl font-semibold text-white">Ejemplo de composicion de un rol</h4>
          <p className="mt-1 text-sm text-[#9fb6c4]">
            Un mismo puesto se arma combinando rol base y alcance.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                Rol: Coordinador Academico
              </span>
              <span className="rounded-full border border-[#22c55e]/30 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">
                Base: MANAGER
              </span>
              <span className="rounded-full border border-[#22c55e]/30 bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">
                Scope: DEPARTMENT o TEAM
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-white">Puede</p>
                <ul className="mt-2 space-y-2 text-sm text-[#c8d8df]">
                  <li>- Ver docentes de su area</li>
                  <li>- Evaluar docentes de su area</li>
                  <li>- Ver reportes de su area</li>
                  <li>- Editar evaluaciones si tiene permiso</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-white">No puede</p>
                <ul className="mt-2 space-y-2 text-sm text-[#9fb6c4]">
                  <li>- Ver toda la institucion</li>
                  <li>- Gestionar usuarios</li>
                  <li>- Exportar informacion global</li>
                  <li>- Configurar plataforma</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold text-white">Usuarios asignados</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">
                Estado actual de roles y accesos dentro de la organizacion.
              </p>
            </div>
            <input
              className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
              placeholder="Buscar usuario, rol o alcance"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-5 space-y-3">
            {canReadAssignments ? (
              filteredAssignments.length ? (
                filteredAssignments.map((item) => {
                  const preset = presetMap.get(item.roleKey);
                  return (
                    <article key={item._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{getUserLabel(item.userId)}</p>
                          <p className="text-sm text-[#9fb6c4]">
                            {getUserEmail(item.userId) || "Sin email"} · {preset?.label || item.roleKey}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs ${buildStatusTone(item.active !== false)}`}>
                            {item.active !== false ? "Activa" : "Inactiva"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#c5d5de]">
                            {buildScopeDescription(item)}
                          </span>
                          {canManageAssignments ? (
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-full border border-[#22c55e]/40 px-3 py-1 text-xs text-[#8be6ac]"
                            >
                              Editar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-5 text-sm text-[#9fb6c4]">
                  No hay asignaciones para mostrar con los filtros actuales.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-5 text-sm text-[#9fb6c4]">
                No hay permisos de lectura para ver asignaciones detalladas.
              </div>
            )}
          </div>
        </section>
      </section>

      {canManageAssignments ? (
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold text-white">
                {editingId ? "Editar asignacion" : "Asignar rol y alcance"}
              </h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">
                El backend sigue validando el acceso real. Esta pantalla solo facilita la administracion.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/15 px-3 py-2 text-sm text-[#c5d5de]"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-[#c5d5de]">Usuario</span>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.userId}
                onChange={(event) => setField("userId", event.target.value)}
                disabled={Boolean(editingId)}
              >
                <option value="">Seleccionar usuario</option>
                {users.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nombre} - {item.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#c5d5de]">Rol base</span>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.roleKey}
                onChange={(event) => setField("roleKey", event.target.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.roleKey} value={preset.roleKey}>
                    {preset.roleKey} - {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#c5d5de]">Nivel de acceso</span>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.scope}
                onChange={(event) => setField("scope", event.target.value)}
              >
                {availableScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope} - {SCOPE_LABELS[scope] || scope}
                  </option>
                ))}
              </select>
            </label>

            {form.scope === "DEPARTMENT" || form.scope === "TEAM" ? (
              <label className="block">
                <span className="mb-2 block text-sm text-[#c5d5de]">
                  {form.scope === "DEPARTMENT" ? "Referencia de departamento" : "Referencia de equipo"}
                </span>
                <input
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  placeholder={form.scope === "DEPARTMENT" ? "Ej: SECUNDARIA" : "Ej: equipo-docente"}
                  value={form.scopeReference}
                  onChange={(event) => setField("scopeReference", event.target.value)}
                />
              </label>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#d8e4ea] lg:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setField("active", event.target.checked)}
              />
              Mantener esta asignacion activa
            </label>

            <button
              type="submit"
              disabled={submitting || loading}
              className="pf-button-primary lg:col-span-2 text-sm disabled:opacity-60"
            >
              {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Asignar rol"}
            </button>
          </form>
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 text-sm text-[#9fb6c4]">
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
