import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const SCOPE_ORDER = [
  "ORGANIZATION",
  "REGION_COUNTRY",
  "BUSINESS_UNIT",
  "DEPARTMENT",
  "TEAM",
  "SELF",
];

const SCOPE_LABELS = {
  ORGANIZATION: "Toda la organización",
  REGION_COUNTRY: "Región o país",
  BUSINESS_UNIT: "Unidad de negocio",
  DEPARTMENT: "Departamento",
  TEAM: "Equipo",
  SELF: "Solo la persona",
};

const PERMISSION_LABELS = {
  manage_schools: "Gestiona la organización",
  manage_users: "Administra accesos",
  manage_roles: "Administra perfiles",
  manage_school_users: "Gestiona usuarios internos",
  manage_employees: "Gestiona personas",
  manage_competencies: "Gestiona competencias",
  manage_metrics: "Gestiona KPIs y métricas",
  manage_evaluation_cycles: "Gestiona períodos",
  manage_evaluations: "Gestiona evaluaciones",
  manage_development_plans: "Gestiona planes de desarrollo",
  manage_settings: "Gestiona configuración",
  view_reports: "Consulta reportes",
  download_reports: "Descarga reportes",
  download_team_reports: "Descarga reportes del equipo",
  download_self_report: "Descarga su propio reporte",
  evaluate_team: "Evalúa su equipo",
  self_evaluate: "Realiza autoevaluación",
  view_self_profile: "Ve su propia ficha",
  view_team: "Ve su equipo",
  read_only_access: "Consulta sin editar",
  view_audit: "Consulta auditoría",
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
      setPresets(normalizeList(presetData?.presets));
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

  const presetMap = useMemo(
    () => new Map(presets.map((preset) => [preset.roleKey, preset])),
    [presets]
  );

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
  const availableScopes = useMemo(
    () => selectedPreset?.allowedScopes || [],
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
      setMessage("Completá usuario, perfil y alcance.");
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
      setMessage(editingId ? "Asignación actualizada." : "Asignación creada.");
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Gobernanza de accesos</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Perfiles simples, alcance claro</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Cada usuario combina un perfil y un alcance. El backend sigue siendo quien decide el acceso final
          y nunca permite cruzar organizaciones.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Perfiles disponibles</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.totalPresets}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Asignaciones activas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.activeAssignments}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm text-[#9fb6c4]">Perfiles solo lectura</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.readOnlyRoles}</p>
          </div>
        </div>
      </section>

      {!canManageAssignments ? (
        <section className="rounded-[2rem] border border-blue-300/20 bg-blue-500/10 p-5 text-sm text-blue-100">
          Estás viendo esta matriz en modo lectura. Podés revisar perfiles, alcances y usuarios asignados, pero
          no cambiar accesos.
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="text-xl font-semibold text-white">Matriz visual</h4>
            <p className="mt-1 text-sm text-[#9fb6c4]">
              Qué alcance admite cada perfil dentro de una organización cliente.
            </p>
          </div>
          <input
            className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
            placeholder="Buscar por usuario, perfil o alcance"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[#9fb6c4]">
                <th className="px-3 py-2">Perfil</th>
                {SCOPE_ORDER.map((scope) => (
                  <th key={scope} className="px-3 py-2 whitespace-nowrap">
                    {SCOPE_LABELS[scope]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => (
                <tr key={preset.roleKey}>
                  <td className="rounded-l-2xl border border-white/10 bg-[#0f1f28] px-3 py-3 text-white">
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-[#9fb6c4]">{preset.roleKey}</div>
                  </td>
                  {SCOPE_ORDER.map((scope, index) => {
                    const enabled = preset.allowedScopes?.includes(scope);
                    const radiusClass = index === SCOPE_ORDER.length - 1 ? "rounded-r-2xl" : "";
                    return (
                      <td
                        key={scope}
                        className={`border border-white/10 bg-[#0f1f28] px-3 py-3 text-center ${radiusClass}`}
                      >
                        <span
                          className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs ${
                            enabled
                              ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                              : "border border-white/10 bg-[#122530] text-[#607d8b]"
                          }`}
                        >
                          {enabled ? "Sí" : "No"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
            <h4 className="text-xl font-semibold text-white">Perfiles disponibles</h4>
            <p className="mt-1 text-sm text-[#9fb6c4]">
              Cada tarjeta resume el alcance, lo que puede hacer y sus límites.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {presets.map((preset) => {
                const assignmentsForRole = assignmentGroups[preset.roleKey] || [];
                return (
                  <article key={preset.roleKey} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-lg font-semibold text-white">{preset.label}</h5>
                        <p className="mt-1 text-sm text-[#9fb6c4]">{preset.description}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#c5d5de]">
                        {assignmentsForRole.length} asignados
                      </span>
                    </div>

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

                    <div className="mt-4">
                      <p className="text-sm font-medium text-white">Qué puede hacer</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(preset.defaultPermissions || []).map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full border border-white/10 bg-[#122530] px-2.5 py-1 text-xs text-[#d8e4ea]"
                          >
                            {PERMISSION_LABELS[permission] || permission}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-white">Qué no puede hacer</p>
                      <ul className="mt-2 space-y-1 text-sm text-[#9fb6c4]">
                        {(preset.cannot || []).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>

                    <details className="mt-4 rounded-2xl border border-white/10 bg-[#122530] p-3">
                      <summary className="cursor-pointer text-sm font-medium text-[#d8e4ea]">
                        Ver usuarios asignados y detalle técnico
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="space-y-2">
                          {assignmentsForRole.length ? (
                            assignmentsForRole.slice(0, 4).map((item) => (
                              <div
                                key={item._id}
                                className="rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-2 text-sm text-[#d8e4ea]"
                              >
                                <div className="font-medium">{getUserLabel(item.userId)}</div>
                                <div className="text-xs text-[#9fb6c4]">
                                  {getUserEmail(item.userId)} · {buildScopeDescription(item)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#9fb6c4]">Todavía no hay usuarios asignados a este perfil.</p>
                          )}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-3 text-xs text-[#9fb6c4]">
                          RoleKey: {preset.roleKey}
                          <br />
                          Permisos técnicos: {(preset.defaultPermissions || []).join(", ")}
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>

          {canReadAssignments ? (
            <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
              <h4 className="text-xl font-semibold text-white">Usuarios asignados</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">
                Vista actual de perfiles activos por organización.
              </p>

              <div className="mt-5 space-y-3">
                {filteredAssignments.length ? (
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
                )}
              </div>
            </section>
          ) : null}
        </div>

        {canManageAssignments ? (
          <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xl font-semibold text-white">
                  {editingId ? "Editar asignación" : "Nueva asignación"}
                </h4>
                <p className="mt-1 text-sm text-[#9fb6c4]">
                  Elegí usuario, perfil y alcance. El backend valida el límite real por tenant.
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

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
                <span className="mb-2 block text-sm text-[#c5d5de]">Perfil</span>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={form.roleKey}
                  onChange={(event) => setField("roleKey", event.target.value)}
                >
                  {presets.map((preset) => (
                    <option key={preset.roleKey} value={preset.roleKey}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[#c5d5de]">Alcance</span>
                <select
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={form.scope}
                  onChange={(event) => setField("scope", event.target.value)}
                >
                  {availableScopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {SCOPE_LABELS[scope] || scope}
                    </option>
                  ))}
                </select>
              </label>

              {form.scope === "DEPARTMENT" || form.scope === "TEAM" ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-[#c5d5de]">
                    {form.scope === "DEPARTMENT" ? "Código de departamento" : "Identificador de equipo"}
                  </span>
                  <input
                    className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                    placeholder={form.scope === "DEPARTMENT" ? "Ej: SECUNDARIA" : "Ej: equipo-comercial"}
                    value={form.scopeReference}
                    onChange={(event) => setField("scopeReference", event.target.value)}
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-sm text-[#d8e4ea]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setField("active", event.target.checked)}
                />
                Mantener esta asignación activa
              </label>

              <button
                type="submit"
                disabled={submitting || loading}
                className="pf-button-primary w-full text-sm disabled:opacity-60"
              >
                {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Asignar perfil"}
              </button>
            </form>
          </section>
        ) : null}
      </section>

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 text-sm text-[#9fb6c4]">
          Cargando perfiles y asignaciones...
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

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 text-sm text-[#9fb6c4]">
        <p className="font-medium text-white">Matriz resultante</p>
        <p className="mt-2">
          ORG_OWNER y ORG_ADMIN administran su organización. HR gestiona personas dentro del alcance asignado.
          MANAGER trabaja por equipo o departamento. EMPLOYEE queda en autoservicio. VIEWER y AUDITOR son
          solo lectura.
        </p>
      </section>
    </div>
  );
}
