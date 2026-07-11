// Regla de negocio: la calificacion final es la del jefe directo; si no hay jefe, se usa la autoevaluacion.
export function resolveFinalScore(jefeScore, autoScore) {
  return jefeScore ?? autoScore ?? null;
}
