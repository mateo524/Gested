import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const EMOJIS = ["😞", "😐", "🙂", "😊", "🤩"];

function ScaleInput({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {EMOJIS.map((emoji, idx) => {
        const val = idx + 1;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`flex h-12 w-12 flex-col items-center justify-center rounded-2xl border text-2xl transition select-none ${
              value === val
                ? "border-[#14b8a6] bg-[#14b8a6]/20 shadow-[0_0_0_2px_rgba(20,184,166,0.4)]"
                : "border-white/10 bg-[#12222d] hover:bg-white/5"
            }`}
            aria-label={`Valoración ${val}`}
          >
            {emoji}
          </button>
        );
      })}
      {value && (
        <span className="self-center ml-1 text-sm text-[#7a9aaa]">{value}/5</span>
      )}
    </div>
  );
}

function BarDistribution({ distribution, total }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((val) => {
        const count = distribution?.[val] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={val} className="flex items-center gap-3 text-xs">
            <span className="w-5 text-center text-base">{EMOJIS[val - 1]}</span>
            <div className="flex-1 rounded-full bg-white/5 h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#14b8a6] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-[#7a9aaa]">{count}</span>
            <span className="w-8 text-right text-[#5e7d8e]">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function SurveyForm({ check, onSubmitted }) {
  const { token } = useAuth();
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setScale(idx, val) {
    setAnswers((prev) => ({ ...prev, [idx]: { ...prev[idx], scaleValue: val } }));
  }

  function setText(idx, val) {
    setAnswers((prev) => ({ ...prev, [idx]: { ...prev[idx], textValue: val } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validate all scale questions have been answered
    for (let i = 0; i < check.questions.length; i++) {
      const q = check.questions[i];
      if (q.type === "scale" && !(answers[i]?.scaleValue >= 1 && answers[i]?.scaleValue <= 5)) {
        setError(`Por favor respondé la pregunta ${i + 1}.`);
        return;
      }
    }

    const payload = check.questions.map((q, idx) => ({
      questionIndex: idx,
      scaleValue: q.type === "scale" ? answers[idx]?.scaleValue : null,
      textValue: q.type === "text" ? (answers[idx]?.textValue || "") : null,
    }));

    try {
      setSubmitting(true);
      await apiFetch(`/pulse/${check._id}/respond`, {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      onSubmitted?.();
    } catch (err) {
      setError(err.message || "Error al enviar respuesta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {check.questions.map((q, idx) => (
        <div key={idx} className="space-y-2">
          <label className="block text-sm font-medium text-white">
            <span className="text-[#14b8a6] mr-1">{idx + 1}.</span> {q.text}
          </label>
          {q.type === "scale" ? (
            <ScaleInput value={answers[idx]?.scaleValue} onChange={(val) => setScale(idx, val)} />
          ) : (
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3 text-sm text-white placeholder:text-[#5e7d8e] outline-none focus:border-[#14b8a6]/50 resize-none"
              rows={3}
              placeholder="Escribí tu respuesta…"
              value={answers[idx]?.textValue || ""}
              onChange={(e) => setText(idx, e.target.value)}
            />
          )}
        </div>
      ))}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar respuesta"}
      </button>
    </form>
  );
}

function CheckCard({ check, canManage, onDeleted, onRefresh }) {
  const { token } = useAuth();
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [submitted, setSubmitted] = useState(check.hasResponded);
  const [deleting, setDeleting] = useState(false);

  async function loadResults() {
    if (results) { setShowResults((v) => !v); return; }
    setShowResults(true);
    setLoadingResults(true);
    try {
      const data = await apiFetch(`/pulse/${check._id}/results`, { token });
      setResults(data);
    } catch (err) {
      setResultsError(err.message || "Error cargando resultados");
    } finally {
      setLoadingResults(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la encuesta "${check.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      setDeleting(true);
      await apiFetch(`/pulse/${check._id}`, { method: "DELETE", token });
      onDeleted?.();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="pf-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{check.title}</h3>
          <p className="mt-0.5 text-xs text-[#7a9aaa]">
            {check.questions.length} pregunta(s)
            {check.closesAt
              ? ` · Cierra ${new Date(check.closesAt).toLocaleDateString("es-AR")}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <>
              <button
                type="button"
                onClick={loadResults}
                className="rounded-2xl border border-white/10 px-3 py-1.5 text-xs text-[#c7d5dc] transition hover:bg-white/5"
              >
                {showResults ? "Ocultar resultados" : "Ver resultados"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-2xl border border-rose-500/20 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
              >
                {deleting ? "…" : "Eliminar"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Survey form for employees (not yet responded) */}
      {!submitted && !canManage && (
        <SurveyForm
          check={check}
          onSubmitted={() => setSubmitted(true)}
        />
      )}

      {/* Success state */}
      {submitted && !canManage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Gracias por tu respuesta. Ya enviaste esta encuesta.
        </div>
      )}

      {/* Admin form: allow response as well (admins are users too) */}
      {!submitted && canManage && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-[#7a9aaa] hover:text-white transition">
            Responder encuesta (opcional)
          </summary>
          <div className="mt-3">
            <SurveyForm check={check} onSubmitted={() => setSubmitted(true)} />
          </div>
        </details>
      )}

      {/* Results section */}
      {showResults && (
        <div className="border-t border-white/10 pt-4 space-y-4">
          {loadingResults && (
            <p className="text-sm text-[#7a9aaa]">Cargando resultados…</p>
          )}
          {resultsError && (
            <p className="text-sm text-rose-300">{resultsError}</p>
          )}
          {results && !loadingResults && (
            <>
              <p className="text-xs text-[#7a9aaa]">
                {results.responseCount} respuesta(s) recibida(s)
              </p>
              {results.questions.map((q) => (
                <div key={q.questionIndex} className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    <span className="text-[#14b8a6] mr-1">{q.questionIndex + 1}.</span> {q.text}
                  </p>
                  {q.type === "scale" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-xs text-[#7a9aaa]">
                        <span>Promedio:</span>
                        <span className="font-semibold text-white">
                          {q.average !== null ? `${q.average} / 5` : "Sin datos"}
                        </span>
                        <span className="ml-auto">{q.total} respuesta(s)</span>
                      </div>
                      <BarDistribution distribution={q.distribution} total={q.total} />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {q.textAnswers.length > 0 ? (
                        q.textAnswers.map((text, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-white/8 bg-[#0f1d26] px-3 py-2 text-xs text-[#c7d5dc]"
                          >
                            {text}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#5e7d8e]">Sin respuestas de texto.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CreateCheckForm({ onCreated }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", type: "scale" }]);
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addQuestion() {
    setQuestions((prev) => [...prev, { text: "", type: "scale" }]);
  }

  function removeQuestion(idx) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx, field, value) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("El título es requerido."); return; }
    if (questions.some((q) => !q.text.trim())) { setError("Todas las preguntas deben tener texto."); return; }

    try {
      setSaving(true);
      await apiFetch("/pulse", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, questions, closesAt: closesAt || null }),
      });
      setTitle("");
      setQuestions([{ text: "", type: "scale" }]);
      setClosesAt("");
      onCreated?.();
    } catch (err) {
      setError(err.message || "Error al crear la encuesta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pf-card p-5">
      <h3 className="text-base font-semibold text-white mb-4">Crear nueva encuesta</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#7a9aaa] uppercase tracking-wider">
            Título
          </label>
          <input
            className="w-full rounded-2xl border border-white/10 bg-[#12222d] px-4 py-2.5 text-sm text-white placeholder:text-[#5e7d8e] outline-none focus:border-[#14b8a6]/50"
            placeholder="Ej: Encuesta mensual de clima"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#7a9aaa] uppercase tracking-wider">
            Fecha de cierre (opcional)
          </label>
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-2.5 text-sm text-white outline-none focus:border-[#14b8a6]/50"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#7a9aaa] uppercase tracking-wider">
              Preguntas
            </label>
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-xl border border-[#14b8a6]/30 px-3 py-1 text-xs text-[#14b8a6] transition hover:bg-[#14b8a6]/10"
            >
              + Agregar pregunta
            </button>
          </div>
          {questions.map((q, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-[#12222d] px-3 py-2 text-sm text-white placeholder:text-[#5e7d8e] outline-none focus:border-[#14b8a6]/50"
                  placeholder={`Pregunta ${idx + 1}`}
                  value={q.text}
                  onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                />
              </div>
              <select
                className="rounded-2xl border border-white/10 bg-[#12222d] px-3 py-2 text-sm text-white shrink-0"
                value={q.type}
                onChange={(e) => updateQuestion(idx, "type", e.target.value)}
              >
                <option value="scale">Escala 1-5</option>
                <option value="text">Texto abierto</option>
              </select>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 text-rose-400 transition hover:bg-rose-500/10"
                  aria-label="Eliminar pregunta"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Creando…" : "Crear encuesta"}
        </button>
      </form>
    </div>
  );
}

export default function PulsePage() {
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission("manage_settings");
  const canViewResults = hasPermission("view_reports") || canManage;

  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchChecks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await apiFetch("/pulse", { token });
      setChecks(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Error cargando encuestas");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  return (
    <div className="space-y-6">
      <div className="pf-surface p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#14b8a6]">
          Clima laboral
        </div>
        <h1 className="text-2xl font-bold text-white">Pulse Check</h1>
        <p className="mt-1 text-sm text-[#7a9aaa]">
          Encuestas rápidas para medir el clima del equipo y detectar áreas de mejora.
        </p>
      </div>

      {canManage && (
        <CreateCheckForm onCreated={fetchChecks} />
      )}

      {loading && (
        <div className="pf-card p-8 text-center text-sm text-[#7a9aaa]">
          Cargando encuestas…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && checks.length === 0 && (
        <div className="pf-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1e28] text-2xl">
            💬
          </div>
          <p className="text-base font-semibold text-white">No hay encuestas activas</p>
          <p className="text-sm text-[#7a9aaa]">
            {canManage
              ? "Creá una nueva encuesta usando el formulario de arriba."
              : "No hay encuestas de clima disponibles en este momento."}
          </p>
        </div>
      )}

      {!loading && checks.length > 0 && (
        <div className="space-y-4">
          {checks.map((check) => (
            <CheckCard
              key={check._id}
              check={check}
              canManage={canViewResults}
              onDeleted={fetchChecks}
              onRefresh={fetchChecks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
