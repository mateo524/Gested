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

export default function CompaniesPage() {
  const { token, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyCompany);
  const [message, setMessage] = useState("");

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
      await apiFetch("/companies", {
        method: "POST",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setForm(emptyCompany);
      setMessage("Empresa creada");
      await loadCompanies();
      await refreshCompanies();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleCompany(company) {
    try {
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
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Nueva empresa</h3>
        <p className="mt-1 text-slate-500">
          Creá empresas y dejá listo su administrador principal desde el alta.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            placeholder="Nombre de la empresa"
            value={form.nombre}
            onChange={(event) => setForm({ ...form, nombre: event.target.value })}
          />
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            placeholder="Slug"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
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
            placeholder="Email del admin"
            value={form.adminEmail}
            onChange={(event) =>
              setForm({ ...form, adminEmail: event.target.value })
            }
          />
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3"
            type="password"
            placeholder="Password inicial del admin"
            value={form.adminPassword}
            onChange={(event) =>
              setForm({ ...form, adminPassword: event.target.value })
            }
          />

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
          >
            Crear empresa
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Empresas registradas</h3>
        <p className="mt-1 text-slate-500">
          Cada empresa conserva sus usuarios, roles, auditoría y contenido aislados.
        </p>

        <div className="mt-6 space-y-4">
          {companies.map((company) => (
            <article key={company._id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{company.nombre}</p>
                  <p className="text-sm text-slate-500">Slug: {company.slug}</p>
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
                  {company.activa ? "Desactivar" : "Activar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
