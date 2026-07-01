// ─── Performance scale N1–N5 ─────────────────────────────────────────────────
// These colors are RESERVED for performance levels only.
// Never use them for areas/departments.

export const PERF_COLORS = {
  N1: "#FD6668", // Insatisfactorio  (≤1)
  N2: "#FF883E", // Mínimo           (≤2)
  N3: "#FCC72F", // En desarrollo    (≤3)
  N4: "#00CEB7", // Competente       (≤4)
  N5: "#16A34A", // Excepcional      (>4)
};

export const PERF_LABELS = {
  N1: "Insatisfactorio",
  N2: "Mínimo",
  N3: "En desarrollo",
  N4: "Competente",
  N5: "Excepcional",
};

// Returns hex color for a numeric score 1–5
export function perfColor(score) {
  if (!score || score <= 0) return "#6b8fa0";
  if (score <= 1) return PERF_COLORS.N1;
  if (score <= 2) return PERF_COLORS.N2;
  if (score <= 3) return PERF_COLORS.N3;
  if (score <= 4) return PERF_COLORS.N4;
  return PERF_COLORS.N5;
}

// Returns label for a numeric score
export function perfLabel(score) {
  if (!score || score <= 0) return "Sin datos";
  if (score <= 1) return PERF_LABELS.N1;
  if (score <= 2) return PERF_LABELS.N2;
  if (score <= 3) return PERF_LABELS.N3;
  if (score <= 4) return PERF_LABELS.N4;
  return PERF_LABELS.N5;
}

// Ordered array for distribution bars/charts [N1, N2, N3, N4, N5]
export const PERF_PALETTE = [
  PERF_COLORS.N1,
  PERF_COLORS.N2,
  PERF_COLORS.N3,
  PERF_COLORS.N4,
  PERF_COLORS.N5,
];

// Tailwind-class-based score color (for CalibracionPage and similar)
export function perfColorTw(score) {
  if (score === null || score === undefined) return "bg-white/5 text-[#7a9aaa]";
  if (score <= 1) return "bg-red-500/20 text-red-200";
  if (score <= 2) return "bg-orange-500/20 text-orange-200";
  if (score <= 3) return "bg-yellow-400/20 text-yellow-100";
  if (score <= 4) return "bg-teal-500/20 text-teal-200";
  return "bg-green-700/20 text-green-200";
}

// ─── Area / department palette ────────────────────────────────────────────────
// Institutional secondary palette. Never overlaps with N1-N5 colors.

export const AREA_COLORS_MAP = {
  Secundaria:       "#3B82F6",
  Primaria:         "#0EA5E9",
  Jardín:           "#EC4899",
  Jardin:           "#EC4899",
  Administración:   "#A855F7",
  Administracion:   "#A855F7",
  "Dirección":      "#0F766E",
  Direccion:        "#0F766E",
  Jefaturas:        "#0F766E",
  Docentes:         "#6366F1",
  RRHH:             "#64748B",
  "Recursos Humanos": "#64748B",
  Operaciones:      "#0891B2",
  Gestión:          "#0891B2",
  Gestion:          "#0891B2",
};

// Fallback ordered palette for unknown areas (index-based)
export const AREA_PALETTE = [
  "#3B82F6",
  "#0EA5E9",
  "#EC4899",
  "#A855F7",
  "#0F766E",
  "#6366F1",
  "#64748B",
  "#0891B2",
  "#7C3AED",
  "#0284C7",
];

// Returns color for an area name, with index fallback
export function areaColor(areaName, fallbackIndex = 0) {
  if (!areaName) return AREA_PALETTE[fallbackIndex % AREA_PALETTE.length];
  // Exact match
  if (AREA_COLORS_MAP[areaName]) return AREA_COLORS_MAP[areaName];
  // Partial match (case-insensitive)
  const lower = areaName.toLowerCase();
  for (const [key, val] of Object.entries(AREA_COLORS_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val;
  }
  return AREA_PALETTE[fallbackIndex % AREA_PALETTE.length];
}
