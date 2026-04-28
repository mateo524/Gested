import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyCompany = {
  nombre: "",
  slug: "",
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

  async function loadCompanies() {
    const data = await apiFetch("/companies", { token });
    setCompanies(data);
  }

  useEffect(() => {
    loadCompanies().catch((error) => setMessage(error.message));
  }, [token]);

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

      const data = await apiFetch("/companies", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setForm(emptyCompany);
      setProvisionedAccess({
        empresa: data.company?.nombre,
        admin: data.adminUser?.nombre,
        email: data.adminUser?.email,
        temporaryPassword: data.adminUser?.temporaryPassword || form.adminPassword,
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-500">
          Alta de clientes
        </p>
        <h3 className="mt-3 text-3xl font-semibold text-slate-950">
          Crear empresa y acceso inicial
        </h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Gested puede dejar lista una empresa con su administrador inicial para que
          entre, vea solo su informacion y opere dentro del alcance que le asignamos.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nueva empresa</h4>
          <p className="mt-1 text-slate-500">
            Completa los datos del cliente y deja provisionado su acceso.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
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
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre del admin de empresa"
              value={form.adminNombre}
              onChange={(event) =>
                setForm({ ...form, adminNombre: event.target.value })
              }
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Correo del administrador"
              value={form.adminEmail}
              onChange={(event) =>
                setForm({ ...form, adminEmail: event.target.value })
              }
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              type="password"
              placeholder="Contrasena inicial (opcional)"
              value={form.adminPassword}
              onChange={(event) =>
                setForm({ ...form, adminPassword: event.target.value })
              }
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? "Creando empresa..." : "Crear empresa"}
            </button>
          </form>

          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

          {provisionedAccess ? (
            <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                Acceso generado
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Empresa: {provisionedAccess.empresa}</p>
                <p>Admin: {provisionedAccess.admin}</p>
                <p>Email: {provisionedAccess.email}</p>
                <p>Password temporal: {provisionedAccess.temporaryPassword}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Empresas registradas</h4>
          <p className="mt-1 text-slate-500">
            Cada empresa mantiene aislados sus usuarios, roles, auditoria y contenido.
          </p>

          <div className="mt-6 space-y-4">
            {companies.map((company) => (
              <article key={company._id} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold">{company.nombre}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          company.activa
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {company.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">Slug: {company.slug}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Usuarios asignados: {company.usersCount || 0}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCompany(company)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                      company.activa
                        ? "border border-amber-200 text-amber-700"
                        : "border border-emerald-200 text-emerald-700"
                    }`}
                  >
                    {company.activa ? "Desactivar acceso" : "Reactivar acceso"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
