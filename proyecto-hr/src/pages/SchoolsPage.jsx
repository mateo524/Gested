import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const emptyForm = {
  companyId: "",
  nombre: "",
  codigo: "",
  ciudad: "",
  provincia: "",
  pais: "Argentina",
};

export default function SchoolsPage() {
  const { token, companies, user, activeCompanyId } = useAuth();
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({
    ...emptyForm,
    companyId: activeCompanyId || "",
  });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadSchools() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (user?.isSuperAdmin && form.companyId) params.set("companyId", form.companyId);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/schools${queryString}`, { token });
    setSchools(data);
  }

  useEffect(() => {
    loadSchools().catch((error) => setMessage(error.message));
  }, [token, query, form.companyId]);

  useEffect(() => {
    if (activeCompanyId && !form.companyId) {
      setForm((current) => ({ ...current, companyId: activeCompanyId }));
    }
  }, [activeCompanyId]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setMessage("");
      await apiFetch("/schools", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({
        ...emptyForm,
        companyId: user?.isSuperAdmin ? form.companyId : activeCompanyId || "",
      });
      setMessage("Colegio creado");
      await loadSchools();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Estructura institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Colegios y sedes</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Define los colegios o sedes que forman parte de cada cliente para segmentar empleados,
          ciclos y evaluaciones con alcance real.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-semibold">Nuevo colegio</h4>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {user?.isSuperAdmin ? (
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                value={form.companyId}
                onChange={(event) => setForm({ ...form, companyId: event.target.value })}
              >
                <option value="">Selecciona empresa</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.nombre}
                  </option>
                ))}
              </select>
            ) : null}

            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre del colegio"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Código"
              value={form.codigo}
              onChange={(event) => setForm({ ...form, codigo: event.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Ciudad"
              value={form.ciudad}
              onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Provincia"
              value={form.provincia}
              onChange={(event) => setForm({ ...form, provincia: event.target.value })}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
            >
              {isSubmitting ? "Guardando..." : "Crear colegio"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-xl font-semibold">Colegios cargados</h4>
              <p className="mt-1 text-slate-500">Base institucional sobre la que se apoya toda la operación.</p>
            </div>
            <input
              className="w-full max-w-xs rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Buscar colegio"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            {schools.length ? (
              schools.map((school) => (
                <article key={school._id} className="rounded-[1.75rem] border border-slate-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{school.nombre}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {school.codigo || "Sin código"} · {school.ciudad || "Sin ciudad"} · {school.provincia || "Sin provincia"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        school.activa ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {school.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-slate-500">Todavía no hay colegios cargados.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
