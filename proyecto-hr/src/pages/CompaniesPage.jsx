import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { CompanyModulesModal } from "../components/CompanyModulesModal";

const emptyCompany = {
  nombre: "",
  slug: "",
  tipoCliente: "general",
  schoolName: "",
  adminNombre: "",
  adminEmail: "",
  adminPassword: "",
  createAdmin: true,
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-[#9fb6c4]">
      <svg className="mr-3 h-5 w-5 animate-spin text-[#14b8a6]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-sm">Cargando empresas...</span>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <svg className="h-8 w-8 text-rose-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-sm text-rose-400">No se pudieron cargar las empresas.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#9fb6c4] hover:bg-white/[0.07] transition"
      >
        Reintentar
      </button>
    </div>
  );
}

export default function CompaniesPage() {
  const { token, refreshCompanies } = useAuth();
  const { addToast } = useToast();
  const [modulesTarget, setModulesTarget] = useState(null);
  const [planTarget, setPlanTarget] = useState(null);
  const [planForm, setPlanForm] = useState({ plan: "pro", planExpiresAt: "" });
  const [planSaving, setPlanSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyCompany);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [provisionedAccess, setProvisionedAccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [seedFile, setSeedFile] = useState(null);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmSingleDeactivateOpen, setConfirmSingleDeactivateOpen] = useState(false);
  const [singleTargetCompany, setSingleTargetCompany] = useState(null);
  const [isSingleConfirming, setIsSingleConfirming] = useState(false);
  // For the per-company toggle deactivation confirm dialog
  const [confirmToggleDeactivateOpen, setConfirmToggleDeactivateOpen] = useState(false);
  const [toggleTargetCompany, setToggleTargetCompany] = useState(null);
  const [isToggleConfirming, setIsToggleConfirming] = useState(false);

  function showMessage(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  function downloadInitialTemplate() {
    const csv = [
      "apellido,nombre,email,cargo,area,tipoEmpleado,rol,activo,password",
      "Perez,Ana,ana.perez@colegio.com,Docente,Matematica,DOCENTE,EMPLEADO,true,",
      "Gomez,Carlos,carlos.gomez@colegio.com,Coordinador,Secundaria,DIRECTIVO,JEFE,true,",
      "Lopez,Marina,marina.lopez@colegio.com,Directora,Direccion,DIRECTIVO,ADMIN_COLEGIO,true,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-estructura-inicial-zentor.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredCompanies = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return companies;

    return companies.filter((company) =>
      [company.nombre, company.slug, company.tipoCliente]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [companies, query]);

  const allVisibleSelected =
    filteredCompanies.length > 0 &&
    filteredCompanies.every((company) => selectedIds.includes(company._id));

  // Fix #1: `query` removed from dependency array — filtering is done client-side via filteredCompanies
  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await apiFetch("/companies", { token });
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      setIsError(true);
      showMessage(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  function toggleSelection(companyId) {
    setSelectedIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredCompanies.some((company) => company._id === id))
      );
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      filteredCompanies.forEach((company) => next.add(company._id));
      return [...next];
    });
  }

  async function runBulkAction(action) {
    if (!selectedIds.length) {
      showMessage("Selecciona al menos una empresa", "info");
      return;
    }

    if (action === "deactivate") {
      setConfirmDeactivateOpen(true);
      return;
    }

    try {
      const data = await apiFetch("/companies/bulk", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, companyIds: selectedIds }),
      });

      showMessage(data.mensaje, "success");
      setSelectedIds([]);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function confirmDeactivateCompanies() {
    try {
      setIsConfirming(true);
      const data = await apiFetch("/companies/bulk", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "deactivate", companyIds: selectedIds }),
      });

      showMessage(data.mensaje, "success");
      setSelectedIds([]);
      setConfirmDeactivateOpen(false);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      setProvisionedAccess(null);

      const payload = {
        ...form,
        slug: form.slug || slugify(form.nombre),
      };
      let data;

      if (seedFile) {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => body.append(key, value));
        body.append("file", seedFile);
        data = await apiFetch("/companies", {
          method: "POST",
          token,
          body,
        });
      } else {
        data = await apiFetch("/companies", {
          method: "POST",
          token,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      // Fix #6: clear adminPassword from state immediately after POST; never fall back to it
      setForm(emptyCompany);
      setSeedFile(null);
      setProvisionedAccess({
        empresa: data.company?.nombre,
        admin: data.adminUser?.nombre,
        email: data.adminUser?.email,
        // If the API doesn't return a temporaryPassword, tell the user to use the one they typed — but don't store/repeat it
        temporaryPassword: data.adminUser?.temporaryPassword || null,
        imported: data.imported || null,
      });
      showMessage("Empresa creada y acceso inicial generado.", "success");
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Fix #4: toggleCompany now only performs reactivation directly; deactivation goes through ConfirmDialog
  async function toggleCompany(company) {
    if (company.activa) {
      // Deactivating — require confirmation
      setToggleTargetCompany(company);
      setConfirmToggleDeactivateOpen(true);
      return;
    }
    // Reactivating — safe, no confirmation needed
    try {
      setMessage("");
      await apiFetch(`/companies/${company._id}`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activa: true }),
      });
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function confirmToggleDeactivate() {
    if (!toggleTargetCompany) return;
    try {
      setIsToggleConfirming(true);
      setMessage("");
      await apiFetch(`/companies/${toggleTargetCompany._id}`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activa: false }),
      });
      showMessage(`Acceso de "${toggleTargetCompany.nombre}" desactivado`, "success");
      setConfirmToggleDeactivateOpen(false);
      setToggleTargetCompany(null);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsToggleConfirming(false);
    }
  }

  function requestDeactivateCompany(company) {
    setSingleTargetCompany(company);
    setConfirmSingleDeactivateOpen(true);
  }

  async function confirmSingleDeactivate() {
    if (!singleTargetCompany) return;

    try {
      setIsSingleConfirming(true);
      setMessage("");
      await apiFetch(`/companies/${singleTargetCompany._id}`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activa: false }),
      });
      showMessage(`"${singleTargetCompany.nombre}" desactivada`, "success");
      setConfirmSingleDeactivateOpen(false);
      setSingleTargetCompany(null);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsSingleConfirming(false);
    }
  }

  const activeCount = companies.filter((company) => company.activa).length;

  // Fix #2: message styling based on messageType state, not string inspection
  const messageClass =
    messageType === "error"
      ? "border-rose-400/20 bg-rose-500/8 text-rose-400"
      : messageType === "success"
      ? "border-emerald-400/20 bg-emerald-500/8 text-emerald-400"
      : "border-[#14b8a6]/20 bg-[#14b8a6]/8 text-[#14b8a6]";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Alta de clientes</p>
        <h3 className="mt-3 text-2xl font-bold text-white">Crear empresa y acceso inicial</h3>
        <p className="mt-3 max-w-3xl text-sm text-[#9fb6c4]">
          ZENTOR puede dejar lista una empresa con su administrador inicial para que entre, vea
          solo su información y opere dentro del alcance asignado.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Empresas</p>
          <h3 className="mt-4 text-4xl font-bold text-white">{companies.length}</h3>
        </article>
        <article className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Activas</p>
          <h3 className="mt-4 text-4xl font-bold text-white">{activeCount}</h3>
        </article>
        <article className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Seleccionadas</p>
          <h3 className="mt-4 text-4xl font-bold text-white">{selectedIds.length}</h3>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
          <h4 className="text-2xl font-bold text-white">Nueva empresa</h4>
          <p className="mt-1 text-sm text-[#9fb6c4]">Completa los datos del cliente y deja provisionado su acceso.</p>

          {/* Fix #5: aria-label on all inputs */}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="cp-nombre" className="sr-only">Nombre de la empresa</label>
              <input
                id="cp-nombre"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Nombre de la empresa"
                aria-label="Nombre de la empresa"
                value={form.nombre}
                onChange={(event) =>
                  setForm({
                    ...form,
                    nombre: event.target.value,
                    slug: slugify(event.target.value),
                  })
                }
              />
            </div>
            <div>
              <label htmlFor="cp-slug" className="sr-only">Slug</label>
              <input
                id="cp-slug"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Slug"
                aria-label="Slug"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="cp-tipo" className="sr-only">Tipo de cliente</label>
              <select
                id="cp-tipo"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                aria-label="Tipo de cliente"
                value={form.tipoCliente}
                onChange={(event) => setForm({ ...form, tipoCliente: event.target.value })}
              >
                <option value="general">General</option>
                <option value="educacion">Educacion</option>
                <option value="salud">Salud</option>
                <option value="operacion">Operacion</option>
                <option value="servicios">Servicios</option>
              </select>
            </div>
            <div>
              <label htmlFor="cp-school" className="sr-only">Nombre del colegio principal</label>
              <input
                id="cp-school"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Nombre del colegio principal"
                aria-label="Nombre del colegio principal"
                value={form.schoolName}
                onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="cp-admin-nombre" className="sr-only">Nombre del administrador de empresa</label>
              <input
                id="cp-admin-nombre"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Nombre del admin de empresa"
                aria-label="Nombre del administrador de empresa"
                value={form.adminNombre}
                onChange={(event) => setForm({ ...form, adminNombre: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="cp-admin-email" className="sr-only">Correo del administrador</label>
              <input
                id="cp-admin-email"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Correo del administrador"
                aria-label="Correo del administrador"
                value={form.adminEmail}
                onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="cp-admin-password" className="sr-only">Password inicial (opcional)</label>
              <input
                id="cp-admin-password"
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                type="password"
                placeholder="Password inicial (opcional)"
                aria-label="Password inicial (opcional)"
                value={form.adminPassword}
                onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">
                Archivo inicial de estructura (opcional): empleados + roles
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                aria-label="Archivo inicial de estructura"
                onChange={(event) => setSeedFile(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-[#9fb6c4] focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              />
            </label>
            <button
              type="button"
              onClick={downloadInitialTemplate}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[#9fb6c4] hover:bg-white/[0.07] transition"
            >
              Descargar plantilla de estructura inicial
            </button>
            {seedFile ? (
              <p className="text-xs text-[#5a7a8e]">Archivo seleccionado: {seedFile.name}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#14b8a6] px-4 py-2.5 font-semibold text-[#022019] disabled:opacity-60"
            >
              {isSubmitting ? "Creando empresa..." : "Crear empresa"}
            </button>
          </form>

          {/* Fix #2: messageClass driven by messageType state */}
          {message ? (
            <p className={`mt-4 rounded-xl border p-3 text-sm ${messageClass}`}>
              {message}
            </p>
          ) : null}

          {provisionedAccess ? (
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Acceso generado</p>
              <div className="mt-3 space-y-2 text-sm text-[#9fb6c4]">
                <p>Empresa: {provisionedAccess.empresa}</p>
                <p>Director (admin colegio): {provisionedAccess.admin}</p>
                <p>Email: {provisionedAccess.email}</p>
                {/* Fix #6: only show the temporaryPassword returned by the API; never fall back to the form value */}
                <p>
                  Password temporal:{" "}
                  {provisionedAccess.temporaryPassword
                    ? provisionedAccess.temporaryPassword
                    : "Usa la contraseña que ingresaste"}
                </p>
                {provisionedAccess.imported ? (
                  <p>
                    Importacion inicial: {provisionedAccess.imported.rows} filas, {provisionedAccess.imported.employees} empleados, {provisionedAccess.imported.users} usuarios, {provisionedAccess.imported.errors} errores.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h4 className="text-2xl font-bold text-white">Empresas registradas</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">Cada empresa mantiene aislados sus usuarios, roles, trazabilidad y contenido.</p>
            </div>

            {/* Fix #5: aria-label on search input */}
            <div>
              <label htmlFor="cp-search" className="sr-only">Buscar por empresa o slug</label>
              <input
                id="cp-search"
                className="w-full max-w-xs rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Buscar por empresa o slug"
                aria-label="Buscar por empresa o slug"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[#c5d5de]">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Seleccionar todas las empresas visibles" />
                Seleccionar visibles
              </label>
              <span className="text-sm text-[#9fb6c4]">{selectedIds.length} seleccionadas</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => runBulkAction("activate")}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/12 transition"
              >
                Activar
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("deactivate")}
                className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/12 transition"
              >
                Desactivar
              </button>
            </div>
          </div>

          {/* Fix #3: loading and error states in the list section */}
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState onRetry={loadCompanies} />
            ) : filteredCompanies.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-[#0c1e28] px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#7a9aaa]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </span>
                <p className="text-sm font-semibold text-white">No hay organizaciones para mostrar</p>
                <p className="max-w-xs text-xs text-[#7a9aaa]">Creá la primera organización o ajustá los filtros de búsqueda para ver resultados.</p>
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <article key={company._id} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
                  <div className="flex flex-wrap items-start gap-4">
                    <label className="mt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(company._id)}
                        onChange={() => toggleSelection(company._id)}
                        aria-label={`Seleccionar ${company.nombre}`}
                      />
                    </label>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-lg font-semibold text-white">{company.nombre}</p>
                            <span
                              className={
                                company.activa
                                  ? "rounded-full border border-emerald-400/20 bg-emerald-500/8 px-2.5 py-0.5 text-xs font-semibold text-emerald-400"
                                  : "rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold text-[#7a9aaa]"
                              }
                            >
                              {company.activa ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#9fb6c4]">Slug: {company.slug}</p>
                          <p className="mt-1 text-sm text-[#9fb6c4]">Tipo: {company.tipoCliente || "general"}</p>
                          <p className="mt-1 text-sm text-[#9fb6c4]">Usuarios asignados: {company.usersCount || 0}</p>
                          <p className="mt-1 flex items-center gap-2 text-sm text-[#9fb6c4]">
                            Plan:
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${company.plan === "base" ? "bg-amber-500/15 text-amber-300" : "bg-violet-500/15 text-violet-300"}`}>
                              {company.plan === "base" ? "Base" : "Pro"}
                            </span>
                            {company.planExpiresAt ? <span className="text-[11px] text-[#7a9aaa]">vence {new Date(company.planExpiresAt).toLocaleDateString("es-AR")}</span> : null}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => { setPlanTarget(company); setPlanForm({ plan: company.plan || "pro", planExpiresAt: company.planExpiresAt ? new Date(company.planExpiresAt).toISOString().slice(0,10) : "" }); }}
                          className="rounded-xl border border-violet-400/30 bg-violet-500/8 px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/12 transition"
                        >
                          Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => setModulesTarget(company)}
                          className="rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/8 px-4 py-2 text-sm text-[#14b8a6] hover:bg-[#14b8a6]/12 transition"
                        >
                          Módulos
                        </button>
                        {/* Fix #4: deactivation via toggleCompany now opens ConfirmDialog; reactivation is direct */}
                        <button
                          type="button"
                          onClick={() => toggleCompany(company)}
                          className={
                            company.activa
                              ? "rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/12 transition"
                              : "rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/12 transition"
                          }
                        >
                          {company.activa ? "Desactivar acceso" : "Reactivar acceso"}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeactivateCompany(company)}
                          className="rounded-xl border border-rose-400/30 bg-rose-500/8 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/12 transition"
                        >
                          Desactivar empresa
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDeactivateOpen}
        title="Desactivar estas empresas?"
        message={`Vas a desactivar ${selectedIds.length} empresa(s). Confirma para continuar.`}
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        destructive
        loading={isConfirming}
        onCancel={() => setConfirmDeactivateOpen(false)}
        onConfirm={confirmDeactivateCompanies}
      />

      <ConfirmDialog
        open={confirmSingleDeactivateOpen}
        title="Desactivar empresa"
        message={
          singleTargetCompany
            ? `Vas a desactivar "${singleTargetCompany.nombre}". Los usuarios de esta empresa no podran acceder hasta que la reactives.`
            : ""
        }
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        destructive
        loading={isSingleConfirming}
        onCancel={() => {
          setConfirmSingleDeactivateOpen(false);
          setSingleTargetCompany(null);
        }}
        onConfirm={confirmSingleDeactivate}
      />

      {/* Fix #4: new ConfirmDialog for toggle-deactivation from the per-company button */}
      <ConfirmDialog
        open={confirmToggleDeactivateOpen}
        title="Desactivar acceso"
        message={
          toggleTargetCompany
            ? `Vas a desactivar el acceso de "${toggleTargetCompany.nombre}". Los usuarios de esta empresa no podran ingresar hasta que lo reactives.`
            : ""
        }
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        destructive
        loading={isToggleConfirming}
        onCancel={() => {
          setConfirmToggleDeactivateOpen(false);
          setToggleTargetCompany(null);
        }}
        onConfirm={confirmToggleDeactivate}
      />

      {modulesTarget && (
        <CompanyModulesModal
          company={modulesTarget}
          token={token}
          addToast={addToast}
          onClose={() => setModulesTarget(null)}
          onSaved={(updatedModules) => {
            setCompanies(prev =>
              prev.map(c => c._id === modulesTarget._id ? { ...c, modules: updatedModules } : c)
            );
          }}
        />
      )}

      {planTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPlanTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1d26] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Gestión de plan</h3>
                <p className="mt-0.5 text-xs text-[#7a9aaa]">{planTarget.nombre}</p>
              </div>
              <button type="button" onClick={() => setPlanTarget(null)} className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-white">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M3 3l10 10M13 3L3 13"/></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#7a9aaa]">Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {["base", "pro"].map(p => (
                    <button key={p} type="button"
                      onClick={() => setPlanForm(f => ({ ...f, plan: p }))}
                      className={`rounded-xl border py-2.5 text-sm font-semibold transition ${planForm.plan === p ? (p === "base" ? "border-amber-400/40 bg-amber-500/15 text-amber-300" : "border-violet-400/40 bg-violet-500/15 text-violet-300") : "border-white/10 bg-white/[0.03] text-[#9fb6c4] hover:bg-white/[0.06]"}`}>
                      {p === "base" ? "Base" : "Pro"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#5e7d8e]">
                  {planForm.plan === "base" ? "Hasta 50 empleados · Funciones esenciales" : "Empleados ilimitados · Todas las funciones"}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#7a9aaa]">Vencimiento del plan <span className="text-[#5e7d8e]">(opcional)</span></label>
                <input type="date" value={planForm.planExpiresAt}
                  onChange={e => setPlanForm(f => ({ ...f, planExpiresAt: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#14b8a6]/50"/>
                {planForm.planExpiresAt && <button type="button" onClick={() => setPlanForm(f => ({ ...f, planExpiresAt: "" }))} className="mt-1 text-[11px] text-[#5e7d8e] hover:text-[#9fb6c4]">Quitar fecha de vencimiento</button>}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setPlanTarget(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#9fb6c4] hover:bg-white/[0.04] transition">
                Cancelar
              </button>
              <button type="button" disabled={planSaving}
                onClick={async () => {
                  setPlanSaving(true);
                  try {
                    const body = { plan: planForm.plan, planExpiresAt: planForm.planExpiresAt || null };
                    await apiFetch(`/companies/${planTarget._id}/plan`, { token, method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    setCompanies(prev => prev.map(c => c._id === planTarget._id ? { ...c, plan: planForm.plan, planExpiresAt: planForm.planExpiresAt || null } : c));
                    addToast({ message: "Plan actualizado", type: "success" });
                    setPlanTarget(null);
                  } catch {
                    addToast({ message: "No se pudo actualizar el plan", type: "error" });
                  } finally {
                    setPlanSaving(false);
                  }
                }}
                className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#0d9488] transition disabled:opacity-50">
                {planSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
