import { useCallback, useEffect, useState } from "react";
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
  const [form, setForm] = useState({ ...emptyForm, companyId: activeCompanyId || "" });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSchools = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (user?.isSuperAdmin && form.companyId) params.set("companyId", form.companyId);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/schools${queryString}`, { token });
    setSchools(data);
  }, [form.companyId, query, token, user?.isSuperAdmin]);

  useEffect(() => {
    loadSchools().catch((error) => setMessage(error.message));
  }, [loadSchools]);

  useEffect(() => {
    if (activeCompanyId && !form.companyId) {
      setForm((current) => ({ ...current, companyId: activeCompanyId }));
    }
  }, [activeCompanyId, form.companyId]);

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
      setForm({ ...emptyForm, companyId: form.companyId });
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
      <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#14b8a6]">Estructura institucional</p>
        <h3 className="mt-3 text-2xl font-bold text-white">Colegios y sedes</h3>
        <p className="mt-3 max-w-3xl text-sm text-[#9fb6c4]">
          Define los colegios o sedes para segmentar empleados, ciclos y evaluaciones con alcance real.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {user?.isSuperAdmin ? (
          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
            <h4 className="text-2xl font-bold text-white">Nuevo colegio</h4>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <select
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                value={form.companyId}
                onChange={(event) => setForm({ ...form, companyId: event.target.value })}
              >
                <option value="">Selecciona empresa</option>
                {(Array.isArray(companies) ? companies : []).map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.nombre}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Nombre del colegio"
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Codigo"
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value })}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Ciudad"
                value={form.ciudad}
                onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
                placeholder="Provincia"
                value={form.provincia}
                onChange={(event) => setForm({ ...form, provincia: event.target.value })}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[#14b8a6] px-4 py-2.5 font-semibold text-[#022019] disabled:opacity-60"
              >
                {isSubmitting ? "Guardando..." : "Crear colegio"}
              </button>
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/[0.07] bg-[#0c1e28] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-2xl font-bold text-white">Colegios cargados</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">Base institucional para la operacion diaria.</p>
            </div>
            <input
              className="w-full max-w-xs rounded-xl border border-white/10 bg-[#0c1e28] px-3.5 py-2.5 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition"
              placeholder="Buscar colegio"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            {Array.isArray(schools) && schools.length ? (
              schools.map((school) => (
                <article key={school._id} className="rounded-xl border border-white/[0.06] bg-[#0f2030]/60 p-4 transition hover:border-[#14b8a6]/20">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">{school.nombre}</p>
                      <p className="mt-1 text-sm text-[#9fb6c4]">
                        {school.codigo || "Sin codigo"} - {school.ciudad || "Sin ciudad"} -{" "}
                        {school.provincia || "Sin provincia"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                        school.activa
                          ? "border-[#14b8a6]/20 bg-[#14b8a6]/8 text-[#14b8a6]"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {school.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#9fb6c4]">Todavia no hay colegios cargados.</p>
            )}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[#9fb6c4]">{message}</p> : null}
    </div>
  );
}
