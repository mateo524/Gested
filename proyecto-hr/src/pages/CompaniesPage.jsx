import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";

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

export default function CompaniesPage() {
  const { token, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyCompany);
  const [message, setMessage] = useState("");
  const [provisionedAccess, setProvisionedAccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [seedFile, setSeedFile] = useState(null);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmSingleDeactivateOpen, setConfirmSingleDeactivateOpen] = useState(false);
  const [singleTargetCompany, setSingleTargetCompany] = useState(null);
  const [isSingleConfirming, setIsSingleConfirming] = useState(false);

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

  const loadCompanies = useCallback(async () => {
    const data = await apiFetch(`/companies${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`, { token });
    setCompanies(data);
  }, [query, token]);

  useEffect(() => {
    loadCompanies().catch((error) => setMessage(error.message));
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
      setMessage("Selecciona al menos una empresa");
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

      setMessage(data.mensaje);
      setSelectedIds([]);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
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

      setMessage(data.mensaje);
      setSelectedIds([]);
      setConfirmDeactivateOpen(false);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
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

      setForm(emptyCompany);
      setSeedFile(null);
      setProvisionedAccess({
        empresa: data.company?.nombre,
        admin: data.adminUser?.nombre,
        email: data.adminUser?.email,
        temporaryPassword: data.adminUser?.temporaryPassword || form.adminPassword,
        imported: data.imported || null,
      });
      setMessage("Empresa creada y acceso inicial generado.");
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleCompany(company) {
    try {
      setMessage("");
      await apiFetch(`/companies/${company._id}`, {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activa: !company.activa }),
      });
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
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
      setMessage(`"${singleTargetCompany.nombre}" desactivada`);
      setConfirmSingleDeactivateOpen(false);
      setSingleTargetCompany(null);
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSingleConfirming(false);
    }
  }

  const activeCount = companies.filter((company) => company.activa).length;

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

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Nombre de la empresa"
              value={form.nombre}
              onChange={(event) =>
                setForm({
                  ...form,
                  nombre: event.target.value,
                  slug: slugify(event.target.value),
                })
              }
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            />
            <select
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              value={form.tipoCliente}
              onChange={(event) => setForm({ ...form, tipoCliente: event.target.value })}
            >
              <option value="general">General</option>
              <option value="educacion">Educacion</option>
              <option value="salud">Salud</option>
              <option value="operacion">Operacion</option>
              <option value="servicios">Servicios</option>
            </select>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Nombre del colegio principal"
              value={form.schoolName}
              onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Nombre del admin de empresa"
              value={form.adminNombre}
              onChange={(event) => setForm({ ...form, adminNombre: event.target.value })}
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Correo del administrador"
              value={form.adminEmail}
              onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              type="password"
              placeholder="Password inicial (opcional)"
              value={form.adminPassword}
              onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
            />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">
                Archivo inicial de estructura (opcional): empleados + roles
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
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

          {message ? (
            <p className={`mt-4 rounded-xl border p-3 text-sm ${message.toLowerCase().includes("error") || message.toLowerCase().includes("fail") ? "border-rose-400/20 bg-rose-500/8 text-rose-400" : "border-emerald-400/20 bg-emerald-500/8 text-emerald-400"}`}>
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
                <p>Password temporal: {provisionedAccess.temporaryPassword}</p>
                {provisionedAccess.imported ? (
                  <p>
                    Importación inicial: {provisionedAccess.imported.rows} filas, {provisionedAccess.imported.employees} empleados, {provisionedAccess.imported.users} usuarios, {provisionedAccess.imported.errors} errores.
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

            <input
              className="w-full max-w-xs rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Buscar por empresa o slug"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[#c5d5de]">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
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

          <div className="mt-6 space-y-4">
            {filteredCompanies.map((company) => (
              <article key={company._id} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
                <div className="flex flex-wrap items-start gap-4">
                  <label className="mt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(company._id)}
                      onChange={() => toggleSelection(company._id)}
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
                      </div>

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
            ))}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDeactivateOpen}
        title="¿Desactivar estas empresas?"
        message={`Vas a desactivar ${selectedIds.length} empresa(s). Confirmá para continuar.`}
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
            ? `Vas a desactivar "${singleTargetCompany.nombre}". Los usuarios de esta empresa no podrán acceder hasta que la reactives.`
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
    </div>
  );
}
