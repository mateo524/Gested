import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import useCountUp from "../hooks/useCountUp";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch, apiUrl } from "../lib/api";
import { isEmployeeUser } from "../lib/roleHelpers";
import CollapsibleList from "../components/CollapsibleList";

function ExecChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/15 bg-[#0b1d27] px-4 py-3 shadow-[0_16px_40px_rgba(2,8,23,0.5)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7a9aaa]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.fill }} />
          <span className="text-[#a8bec9]">{entry.name}:</span>
          <span className="ml-auto pl-4 font-semibold text-white">{typeof entry.value === "number" ? entry.value.toFixed(entry.value % 1 === 0 ? 0 : 2) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const PRIMARY_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "personas", label: "Personas" },
  { key: "por-nivel", label: "Por nivel" },
  { key: "comparativo", label: "Comparativo" },
  { key: "radar", label: "Radar" },
  { key: "recomendaciones", label: "Recomendaciones" },
  { key: "estructura", label: "Estructura" },
];

const FILTERS_STORAGE_KEY = "exec_report_filters";

const severityTone = {
  high: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  low: "border-sky-300/30 bg-sky-500/10 text-sky-100",
};

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function average(values = []) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function pct(value, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(value) / total) * 100)));
}

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const AREA_COLORS = ["#3B82F6","#10B981","#F59E0B","#EC4899","#8B5CF6","#14B8A6","#F97316","#06B6D4"];
function areaColor(idx) { return AREA_COLORS[idx % AREA_COLORS.length]; }

function scColor(v) {
  if (!v) return "#6b8fa0";
  if (v <= 1) return "#f87171";
  if (v <= 2) return "#fb923c";
  if (v <= 3) return "#facc15";
  if (v <= 4) return "#2dd4bf";
  return "#4ade80";
}
function scLabel(v) {
  if (!v) return "Sin datos";
  if (v <= 1) return "Insatisfactorio";
  if (v <= 2) return "Mínimo";
  if (v <= 3) return "En Desarrollo";
  if (v <= 4) return "Competente";
  return "Excepcional";
}

function ScorePill({ v, small }) {
  const c = scColor(v);
  const sz = small ? { fontSize: 9, padding: "1px 5px", minWidth: 28 } : { fontSize: 10, padding: "2px 7px", minWidth: 34 };
  return (
    <span style={{ background: c + "20", color: c, border: `1px solid ${c}50`, fontWeight: 800, borderRadius: 6, display: "inline-block", textAlign: "center", ...sz }}>
      {v != null ? (typeof v === "number" && v % 1 ? v.toFixed(1) : v) : "—"}
    </span>
  );
}

function DistBars({ dist }) {
  const dc = ["#f87171","#fb923c","#facc15","#2dd4bf","#4ade80"];
  const max = Math.max(...dist, 1);
  return (
    <div style={{ display:"flex", gap:3, alignItems:"flex-end" }}>
      {dist.map((cnt, i) => {
        const h = Math.max(3, Math.round((cnt / max) * 44));
        return (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{ fontSize:8, color:"#7a9aaa" }}>{cnt}</span>
            <div style={{ width:14, height:h, background:dc[i], borderRadius:3 }} />
            <span style={{ fontSize:8, color:"#7a9aaa" }}>N{i+1}</span>
          </div>
        );
      })}
    </div>
  );
}

function RadarCanvas({ labels, datasets, width, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !labels.length) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    const cx = width / 2, cy = height / 2 - 10;
    const maxR = Math.min(cx, cy) - 44;
    const n = labels.length;
    const step = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, width, height);
    for (let ring = 1; ring <= 5; ring++) {
      const r = (ring / 5) * maxR;
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + i * step;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "rgba(107,143,160,0.5)"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(ring, cx + 3, cy - r + 3);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a)); ctx.stroke();
    }
    ctx.fillStyle = "#9BB5C4"; ctx.font = "bold 9px sans-serif";
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step; const lr = maxR + 22;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(labels[i], cx + lr * Math.cos(a), cy + lr * Math.sin(a));
    }
    datasets.forEach(({ vals, color }) => {
      ctx.beginPath();
      vals.forEach((v, i) => {
        const a = -Math.PI / 2 + i * step; const r = (v / 5) * maxR;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      });
      ctx.closePath(); ctx.fillStyle = color + "28"; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      vals.forEach((v, i) => {
        const a = -Math.PI / 2 + i * step; const r = (v / 5) * maxR;
        ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
    });
    if (datasets.length > 1) {
      let lx = 8;
      datasets.forEach(({ color, label }) => {
        ctx.fillStyle = color; ctx.fillRect(lx, height - 16, 9, 7);
        ctx.fillStyle = "#9BB5C4"; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(label, lx + 13, height - 10);
        lx += (label || "").length * 5.5 + 18;
      });
    }
  }, [labels, datasets, width, height]);
  return <canvas ref={ref} style={{ display:"block", margin:"0 auto", maxWidth:"100%" }} />;
}

function computeRecomendaciones(grupos, competencias) {
  const recs = [];
  grupos.forEach((g) => {
    competencias.forEach(({ id, nombre }) => {
      const st = g.compStats[id];
      if (!st) return;
      if (st.pctLow >= 30) {
        recs.push({ sev:"crit", area:g.area, comp:nombre, icon:"🚨",
          title:`Alta concentración de bajo desempeño en ${nombre}`,
          body:`El ${st.pctLow}% del personal de ${g.area} tiene puntaje menor a 2.5 (promedio: ${st.avg.toFixed(1)}). Afecta a ~${Math.round(g.count * st.pctLow / 100)} personas.`,
          action:"Capacitación grupal urgente" });
      } else if (st.pctLow >= 18) {
        recs.push({ sev:"warn", area:g.area, comp:nombre, icon:"⚠️",
          title:`Brecha moderada en ${nombre} — ${g.area}`,
          body:`El ${st.pctLow}% del personal de ${g.area} presenta desempeño insuficiente (promedio: ${st.avg.toFixed(1)}). Intervención preventiva recomendada.`,
          action:"Taller de desarrollo sugerido" });
      }
    });
  });
  competencias.forEach(({ id, nombre }) => {
    const vals = grupos.map((g) => ({ area:g.area, avg:g.compStats[id]?.avg })).filter((x) => x.avg != null);
    if (vals.length < 2) return;
    const avgs = vals.map((x) => x.avg);
    const brecha = Math.max(...avgs) - Math.min(...avgs);
    if (brecha >= 1.2) {
      const maxG = vals[avgs.indexOf(Math.max(...avgs))];
      const minG = vals[avgs.indexOf(Math.min(...avgs))];
      recs.push({ sev:"info", area:"Comparativo", comp:nombre, icon:"📊",
        title:`Gran brecha en ${nombre} entre áreas`,
        body:`Diferencia de ${brecha.toFixed(1)} puntos entre ${maxG.area} (${maxG.avg.toFixed(1)}) y ${minG.area} (${minG.avg.toFixed(1)}).`,
        action:"Programa de intercambio entre pares" });
    }
  });
  const globalComp = competencias.map(({ id, nombre }) => {
    const all = grupos.map((g) => g.compStats[id]?.avg).filter((v) => v != null);
    const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    return { nombre, avg };
  }).filter((c) => c.avg > 0).sort((a, b) => a.avg - b.avg);
  if (globalComp.length) {
    const weak = globalComp[0];
    recs.push({ sev:"info", area:"Toda la organización", comp:weak.nombre, icon:"🏫",
      title:`Competencia más débil institucional: ${weak.nombre}`,
      body:`Promedio global: ${weak.avg.toFixed(1)}. Recomendada como eje del plan anual de capacitación.`,
      action:"Incluir en plan anual de capacitación" });
  }
  return recs.sort((a, b) => ({ crit:0, warn:1, info:2 }[a.sev] - { crit:0, warn:1, info:2 }[b.sev]));
}

function buildPdfDocument({ orgName, execSummaryLines, execSignals, overview, priorityEmployees, topPerformers, overviewActions, evaluationCoverage }) {
  const date = new Date().toLocaleDateString("es-AR", { dateStyle: "long" });
  const avg = overview?.summary?.averageScore || 0;
  const pending = overview?.summary?.evaluationsPending || 0;
  const total = overview?.summary?.employeesTotal || 0;
  const active = overview?.summary?.evaluationsTotal || 0;
  const activePlans = overview?.development?.active || 0;
  const kpisAtRisk = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);

  const toneCard = (tone) =>
    tone === "success" ? "card-success" : tone === "warning" ? "card-warning" : tone === "danger" ? "card-danger" : "card-default";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Ejecutivo — ZENTOR</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; background: #fff; font-size: 10.5pt; line-height: 1.55; }
    @page { size: A4; margin: 18mm 20mm; }

    /* Header */
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2.5px solid #14b8a6; margin-bottom: 18px; }
    .hdr-brand .logo { font-size: 21pt; font-weight: 800; letter-spacing: -1px; color: #0f172a; }
    .hdr-brand .logo span { color: #14b8a6; }
    .hdr-brand .sub { font-size: 8.5pt; color: #64748b; margin-top: 2px; }
    .hdr-meta { text-align: right; }
    .hdr-meta p { font-size: 8.5pt; color: #475569; margin-top: 2px; }
    .hdr-meta strong { color: #0f172a; }

    /* Section */
    .sec { margin-bottom: 18px; break-inside: avoid; }
    .sec-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #f1f5f9; }

    /* Summary */
    .summary p { font-size: 10.5pt; color: #334155; margin-bottom: 5px; line-height: 1.65; }

    /* Grid */
    .g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
    .g5 { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }
    .g2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }

    /* Metric cards */
    .mc { border: 1px solid #e2e8f0; border-radius: 9px; padding: 11px 12px; }
    .mc-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; }
    .mc-value { font-size: 18pt; font-weight: 800; color: #0f172a; margin: 4px 0 2px; line-height: 1; }
    .mc-hint { font-size: 7.5pt; color: #64748b; }
    .card-success { border-color: #bbf7d0; background: #f0fdf4; }
    .card-success .mc-value { color: #15803d; }
    .card-warning { border-color: #fde68a; background: #fffbeb; }
    .card-warning .mc-value { color: #b45309; }
    .card-danger { border-color: #fecaca; background: #fef2f2; }
    .card-danger .mc-value { color: #b91c1c; }
    .card-default { border-color: #e2e8f0; background: #f8fafc; }

    /* Progress bar */
    .pb { height: 4px; border-radius: 3px; background: #e2e8f0; margin-top: 7px; overflow: hidden; }
    .pb-fill { height: 100%; border-radius: 3px; }
    .pb-green { background: #22c55e; }
    .pb-amber { background: #f59e0b; }
    .pb-red { background: #ef4444; }

    /* People rows */
    .person { display: flex; align-items: center; justify-content: space-between; padding: 7px 11px; border: 1px solid #f1f5f9; border-radius: 8px; margin-bottom: 5px; background: #f8fafc; }
    .person-name { font-weight: 600; font-size: 9.5pt; }
    .person-sub { font-size: 7.5pt; color: #64748b; margin-top: 1px; }
    .badge { font-size: 9pt; font-weight: 700; padding: 2px 10px; border-radius: 99px; white-space: nowrap; }
    .badge-low { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-high { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-mid { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }

    /* Actions */
    .action { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .action:last-child { border-bottom: none; }
    .pri { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 7px; border-radius: 99px; white-space: nowrap; margin-top: 2px; flex-shrink: 0; }
    .pri-high { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .pri-med { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .pri-low { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .action-desc { font-size: 9.5pt; color: #334155; }
    .action-emp { font-size: 7.5pt; color: #64748b; margin-top: 1px; }

    /* Divider */
    hr { border: none; border-top: 1px solid #f1f5f9; margin: 14px 0; }

    /* Footer */
    .ftr { margin-top: 22px; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .ftr p { font-size: 7.5pt; color: #94a3b8; }
    .ftr strong { color: #14b8a6; }

    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>

  <div class="hdr">
    <div class="hdr-brand">
      <div class="logo">ZEN<span>TOR</span></div>
      <div class="sub">Reporte Ejecutivo de Desempeño</div>
    </div>
    <div class="hdr-meta">
      ${orgName ? `<p><strong>Organización:</strong> ${escHtml(orgName)}</p>` : ""}
      <p><strong>Generado:</strong> ${date}</p>
    </div>
  </div>

  ${execSummaryLines.length ? `
  <div class="sec">
    <p class="sec-title">Resumen ejecutivo</p>
    <div class="summary">${execSummaryLines.map(l => `<p>${escHtml(l)}</p>`).join("")}</div>
  </div>` : ""}

  <div class="sec">
    <p class="sec-title">Indicadores clave del período</p>
    <div class="g4">
      ${execSignals.map(s => `
      <div class="mc ${toneCard(s.tone)}">
        <p class="mc-label">${escHtml(s.label)}</p>
        <p class="mc-value">${escHtml(String(s.value))}</p>
        <p class="mc-hint">${escHtml(s.hint)}</p>
      </div>`).join("")}
    </div>
  </div>

  <div class="sec">
    <p class="sec-title">Métricas del período</p>
    <div class="g5">
      <div class="mc card-default"><p class="mc-label">Personas</p><p class="mc-value">${total}</p><p class="mc-hint">Dentro del alcance</p></div>
      <div class="mc ${avg >= 4 ? "card-success" : avg >= 3 ? "card-warning" : "card-danger"}"><p class="mc-label">Desempeño</p><p class="mc-value">${avg.toFixed(2)}</p><p class="mc-hint">Promedio / 5.0</p><div class="pb"><div class="pb-fill ${avg >= 4 ? "pb-green" : avg >= 3 ? "pb-amber" : "pb-red"}" style="width:${Math.min(100, (avg/5)*100)}%"></div></div></div>
      <div class="mc ${pending === 0 ? "card-success" : "card-warning"}"><p class="mc-label">Ev. pendientes</p><p class="mc-value">${pending}</p><p class="mc-hint">${evaluationCoverage.pct}% completadas</p><div class="pb"><div class="pb-fill ${evaluationCoverage.pct >= 80 ? "pb-green" : evaluationCoverage.pct >= 50 ? "pb-amber" : "pb-red"}" style="width:${evaluationCoverage.pct}%"></div></div></div>
      <div class="mc ${kpisAtRisk === 0 ? "card-success" : "card-danger"}"><p class="mc-label">Obj. en riesgo</p><p class="mc-value">${kpisAtRisk}</p><p class="mc-hint">KPIs + OKRs</p></div>
      <div class="mc card-default"><p class="mc-label">Planes activos</p><p class="mc-value">${activePlans}</p><p class="mc-hint">De desarrollo</p></div>
    </div>
  </div>

  ${priorityEmployees.length ? `
  <div class="sec" style="break-before:auto">
    <p class="sec-title">Personas que requieren atención (${priorityEmployees.length})</p>
    ${priorityEmployees.slice(0, 8).map(e => {
      const score = e.averageScore || 0;
      const cls = score < 2.5 ? "badge-low" : score < 3.5 ? "badge-mid" : "badge-high";
      return `<div class="person">
        <div>
          <p class="person-name">${escHtml([e.apellido, e.nombre].filter(Boolean).join(", "))}</p>
          <p class="person-sub">${escHtml([e.cargo, e.area].filter(Boolean).join(" · "))}</p>
        </div>
        <span class="badge ${cls}">${score > 0 ? score.toFixed(1) : "—"}</span>
      </div>`;
    }).join("")}
  </div>` : ""}

  ${topPerformers.length ? `
  <div class="sec">
    <p class="sec-title">Top desempeños</p>
    ${topPerformers.map(e => `
    <div class="person">
      <div>
        <p class="person-name">${escHtml([e.apellido, e.nombre].filter(Boolean).join(", "))}</p>
        <p class="person-sub">${escHtml([e.cargo, e.area].filter(Boolean).join(" · "))}</p>
      </div>
      <span class="badge badge-high">${e.averageScore ? e.averageScore.toFixed(1) : "—"}</span>
    </div>`).join("")}
  </div>` : ""}

  ${overviewActions.length ? `
  <div class="sec">
    <p class="sec-title">Acciones recomendadas</p>
    ${overviewActions.slice(0, 8).map(a => `
    <div class="action">
      <span class="pri ${a.severity === "high" ? "pri-high" : a.severity === "medium" ? "pri-med" : "pri-low"}">${a.severity === "high" ? "Alta" : a.severity === "medium" ? "Media" : "Baja"}</span>
      <div>
        <p class="action-desc">${escHtml(a.description || a.title || "")}</p>
        ${a.employeeName ? `<p class="action-emp">${escHtml(a.employeeName)}</p>` : ""}
      </div>
    </div>`).join("")}
  </div>` : ""}

  <div class="ftr">
    <p>Generado por <strong>ZENTOR</strong> · Plataforma de gestión del desempeño</p>
    <p>${date}</p>
  </div>
  <div style="text-align:center;margin:24px 0 8px;print-color-adjust:exact;">
    <button id="print-btn" style="background:#14b8a6;color:#0f172a;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Imprimir / Guardar PDF</button>
  </div>

  <script>document.getElementById("print-btn").addEventListener("click",function(){window.print();});<\/script>
</body>
</html>`;
}

function buildExecutivePdf({ orgName, cycleName, execSummaryLines, execSignals, overview, priorityEmployees, topPerformers, overviewActions, evaluationCoverage, departmentScores }) {
  const date = new Date().toLocaleDateString("es-AR", { dateStyle: "long" });
  const avg = overview?.summary?.averageScore || 0;
  const employeesTotal = overview?.summary?.employeesTotal || 0;
  const coveragePct = evaluationCoverage.pct;
  const activePlans = overview?.development?.active || 0;
  const completedPlans = overview?.development?.completed || 0;
  const overduePlans = overview?.development?.overdue || 0;
  const totalPlans = overview?.development?.total || 0;
  const kpisAtRisk = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);

  // Top 10 performers for slide 4
  const top10 = (overview?.catalogs?.employees || [])
    .filter(e => e.averageScore > 0)
    .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
    .slice(0, 10);

  // Overdue plan employees (priority attention employees with overdue plans)
  const overdueEmployees = (overview?.catalogs?.employees || [])
    .filter(e => (e.overduePlans || 0) > 0)
    .sort((a, b) => (b.overduePlans || 0) - (a.overduePlans || 0))
    .slice(0, 8);

  // Dept rows for slide 3
  const deptRows = (departmentScores || [])
    .filter(d => d.averageScore > 0)
    .sort((a, b) => b.averageScore - a.averageScore);

  const maxDeptScore = Math.max(...deptRows.map(d => d.averageScore), 1);

  function scoreColor(score) {
    if (score >= 4) return "#15803d";
    if (score >= 3) return "#b45309";
    return "#b91c1c";
  }
  function scoreBg(score) {
    if (score >= 4) return "#f0fdf4";
    if (score >= 3) return "#fffbeb";
    return "#fef2f2";
  }
  function scoreBorder(score) {
    if (score >= 4) return "#bbf7d0";
    if (score >= 3) return "#fde68a";
    return "#fecaca";
  }
  function scoreLabel(score) {
    if (score >= 4) return "Destacado";
    if (score >= 3) return "Esperado";
    return "En riesgo";
  }
  function barColor(score) {
    if (score >= 4) return "#22c55e";
    if (score >= 3) return "#f59e0b";
    return "#ef4444";
  }

  // Build next steps based on data
  const nextSteps = [];
  if (coveragePct < 80 && evaluationCoverage.total > 0) {
    nextSteps.push({ icon: "📋", text: `Completar las ${overview?.summary?.evaluationsPending || 0} evaluaciones pendientes para cerrar el ciclo con cobertura total.` });
  }
  if (priorityEmployees.length > 0) {
    nextSteps.push({ icon: "🎯", text: `Agendar reuniones 1:1 con las ${priorityEmployees.length} personas que requieren atención prioritaria antes del cierre del período.` });
  }
  if (kpisAtRisk > 0) {
    nextSteps.push({ icon: "⚠️", text: `Revisar los ${kpisAtRisk} KPI/OKR en riesgo con los managers de cada área e implementar planes de acción correctivos.` });
  }
  if (overduePlans > 0) {
    nextSteps.push({ icon: "🔔", text: `Hacer seguimiento de los ${overduePlans} planes de desarrollo con fecha de revisión vencida.` });
  }
  if (nextSteps.length < 3) {
    nextSteps.push({ icon: "📈", text: `Reconocer y visibilizar los logros del período para reforzar la cultura de desempeño en la organización.` });
  }
  if (nextSteps.length < 4) {
    nextSteps.push({ icon: "🔄", text: `Iniciar el próximo ciclo de evaluación con los aprendizajes de este período como base para la calibración.` });
  }

  const rankEmoji = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

  const slide = (content, last = false) =>
    `<div class="slide${last ? " slide-last" : ""}">${content}</div>`;

  const slideHeader = (label, title) => `
    <div class="slide-header">
      <span class="slide-tag">${escHtml(label)}</span>
      <h2 class="slide-title">${escHtml(title)}</h2>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Ejecutivo de Desempeño — ZENTOR</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 landscape; margin: 1.5cm; }
    body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #0f172a; font-size: 10pt; line-height: 1.5; }

    /* Slide shell */
    .slide { width: 100%; min-height: 17.5cm; page-break-after: always; display: flex; flex-direction: column; }
    .slide-last { page-break-after: avoid; }

    /* Slide 1 — Cover */
    .cover { background: #060f14; color: #fff; justify-content: center; align-items: center; padding: 2cm 2.5cm; text-align: center; position: relative; overflow: hidden; }
    .cover::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 70% 30%, rgba(20,184,166,0.18) 0%, transparent 65%); pointer-events: none; }
    .cover-logo { font-size: 52pt; font-weight: 900; letter-spacing: -3px; color: #fff; line-height: 1; }
    .cover-logo span { color: #14b8a6; }
    .cover-tagline { font-size: 11pt; color: #94a3b8; margin-top: 6px; letter-spacing: 0.15em; text-transform: uppercase; }
    .cover-title { font-size: 22pt; font-weight: 700; color: #fff; margin-top: 32px; line-height: 1.25; }
    .cover-subtitle { font-size: 13pt; color: #14b8a6; font-weight: 500; margin-top: 10px; }
    .cover-meta { margin-top: 36px; display: flex; gap: 32px; justify-content: center; }
    .cover-meta-item { text-align: center; }
    .cover-meta-item .label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
    .cover-meta-item .value { font-size: 10pt; color: #e2e8f0; font-weight: 500; margin-top: 3px; }
    .cover-line { width: 80px; height: 3px; background: linear-gradient(90deg, #14b8a6, #38bdf8); border-radius: 2px; margin: 28px auto 0; }

    /* Slide header */
    .slide-header { margin-bottom: 18px; }
    .slide-tag { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #14b8a6; display: block; margin-bottom: 4px; }
    .slide-title { font-size: 18pt; font-weight: 800; color: #0f172a; line-height: 1.2; }

    /* Common slide padding */
    .slide-body { flex: 1; display: flex; flex-direction: column; padding: 0; }

    /* Footer strip */
    .slide-footer { margin-top: auto; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #94a3b8; }
    .slide-footer strong { color: #14b8a6; }

    /* Grids */
    .g2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

    /* Stat cards */
    .sc { border-radius: 12px; border: 1.5px solid #e2e8f0; padding: 14px 16px; background: #f8fafc; }
    .sc-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.13em; color: #94a3b8; }
    .sc-value { font-size: 26pt; font-weight: 900; line-height: 1; margin: 8px 0 4px; color: #0f172a; }
    .sc-hint { font-size: 8pt; color: #64748b; }
    .sc-success { border-color: #bbf7d0; background: #f0fdf4; }
    .sc-success .sc-value { color: #15803d; }
    .sc-warning { border-color: #fde68a; background: #fffbeb; }
    .sc-warning .sc-value { color: #b45309; }
    .sc-danger { border-color: #fecaca; background: #fef2f2; }
    .sc-danger .sc-value { color: #b91c1c; }
    .sc-teal { border-color: #99f6e4; background: #f0fdfa; }
    .sc-teal .sc-value { color: #0d9488; }

    /* Progress bar */
    .pb { height: 5px; border-radius: 4px; background: #e2e8f0; margin-top: 9px; overflow: hidden; }
    .pb-fill { height: 100%; border-radius: 4px; }

    /* Executive summary block */
    .exec-summary p { font-size: 10.5pt; color: #334155; margin-bottom: 6px; line-height: 1.7; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; text-align: left; padding: 6px 10px; border-bottom: 2px solid #f1f5f9; background: #f8fafc; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f8fafc; }

    /* Medal row highlights */
    .rank-gold td { background: #fffbeb !important; }
    .rank-silver td { background: #f8fafc !important; }
    .rank-bronze td { background: #fff7ed !important; }

    /* Rank badge */
    .rank-badge { font-size: 13pt; line-height: 1; }

    /* Score pill */
    .spill { display: inline-block; font-size: 9pt; font-weight: 700; padding: 2px 10px; border-radius: 99px; }

    /* Area bar row */
    .area-bar { height: 8px; border-radius: 4px; background: #e2e8f0; overflow: hidden; margin-top: 4px; }
    .area-bar-fill { height: 100%; border-radius: 4px; }

    /* Plan summary pills */
    .plan-pill { border-radius: 10px; padding: 12px 18px; text-align: center; border: 1.5px solid; }
    .plan-pill .pp-num { font-size: 28pt; font-weight: 900; line-height: 1; }
    .plan-pill .pp-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px; }

    /* Next step rows */
    .next-step { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .next-step:last-child { border-bottom: none; }
    .next-step-icon { font-size: 16pt; line-height: 1; flex-shrink: 0; width: 28px; }
    .next-step-text { font-size: 10pt; color: #334155; line-height: 1.6; }

    /* Closing branding block */
    .closing-brand { background: #060f14; border-radius: 14px; padding: 28px 36px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
    .closing-brand .logo { font-size: 32pt; font-weight: 900; letter-spacing: -2px; color: #fff; }
    .closing-brand .logo span { color: #14b8a6; }
    .closing-brand .tagline { font-size: 9pt; color: #64748b; margin-top: 4px; }
    .closing-brand .contact { text-align: right; font-size: 9pt; color: #94a3b8; }
    .closing-brand .contact strong { color: #14b8a6; display: block; font-size: 11pt; }

    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>

${slide(`
  <div class="cover slide-body">
    <div class="cover-logo">ZEN<span>TOR</span></div>
    <div class="cover-tagline">Plataforma de gestión del desempeño</div>
    <div class="cover-title">Reporte Ejecutivo de Desempeño</div>
    ${orgName ? `<div class="cover-subtitle">${escHtml(orgName)}</div>` : ""}
    <div class="cover-line"></div>
    <div class="cover-meta">
      ${cycleName ? `<div class="cover-meta-item"><div class="label">Período</div><div class="value">${escHtml(cycleName)}</div></div>` : ""}
      <div class="cover-meta-item"><div class="label">Generado el</div><div class="value">${date}</div></div>
      ${employeesTotal > 0 ? `<div class="cover-meta-item"><div class="label">Alcance</div><div class="value">${employeesTotal.toLocaleString("es-AR")} personas</div></div>` : ""}
    </div>
  </div>
`, false)}

${slide(`
  <div class="slide-body">
    ${slideHeader("Slide 2 de 6", "Resumen ejecutivo")}
    <div class="g4" style="margin-bottom:18px">
      <div class="sc ${avg >= 4 ? "sc-success" : avg >= 3 ? "sc-warning" : avg > 0 ? "sc-danger" : ""}">
        <div class="sc-label">Promedio general</div>
        <div class="sc-value">${avg > 0 ? avg.toFixed(2) : "—"}</div>
        <div class="sc-hint">Escala 1 – 5</div>
        ${avg > 0 ? `<div class="pb"><div class="pb-fill" style="width:${(avg/5)*100}%;background:${barColor(avg)}"></div></div>` : ""}
      </div>
      <div class="sc sc-teal">
        <div class="sc-label">Empleados evaluados</div>
        <div class="sc-value">${employeesTotal}</div>
        <div class="sc-hint">Dentro del alcance</div>
      </div>
      <div class="sc ${coveragePct >= 80 ? "sc-success" : coveragePct >= 50 ? "sc-warning" : "sc-danger"}">
        <div class="sc-label">Completado</div>
        <div class="sc-value">${coveragePct}%</div>
        <div class="sc-hint">${evaluationCoverage.completed} de ${evaluationCoverage.total} ev.</div>
        <div class="pb"><div class="pb-fill" style="width:${coveragePct}%;background:${coveragePct >= 80 ? "#22c55e" : coveragePct >= 50 ? "#f59e0b" : "#ef4444"}"></div></div>
      </div>
      <div class="sc ${overduePlans > 0 ? "sc-warning" : ""}">
        <div class="sc-label">Planes activos</div>
        <div class="sc-value">${activePlans}</div>
        <div class="sc-hint">${overduePlans} vencidos · ${completedPlans} completados</div>
      </div>
    </div>
    ${execSummaryLines.length ? `<div class="exec-summary">${execSummaryLines.map(l => `<p>${escHtml(l)}</p>`).join("")}</div>` : ""}
    <div class="slide-footer">
      <p>Generado por <strong>ZENTOR</strong> · Plataforma de gestión del desempeño</p>
      <p>${date}</p>
    </div>
  </div>
`, false)}

${slide(`
  <div class="slide-body">
    ${slideHeader("Slide 3 de 6", "Distribución por área")}
    ${deptRows.length ? `
    <table>
      <thead>
        <tr>
          <th>Área</th>
          <th style="width:80px;text-align:center">Empleados</th>
          <th style="width:180px">Promedio</th>
          <th style="width:100px;text-align:center">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${deptRows.map(d => `
        <tr>
          <td style="font-weight:600;color:#0f172a">${escHtml(d.name)}</td>
          <td style="text-align:center">${d.count}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="area-bar" style="flex:1">
                <div class="area-bar-fill" style="width:${Math.round((d.averageScore / maxDeptScore) * 100)}%;background:${barColor(d.averageScore)}"></div>
              </div>
              <span style="font-weight:700;color:${scoreColor(d.averageScore)};min-width:28px;text-align:right">${d.averageScore.toFixed(1)}</span>
            </div>
          </td>
          <td style="text-align:center">
            <span class="spill" style="background:${scoreBg(d.averageScore)};color:${scoreColor(d.averageScore)};border:1px solid ${scoreBorder(d.averageScore)}">${scoreLabel(d.averageScore)}</span>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>` : `<p style="color:#64748b;font-style:italic">No hay datos de área disponibles para el alcance seleccionado.</p>`}
    <div class="slide-footer" style="margin-top:auto">
      <p>Generado por <strong>ZENTOR</strong> · Plataforma de gestión del desempeño</p>
      <p>${date}</p>
    </div>
  </div>
`, false)}

${slide(`
  <div class="slide-body">
    ${slideHeader("Slide 4 de 6", "Top performers del período")}
    ${top10.length ? `
    <table>
      <thead>
        <tr>
          <th style="width:36px"></th>
          <th>Nombre</th>
          <th>Cargo</th>
          <th>Área</th>
          <th style="width:90px;text-align:center">Promedio</th>
        </tr>
      </thead>
      <tbody>
        ${top10.map((e, i) => `
        <tr class="${i === 0 ? "rank-gold" : i === 1 ? "rank-silver" : i === 2 ? "rank-bronze" : ""}">
          <td style="text-align:center"><span class="rank-badge">${rankEmoji(i)}</span></td>
          <td style="font-weight:${i < 3 ? "700" : "500"};color:#0f172a">${escHtml(e.fullName || [e.apellido, e.nombre].filter(Boolean).join(", "))}</td>
          <td style="color:#475569">${escHtml(e.cargo || "—")}</td>
          <td style="color:#475569">${escHtml(e.area || "—")}</td>
          <td style="text-align:center">
            <span class="spill" style="background:${scoreBg(e.averageScore)};color:${scoreColor(e.averageScore)};border:1px solid ${scoreBorder(e.averageScore)}">${e.averageScore.toFixed(1)}</span>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>` : `<p style="color:#64748b;font-style:italic">No hay datos de desempeño disponibles.</p>`}
    <div class="slide-footer" style="margin-top:auto">
      <p>Generado por <strong>ZENTOR</strong> · Plataforma de gestión del desempeño</p>
      <p>${date}</p>
    </div>
  </div>
`, false)}

${slide(`
  <div class="slide-body">
    ${slideHeader("Slide 5 de 6", "Planes de desarrollo")}
    <div class="g3" style="margin-bottom:20px">
      <div class="plan-pill" style="background:#f0fdfa;border-color:#99f6e4;color:#0d9488">
        <div class="pp-num">${activePlans}</div>
        <div class="pp-label">Activos</div>
      </div>
      <div class="plan-pill" style="background:#f0fdf4;border-color:#bbf7d0;color:#15803d">
        <div class="pp-num">${completedPlans}</div>
        <div class="pp-label">Completados</div>
      </div>
      <div class="plan-pill" style="background:${overduePlans > 0 ? "#fffbeb" : "#f8fafc"};border-color:${overduePlans > 0 ? "#fde68a" : "#e2e8f0"};color:${overduePlans > 0 ? "#b45309" : "#475569"}">
        <div class="pp-num">${overduePlans}</div>
        <div class="pp-label">Vencidos</div>
      </div>
    </div>
    ${overdueEmployees.length ? `
    <div style="margin-bottom:8px">
      <p style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#b45309;margin-bottom:8px">Personas con planes vencidos</p>
      <table>
        <thead>
          <tr>
            <th>Persona</th>
            <th>Área</th>
            <th style="width:100px;text-align:center">Planes vencidos</th>
            <th style="width:90px;text-align:center">Score</th>
          </tr>
        </thead>
        <tbody>
          ${overdueEmployees.map(e => `
          <tr>
            <td style="font-weight:600;color:#0f172a">${escHtml(e.fullName || [e.apellido, e.nombre].filter(Boolean).join(", "))}</td>
            <td style="color:#475569">${escHtml(e.area || "—")}</td>
            <td style="text-align:center;color:#b45309;font-weight:700">${e.overduePlans}</td>
            <td style="text-align:center">${e.averageScore > 0 ? `<span class="spill" style="background:${scoreBg(e.averageScore)};color:${scoreColor(e.averageScore)};border:1px solid ${scoreBorder(e.averageScore)}">${e.averageScore.toFixed(1)}</span>` : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : overduePlans === 0 ? `<p style="color:#15803d;font-weight:500">✓ No hay planes con seguimiento vencido.</p>` : ""}
    <div class="slide-footer" style="margin-top:auto">
      <p>Generado por <strong>ZENTOR</strong> · Plataforma de gestión del desempeño</p>
      <p>${date}</p>
    </div>
  </div>
`, false)}

${slide(`
  <div class="slide-body">
    ${slideHeader("Slide 6 de 6", "Próximos pasos recomendados")}
    <div style="max-width:620px">
      ${nextSteps.slice(0, 4).map(s => `
      <div class="next-step">
        <div class="next-step-icon">${s.icon}</div>
        <div class="next-step-text">${escHtml(s.text)}</div>
      </div>`).join("")}
    </div>
    <div class="closing-brand">
      <div>
        <div class="logo">ZEN<span>TOR</span></div>
        <div class="tagline">Plataforma de gestión del desempeño</div>
      </div>
      <div class="contact">
        <strong>zentor.app</strong>
        ${orgName ? escHtml(orgName) : ""}
      </div>
    </div>
  </div>
`, true)}
<div style="text-align:center;margin:32px 0 12px;print-color-adjust:exact;">
  <button id="print-btn" style="background:#14b8a6;color:#0f172a;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Imprimir / Guardar PDF</button>
</div>

<script>document.getElementById("print-btn").addEventListener("click",function(){window.print();});<\/script>
</body>
</html>`;
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function SurfaceCard({ title, subtitle, actions, children }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[#7a98a8]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint, tone = "default", progress, compact, onClick }) {
  const animated = useCountUp(typeof value === "number" ? value : Number(value));
  const display = Number.isFinite(Number(value)) ? animated : value;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (progress === undefined) return;
    const t = setTimeout(() => setBarWidth(Math.min(100, Math.max(0, progress))), 80);
    return () => clearTimeout(t);
  }, [progress]);

  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-gradient-to-br from-emerald-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(34,197,94,0.08)]"
      : tone === "warning"
        ? "border-amber-300/20 bg-gradient-to-br from-amber-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(251,191,36,0.08)]"
        : tone === "danger"
          ? "border-rose-300/20 bg-gradient-to-br from-rose-500/12 to-[#0c1920] shadow-[0_4px_20px_rgba(239,68,68,0.08)] alert-pulse"
          : "border-white/[0.09] bg-gradient-to-b from-[#162c39] to-[#0f2028]";

  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card-lift rounded-2xl border p-4 text-left w-full ${toneClass} ${compact ? "!p-3" : ""} ${onClick ? "cursor-pointer" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className={`stat-num font-semibold text-white ${compact ? "mt-1 text-xl" : "mt-2 text-2xl"}`}>{display}</p>
      {hint ? <p className="mt-1.5 text-xs text-[#9ab0bc]">{hint}</p> : null}
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${progress >= 80 ? "bg-emerald-400" : progress >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
            style={{ width: `${barWidth}%`, transition: "width 800ms cubic-bezier(0.4,0,0.2,1)" }}
          />
        </div>
      ) : null}
    </Tag>
  );
}

function EmptyPanel({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#122530] px-5 py-6 text-sm text-[#9fb6c4]">
      {text}
    </div>
  );
}

function ActionBadge({ severity }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityTone[severity] || severityTone.low}`}>
      {severity === "high" ? "Alta" : severity === "medium" ? "Media" : "Baja"}
    </span>
  );
}

function ProgressBar({ value, max = 100, tone, label, showPct }) {
  const pctVal = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const gradient = tone
    ? null
    : pctVal >= 80
      ? "from-emerald-400 to-teal-500"
      : pctVal >= 50
        ? "from-amber-400 to-orange-500"
        : "from-rose-400 to-rose-600";
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-[#9fb6c4]">
          <span>{label}</span>
          {showPct ? <span className="font-semibold text-white">{Math.round(pctVal)}%</span> : null}
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${tone || `bg-gradient-to-r ${gradient}`}`}
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  );
}

function MiniBarChart({ title, items, emptyText = "Sin datos para mostrar.", onBarClick }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 0);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(null);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-3">
        {items.some((item) => Number(item.value || 0) > 0) ? (
          items.map((item) => {
            const pct = maxValue > 0 ? Math.max(4, Math.round((Number(item.value || 0) / maxValue) * 100)) : 0;
            const isHov = hovered === item.label;
            return (
              <div
                key={item.label}
                role={onBarClick ? "button" : undefined}
                tabIndex={onBarClick ? 0 : undefined}
                onClick={() => onBarClick?.(item)}
                onMouseEnter={() => setHovered(item.label)}
                onMouseLeave={() => setHovered(null)}
                className={onBarClick ? "cursor-pointer" : ""}
              >
                <div className={`mb-1.5 flex items-center justify-between gap-3 text-xs transition-colors ${isHov ? "text-white" : "text-[#9fb6c4]"}`}>
                  <span className="truncate">{item.label}</span>
                  <span className={`shrink-0 font-bold tabular-nums transition-colors ${isHov ? "text-[#14b8a6]" : "text-white"}`}>{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${item.tone || "bg-gradient-to-r from-[#14b8a6] to-[#38bdf8]"}`}
                    style={{ width: mounted ? `${pct}%` : "0%", transition: "width 700ms cubic-bezier(0.4,0,0.2,1)" }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[#8fa9b7]">{emptyText}</p>
        )}
      </div>
    </article>
  );
}

function MiniDonut({ value, total, label, gradientId, colorStart = "#14b8a6", colorEnd = "#38bdf8", size = 72 }) {
  const safeTotal = Math.max(1, total);
  const pctVal = Math.min(100, Math.max(0, (value / safeTotal) * 100));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimPct(pctVal), 80); return () => clearTimeout(t); }, [pctVal]);
  const offset = circumference - (animPct / 100) * circumference;
  const gId = gradientId || `donutGrad-${label}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 48 48" className="-rotate-90">
          <defs>
            <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colorStart} />
              <stop offset="100%" stopColor={colorEnd} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4.5" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={`url(#${gId})`}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">{Math.round(pctVal)}%</span>
        </div>
      </div>
      <span className="text-center text-xs leading-tight text-[#9fb6c4]">{label}</span>
    </div>
  );
}

function mapActionDestination(action) {
  const text = `${action?.key || ""} ${action?.title || ""} ${action?.description || ""}`.toLowerCase();
  if (text.includes("evalu")) return "evaluaciones";
  if (text.includes("manager") || text.includes("persona") || text.includes("emplead")) return "empleados";
  if (text.includes("plan") || text.includes("desarrollo")) return "planes";
  if (text.includes("ciclo")) return "ciclos";
  return "";
}

function buildGeneralActionSummary(actions = []) {
  return {
    high: actions.filter((item) => item.severity === "high").length,
    medium: actions.filter((item) => item.severity === "medium").length,
    low: actions.filter((item) => item.severity === "low").length,
  };
}

function buildEvaluationTypeChart(evaluations = []) {
  const auto = evaluations.filter((item) => item.tipo === "AUTOEVALUACION").map((item) => item.resultadoFinal);
  const manager = evaluations.filter((item) => item.tipo === "JEFATURA").map((item) => item.resultadoFinal);
  const final = evaluations.filter((item) => item.tipo === "FINAL").map((item) => item.resultadoFinal);
  return [
    { label: "Autoevaluación", value: Number((average(auto) || 0).toFixed(1)), tone: "bg-sky-400" },
    { label: "Superior", value: Number((average(manager) || 0).toFixed(1)), tone: "bg-emerald-400" },
    { label: "Cierre final", value: Number((average(final) || 0).toFixed(1)), tone: "bg-violet-400" },
  ];
}

function buildMetricSignalRows(metricSignals = []) {
  return metricSignals
    .slice()
    .sort((left, right) => Number(right.averageScore || 0) - Number(left.averageScore || 0))
    .slice(0, 8)
    .map((item) => ({
      label: item.competencyName || item.metricName || "Competencia",
      value: Number(item.averageScore || 0),
      scoreCount: item.scoreCount,
      tone: "bg-sky-400",
    }));
}

// ─── Premium chart components ──────────────────────────────────────────────────

function SkillRadarChart({ metricSignals = [] }) {
  const data = metricSignals.slice(0, 8).map(s => ({
    subject: (s.competencyName || s.metricName || "").slice(0, 16),
    score: Number((s.averageScore || 0).toFixed(1)),
    fullMark: 5,
  }));
  if (!data.length || !data.some(d => d.score > 0)) {
    return <div className="flex h-full items-center justify-center text-sm text-[#7a9aaa]">Sin datos de habilidades.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
        <defs>
          <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.04} />
          </radialGradient>
        </defs>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#9fb6c4" }} />
        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} tickCount={6} />
        <Radar name="Puntaje" dataKey="score" stroke="#14b8a6" strokeWidth={2} fill="url(#radarFill)" dot={{ fill: "#14b8a6", r: 3, strokeWidth: 0 }} animationDuration={700} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="rounded-xl border border-white/15 bg-[#0b1d27] px-3 py-2 text-xs shadow-xl">
              <p className="font-semibold text-white">{payload[0]?.payload?.subject}</p>
              <p className="mt-0.5 text-[#14b8a6]">{payload[0]?.value} / 5</p>
            </div>
          );
        }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ScoreBand({ band }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (mounted ? band.pct / 100 : 0) * circ;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border p-4 transition" style={{ background: band.bg, borderColor: band.border }}>
      <div className="relative h-[72px] w-[72px]">
        <svg viewBox="0 0 72 72" className="-rotate-90 h-full w-full">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
          <circle cx="36" cy="36" r={radius} fill="none" stroke={band.color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 950ms cubic-bezier(0.4,0,0.2,1)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold leading-none text-white">{band.count}</span>
          <span className="text-[10px] text-[#9fb6c4]">{band.pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-white">{band.label}</p>
        <p className="text-[10px] text-[#7a9aaa]">{band.range}</p>
      </div>
    </div>
  );
}

function ScoreDistributionPanel({ employees = [] }) {
  const bands = useMemo(() => {
    const b = [
      { label: "Insuficiente", range: "1–2", minV: 0,    maxV: 2.005, color: "#f43f5e", bg: "rgba(244,63,94,0.10)",    border: "rgba(244,63,94,0.25)",   count: 0, pct: 0 },
      { label: "En desarrollo", range: "2–3", minV: 2.005, maxV: 3.005, color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.25)",  count: 0, pct: 0 },
      { label: "Esperado",     range: "3–4", minV: 3.005, maxV: 4.005, color: "#facc15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)",   count: 0, pct: 0 },
      { label: "Destacado",    range: "4–5", minV: 4.005, maxV: 5.01,  color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)",  count: 0, pct: 0 },
    ];
    const scored = employees.filter(e => e.averageScore > 0);
    scored.forEach(e => {
      const band = b.find(bnd => e.averageScore >= bnd.minV - 0.005 && e.averageScore < bnd.maxV);
      if (band) band.count++;
    });
    const total = scored.length || 1;
    b.forEach(bnd => { bnd.pct = Math.round((bnd.count / total) * 100); });
    return b;
  }, [employees]);
  if (!employees.some(e => e.averageScore > 0)) return <p className="text-sm text-[#7a9aaa]">Sin datos de puntaje todavía.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {bands.map(band => <ScoreBand key={band.label} band={band} />)}
    </div>
  );
}

function TeamScatterPlot({ employees = [] }) {
  const data = employees.filter(e => e.averageScore > 0).map(e => ({
    x: Number(e.averageScore.toFixed(2)),
    y: Number(e.planCount || 0),
    name: e.fullName,
    area: e.area || "",
  }));
  if (!data.length) return <p className="text-sm text-[#7a9aaa]">Sin datos suficientes.</p>;
  const getColor = x => x >= 4 ? "#34d399" : x >= 3 ? "#facc15" : "#f43f5e";
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 28, left: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" dataKey="x" domain={[0, 5]} name="Puntaje" tick={{ fontSize: 11, fill: "#8fa9b7" }} tickLine={false} axisLine={false} label={{ value: "Puntaje promedio", position: "insideBottom", offset: -14, fill: "#7a9aaa", fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name="Planes" allowDecimals={false} tick={{ fontSize: 11, fill: "#8fa9b7" }} tickLine={false} axisLine={false} width={28} label={{ value: "Planes", angle: -90, position: "insideLeft", fill: "#7a9aaa", fontSize: 10 }} />
        <ZAxis range={[55, 55]} />
        <Tooltip cursor={false} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          return (
            <div className="rounded-xl border border-white/15 bg-[#0b1d27] px-3 py-2 text-xs shadow-xl">
              <p className="font-semibold text-white">{d.name}</p>
              {d.area ? <p className="text-[#9fb6c4]">{d.area}</p> : null}
              <div className="mt-1 flex gap-3">
                <span className="text-[#14b8a6]">Puntaje: <b>{d.x}</b></span>
                <span className="text-[#a78bfa]">Planes: <b>{d.y}</b></span>
              </div>
            </div>
          );
        }} />
        <Scatter data={data} shape={({ cx, cy, payload }) => (
          <circle cx={cx} cy={cy} r={6} fill={getColor(payload.x)} fillOpacity={0.85} stroke={getColor(payload.x)} strokeWidth={1.5} />
        )} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function NineBoxCell({ label, sublabel, employees, color }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 p-2.5 min-h-[72px]" style={{ background: `${color}10`, borderColor: `${color}30` }}>
      <p className="text-[10px] font-semibold leading-tight" style={{ color }}>{label}</p>
      <p className="text-[9px] text-[#7a9aaa] leading-tight">{sublabel}</p>
      <div className="mt-auto flex flex-wrap gap-1">
        {employees.slice(0, 4).map((e, i) => (
          <span key={i} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ background: `${color}25` }} title={e.fullName}>
            {(e.fullName || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        ))}
        {employees.length > 4 ? <span className="text-[9px] text-[#7a9aaa]">+{employees.length - 4}</span> : null}
      </div>
    </div>
  );
}

function NineBoxGrid({ employees = [] }) {
  const scored = employees.filter(e => e.averageScore > 0);
  if (scored.length < 2) return <p className="text-sm text-[#7a9aaa]">Se necesitan al menos 2 personas con puntaje para mostrar el mapa.</p>;
  const maxEvals = Math.max(...scored.map(e => e.evaluationCount || 0), 1);
  const placed = scored.map(e => ({
    ...e,
    perfScore: e.averageScore,
    growthScore: ((e.evaluationCount || 0) / maxEvals) * 5,
  }));
  const cell = (pMin, pMax, gMin, gMax) => placed.filter(e => e.perfScore >= pMin && e.perfScore < pMax && e.growthScore >= gMin && e.growthScore < gMax);
  const cellAll = (pMin, pMax, gMin, gMax) => {
    const arr = placed.filter(e => {
      const p = e.perfScore >= pMin && (pMax === 5 ? e.perfScore <= 5 : e.perfScore < pMax);
      const g = e.growthScore >= gMin && (gMax === 5 ? e.growthScore <= 5 : e.growthScore < gMax);
      return p && g;
    });
    return arr;
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-xs text-[#7a9aaa]">
          <span>↑ Potencial (participación)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#7a9aaa]">
          <span>Desempeño →</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { pMin:0, pMax:2, gMin:3.33, gMax:5,   label:"Enigma",        sub:"Alto potencial,\nbajo desempeño",    color:"#a78bfa" },
          { pMin:2, pMax:3.5, gMin:3.33, gMax:5,  label:"En desarrollo",  sub:"Potencial y perf.\ncreciendo",     color:"#38bdf8" },
          { pMin:3.5,pMax:5, gMin:3.33, gMax:5,   label:"⭐ Estrella",    sub:"Rendimiento y\npotencial altos",   color:"#14b8a6" },
          { pMin:0, pMax:2, gMin:1.66, gMax:3.33, label:"Bajo riesgo",    sub:"Necesita apoyo\nactivo",            color:"#f43f5e" },
          { pMin:2, pMax:3.5, gMin:1.66, gMax:3.33,label:"Núcleo",        sub:"Confiable, estable",               color:"#facc15" },
          { pMin:3.5,pMax:5, gMin:1.66, gMax:3.33, label:"Alto desempeño",sub:"Sólido, puede crecer\nmás",        color:"#34d399" },
          { pMin:0, pMax:2, gMin:0, gMax:1.66,    label:"Riesgo crítico", sub:"Bajo en ambos\nejes",              color:"#fb923c" },
          { pMin:2, pMax:3.5, gMin:0, gMax:1.66,  label:"Aprendiz",      sub:"Bajo engagement,\npotencial medio", color:"#94a3b8" },
          { pMin:3.5,pMax:5, gMin:0, gMax:1.66,   label:"Experto",       sub:"Gran desempeño,\nbajo engagement",  color:"#818cf8" },
        ].map(c => <NineBoxCell key={c.label} label={c.label} sublabel={c.sub} employees={cellAll(c.pMin, c.pMax, c.gMin, c.gMax)} color={c.color} />)}
      </div>
      <p className="mt-2 text-[10px] text-[#5e7d8e]">Potencial estimado a partir de participación en evaluaciones. El eje X refleja el puntaje promedio.</p>
    </div>
  );
}

function KpiCard({ item }) {
  const progress = item.targetValue > 0 ? pct(item.currentValue, item.targetValue) : 0;
  const tone = progress >= 80 ? "bg-emerald-500/10 border-emerald-300/20" :
    progress >= 50 ? "bg-amber-500/10 border-amber-300/20" :
    "bg-rose-500/10 border-rose-300/20";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white leading-snug">{item.name}</p>
        <span className="whitespace-nowrap rounded-full border border-white/10 bg-[#122530] px-2 py-0.5 text-[10px] text-[#d8e4ea]">{item.status || "activo"}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white">{safeNum(item.currentValue, "-")}</span>
        <span className="text-sm text-[#9fb6c4]">/ {safeNum(item.targetValue, "-")} {item.unit || ""}</span>
      </div>
      <ProgressBar value={progress} />
    </article>
  );
}

function OkrCard({ item }) {
  const progress = item.targetValue > 0 ? pct(item.currentValue, item.targetValue) : 0;
  const tone = progress >= 80 ? "bg-emerald-500/10 border-emerald-300/20" :
    progress >= 50 ? "bg-amber-500/10 border-amber-300/20" :
    "bg-rose-500/10 border-rose-300/20";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">{item.objectiveTitle}</p>
      <p className="mt-1 text-sm font-semibold text-white leading-snug">{item.keyResultTitle}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-white">{safeNum(item.currentValue, "-")}</span>
        <span className="text-xs text-[#9fb6c4]">/ {safeNum(item.targetValue, "-")}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${progress >= 80 ? "bg-emerald-400" : progress >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
    </article>
  );
}

class ReportErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || "Error inesperado" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[2rem] border border-rose-300/20 bg-rose-500/5 p-10 text-center">
          <p className="text-lg font-semibold text-rose-200">Error al cargar el reporte</p>
          <p className="mt-2 text-sm text-rose-300/70">{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="mt-5 rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a]"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ExecutiveReportPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const { setView, searchQuery } = useView();
  const [activeTab, setActiveTab] = useState("general");

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return { cycleId: parsed.cycleId || "", department: parsed.department || "", employeeId: parsed.employeeId || "" };
      }
    } catch (_) { /* ignore */ }
    return { cycleId: "", department: "", employeeId: "" };
  });
  const [draftFilters, setDraftFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return { cycleId: parsed.cycleId || "", department: parsed.department || "", employeeId: parsed.employeeId || "" };
      }
    } catch (_) { /* ignore */ }
    return { cycleId: "", department: "", employeeId: "" };
  });
  const filtersRef = useRef(filters);

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [personaSearch, setPersonaSearch] = useState("");
  const [personaFilterArea, setPersonaFilterArea] = useState("");
  const [selectedGrafTabs, setSelectedGrafTabs] = useState(new Set([0]));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const detailRef = useRef(null);
  const pendingDetailScrollRef = useRef(false);
  const filterDebounceRef = useRef(null);

  const canViewExecutive =
    user?.isSuperAdmin ||
    user?.permisos?.includes("view_reports") ||
    user?.permisos?.includes("download_reports") ||
    user?.permisos?.includes("download_team_reports") ||
    user?.permisos?.includes("view_audit");

  const isEmployee = isEmployeeUser(user);

  const scrollDetailIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // Mark onboarding "visited reports" step as done
  useEffect(() => {
    localStorage.setItem("onboarding_visited_reports", "true");
  }, []);

  const ANALYTICS_TABS = ["personas", "por-nivel", "comparativo", "radar", "recomendaciones", "estructura"];
  useEffect(() => {
    if (!ANALYTICS_TABS.includes(activeTab) || !token || !canViewExecutive) return;
    if (analyticsData || loadingAnalytics) return;
    setLoadingAnalytics(true);
    apiFetch(`/reports/analytics${filters.cycleId ? `?cycleId=${filters.cycleId}` : ""}`, { token })
      .then((d) => { if (d?.ok !== false) setAnalyticsData(d); })
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [activeTab, analyticsData, loadingAnalytics, token, canViewExecutive, filters.cycleId]);

  useEffect(() => {
    if (activeTab !== "dashboard" || !token || !canViewExecutive) return;
    if (summaryData || loadingSummary) return;
    setLoadingSummary(true);
    apiFetch(`/reports/summary${filters.cycleId ? `?cycleId=${filters.cycleId}` : ""}`, { token })
      .then((d) => { if (d?.ok !== false) setSummaryData(d); })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [activeTab, summaryData, loadingSummary, token, canViewExecutive, filters.cycleId]);

  const loadOverview = useCallback(async () => {
    if (!token || !canViewExecutive || isEmployee) return;
    try {
      setLoadingOverview(true);
      setError("");
      const f = filtersRef.current;
      const params = new URLSearchParams();
      if (f.cycleId) params.set("cycleId", f.cycleId);
      if (f.department) params.set("department", f.department);
      if (f.employeeId) params.set("employeeId", f.employeeId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch(`/reports/executive/overview${query}`, { token, timeoutMs: 30000 });
      setOverview(data);

      // Only sync the server-resolved cycleId once (first load when cycleId is empty).
      // Never update draftFilters from here — that would trigger the debounce and re-fire loadOverview.
      const serverCycleId = data?.filters?.selectedCycleId || "";
      if (serverCycleId && !f.cycleId) {
        setFilters((current) => current.cycleId ? current : { ...current, cycleId: serverCycleId });
        setDraftFilters((current) => current.cycleId ? current : { ...current, cycleId: serverCycleId });
      }

      if (!selectedEmployeeId) {
        setDetail(null);
      }
    } catch (nextError) {
      setOverview(null);
      setDetail(null);
      setError(nextError.message);
    } finally {
      setLoadingOverview(false);
    }
  }, [canViewExecutive, isEmployee, token]);

  const loadEmployeeDetail = useCallback(
    async (currentEmployeeId) => {
      if (!token || !currentEmployeeId || !canViewExecutive || isEmployee) return;
      try {
        setLoadingDetail(true);
        setError("");
        const params = new URLSearchParams();
        if (filters.cycleId) params.set("cycleId", filters.cycleId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await apiFetch(`/reports/executive/employees/${currentEmployeeId}${query}`, {
          token,
          timeoutMs: 30000,
        });
        setDetail(data);
        if (pendingDetailScrollRef.current) {
          pendingDetailScrollRef.current = false;
          scrollDetailIntoView();
        }
      } catch (nextError) {
        setDetail(null);
        setError(nextError.message);
        pendingDetailScrollRef.current = false;
      } finally {
        setLoadingDetail(false);
      }
    },
    [canViewExecutive, filters.cycleId, isEmployee, scrollDetailIntoView, token]
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeDetail(selectedEmployeeId);
    } else {
      setDetail(null);
    }
  }, [loadEmployeeDetail, selectedEmployeeId]);

  const employees = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((employee) =>
      [employee.fullName, employee.cargo, employee.area]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [overview?.catalogs?.employees, searchQuery]);

  const cycles = overview?.catalogs?.cycles || [];
  const departments = overview?.catalogs?.departments || [];
  const selectedEmployee =
    detail?.employee ||
    employees.find((employee) => employee._id === selectedEmployeeId) ||
    overview?.selectedEmployee ||
    null;

  const focusEmployeeDetail = useCallback(
    (employeeId, options = {}) => {
      if (!employeeId) return;
      const { activateTab = true } = options;
      if (activateTab) {
        setActiveTab("individual");
      }
      setDraftFilters((current) => (current.employeeId === employeeId ? current : { ...current, employeeId }));
      if (selectedEmployeeId === employeeId) {
        pendingDetailScrollRef.current = false;
        scrollDetailIntoView();
        return;
      }
      pendingDetailScrollRef.current = true;
      setSelectedEmployeeId(employeeId);
    },
    [scrollDetailIntoView, selectedEmployeeId]
  );

  useEffect(() => {
    clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      filtersRef.current = { ...draftFilters };
      setFilters({ ...draftFilters });
      try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(draftFilters)); } catch (_) { /* ignore */ }
      loadOverview();
    }, 300);
    return () => clearTimeout(filterDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFilters.cycleId, draftFilters.department, draftFilters.employeeId]);

  const overviewActions = useMemo(() => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return [...(overview?.actions || [])].sort((a, b) => {
      const weight = (severityOrder[a?.severity] ?? 9) - (severityOrder[b?.severity] ?? 9);
      if (weight !== 0) return weight;
      return Number(b?.count || 0) - Number(a?.count || 0);
    });
  }, [overview?.actions]);

  const actionPrioritySummary = useMemo(() => buildGeneralActionSummary(overviewActions), [overviewActions]);

  function handleClearFilters() {
    const empty = { cycleId: "", department: "", employeeId: "" };
    setDraftFilters(empty);
    try { localStorage.removeItem(FILTERS_STORAGE_KEY); } catch (_) { /* ignore */ }
  }

  async function handleCompare() {
    if (!compareCycleA || !compareCycleB) {
      addToast({ message: "Seleccioná dos ciclos para comparar.", type: "error" });
      return;
    }
    if (compareCycleA === compareCycleB) {
      addToast({ message: "Elegí dos ciclos distintos para comparar.", type: "error" });
      return;
    }
    try {
      setLoadingCompare(true);
      setCompareData(null);
      const [dataA, dataB] = await Promise.all([
        apiFetch(`/reports/overview?cycleId=${compareCycleA}`, { token, timeoutMs: 30000 }),
        apiFetch(`/reports/overview?cycleId=${compareCycleB}`, { token, timeoutMs: 30000 }),
      ]);
      setCompareData({ a: dataA, b: dataB });
    } catch (err) {
      addToast({ message: err.message || "No se pudo comparar los ciclos.", type: "error" });
    } finally {
      setLoadingCompare(false);
    }
  }

  async function handleExportExcel() {
    try {
      const params = new URLSearchParams();
      if (filters.cycleId) params.set("cycleId", filters.cycleId);
      const url = `/reports/export-excel${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(`${apiUrl}${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(localStorage.getItem("active_company_id")
            ? { "X-Company-Id": localStorage.getItem("active_company_id") }
            : {}),
        },
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "No se pudo generar el Excel.");
      }
      const blob = await response.blob();
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `zentor-reporte-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    } catch (err) {
      addToast({ message: err.message || "No se pudo exportar el Excel.", type: "error" });
    }
  }

  function handlePrintPDF() {
    if (!overview) return;
    const orgName = user?.companyName || "";
    const html = buildPdfDocument({
      orgName,
      execSummaryLines,
      execSignals,
      overview,
      priorityEmployees,
      topPerformers,
      overviewActions,
      evaluationCoverage,
    });
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function handlePrintPresentation() {
    if (!overview) return;
    const orgName = user?.companyName || "";
    const cycleName = overview?.selectedCycle?.label || "";
    const html = buildExecutivePdf({
      orgName,
      cycleName,
      execSummaryLines,
      execSignals,
      overview,
      priorityEmployees,
      topPerformers,
      overviewActions,
      evaluationCoverage,
      departmentScores,
    });
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  const evaluationChart = useMemo(
    () => [
      {
        label: "Completadas",
        value: Number(overview?.summary?.completedEvaluations || 0),
        tone: "bg-emerald-400",
      },
      {
        label: "Pendientes",
        value: Number(overview?.summary?.evaluationsPending || 0),
        tone: "bg-amber-400",
      },
      {
        label: "Ciclos abiertos",
        value: Number(overview?.summary?.cyclesOpen || 0),
        tone: "bg-sky-400",
      },
    ],
    [overview]
  );

  const kpiChart = useMemo(() => {
    const summary = overview?.kpis?.summaryByStatus || {};
    return [
      { label: "Cumplidos", value: Number(summary.completed || 0), tone: "bg-emerald-400" },
      { label: "En curso", value: Number(summary.inProgress || 0), tone: "bg-amber-400" },
      { label: "En riesgo", value: Number(summary.atRisk || 0), tone: "bg-rose-400" },
      { label: "Sin datos", value: Number(summary.noData || 0), tone: "bg-slate-400" },
    ];
  }, [overview]);

  const okrChart = useMemo(() => {
    const summary = overview?.okrs?.summaryByStatus || {};
    return [
      { label: "Cumplidos", value: Number(summary.completed || 0), tone: "bg-emerald-400" },
      { label: "En curso", value: Number(summary.inProgress || 0), tone: "bg-amber-400" },
      { label: "En riesgo", value: Number(summary.atRisk || 0), tone: "bg-rose-400" },
      { label: "Sin datos", value: Number(summary.noData || 0), tone: "bg-slate-400" },
    ];
  }, [overview]);

  const kpiOkrGrouped = useMemo(() => {
    const kpiS = overview?.kpis?.summaryByStatus || {};
    const okrS = overview?.okrs?.summaryByStatus || {};
    return [
      { label: "Cumplidos", kpi: Number(kpiS.completed || 0), okr: Number(okrS.completed || 0) },
      { label: "En curso", kpi: Number(kpiS.inProgress || 0), okr: Number(okrS.inProgress || 0) },
      { label: "En riesgo", kpi: Number(kpiS.atRisk || 0), okr: Number(okrS.atRisk || 0) },
      { label: "Sin datos", kpi: Number(kpiS.noData || 0), okr: Number(okrS.noData || 0) },
    ];
  }, [overview]);

  const evaluationCoverage = useMemo(() => {
    const total = Number(overview?.summary?.evaluationsTotal || 0);
    const completed = Number(overview?.summary?.completedEvaluations || 0);
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [overview]);

  const priorityEmployees = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    return items
      .filter((employee) => employee.needsAttention)
      .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
  }, [overview]);

  const departmentScores = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    const groups = {};
    items.forEach((employee) => {
      const area = employee.area || "Sin área";
      if (!groups[area]) groups[area] = { scores: [], count: 0 };
      if (employee.averageScore > 0) groups[area].scores.push(employee.averageScore);
      groups[area].count++;
    });
    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        count: data.count,
        averageScore: data.scores.length
          ? data.scores.reduce((sum, v) => sum + v, 0) / data.scores.length
          : 0,
      }))
      .sort((a, b) => a.averageScore - b.averageScore);
  }, [overview]);

  const topPerformers = useMemo(() => {
    const items = overview?.catalogs?.employees || [];
    return items
      .filter((employee) => employee.averageScore > 0)
      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
      .slice(0, 3);
  }, [overview]);

  const allEmployees = useMemo(() => overview?.catalogs?.employees || [], [overview]);

  const radarData = useMemo(() => {
    if (!detail?.metricSignals?.length) return [];
    return detail.metricSignals.slice(0, 8).map(s => ({
      subject: (s.competencyName || s.metricName || "Hab.").slice(0, 16),
      score: Number((s.averageScore || 0).toFixed(1)),
      fullMark: 5,
    }));
  }, [detail?.metricSignals]);

  const individualEvaluationChart = useMemo(
    () => buildEvaluationTypeChart(detail?.evaluations || []),
    [detail?.evaluations]
  );

  const individualMetricSignalChart = useMemo(
    () => buildMetricSignalRows(detail?.metricSignals || []),
    [detail?.metricSignals]
  );

  const execSummaryLines = useMemo(() => {
    if (!overview) return [];
    const avg = overview.summary?.averageScore || 0;
    const total = overview.summary?.employeesTotal || 0;
    const pending = overview.summary?.evaluationsPending || 0;
    const coverage = evaluationCoverage.pct;
    const atRisk = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);
    const overdue = overview.development?.overdue || 0;
    const needsAttention = priorityEmployees.length;
    const lines = [];

    if (avg >= 4) {
      lines.push(`El equipo muestra un desempeño sólido: promedio de ${avg.toFixed(2)} sobre 5.${total > 0 ? ` Hay ${total.toLocaleString("es-AR")} personas en el alcance actual.` : ""}`);
    } else if (avg >= 3) {
      lines.push(`El desempeño promedio del equipo es ${avg.toFixed(2)} sobre 5${total > 0 ? ` en ${total.toLocaleString("es-AR")} personas` : ""}, con espacio de mejora identificado.`);
    } else if (avg > 0) {
      lines.push(`El promedio de desempeño es ${avg.toFixed(2)} sobre 5. Se recomienda revisar los planes de acción en las áreas con menor puntaje.`);
    } else if (total > 0) {
      lines.push(`Hay ${total.toLocaleString("es-AR")} personas en el alcance. Todavía no hay suficientes datos de desempeño para calcular un promedio.`);
    }

    if (pending > 0 && evaluationCoverage.total > 0) {
      lines.push(`Cobertura de evaluaciones: ${coverage}% completada. Quedan ${pending.toLocaleString("es-AR")} evaluaciones sin cerrar en este período.`);
    } else if (coverage >= 80 && evaluationCoverage.total > 0) {
      lines.push(`La cobertura de evaluaciones está en ${coverage}%, indicando seguimiento activo del ciclo.`);
    }

    const alerts = [];
    if (needsAttention > 0) alerts.push(`${needsAttention} ${needsAttention === 1 ? "persona requiere" : "personas requieren"} atención prioritaria`);
    if (atRisk > 0) alerts.push(`${atRisk} KPI/OKR en riesgo`);
    if (overdue > 0) alerts.push(`${overdue} ${overdue === 1 ? "plan con seguimiento vencido" : "planes con seguimiento vencido"}`);
    if (alerts.length) {
      lines.push(`Puntos de seguimiento: ${alerts.join(" · ")}.`);
    } else if (avg >= 4 && coverage >= 80) {
      lines.push("No se detectan alertas críticas en el alcance actual.");
    }

    return lines;
  }, [overview, evaluationCoverage, priorityEmployees]);

  const execSignals = useMemo(() => {
    if (!overview) return [];
    const avg = overview.summary?.averageScore || 0;
    const coverage = evaluationCoverage.pct;
    const atRiskTotal = safeNum(overview?.kpis?.summaryByStatus?.atRisk, 0) + safeNum(overview?.okrs?.summaryByStatus?.atRisk, 0);
    const alertCount = priorityEmployees.length + atRiskTotal + (overview.development?.overdue || 0);
    return [
      {
        label: "Promedio de equipo",
        value: avg > 0 ? avg.toFixed(2) : "—",
        hint: "Escala 1 – 5",
        tone: avg >= 4 ? "success" : avg >= 3 ? "warning" : avg > 0 ? "danger" : "default",
      },
      {
        label: "Cobertura evaluaciones",
        value: `${coverage}%`,
        hint: `${evaluationCoverage.completed} de ${evaluationCoverage.total} completadas`,
        tone: coverage >= 80 ? "success" : coverage >= 50 ? "warning" : "danger",
      },
      {
        label: "Alertas activas",
        value: alertCount.toLocaleString("es-AR"),
        hint: `${priorityEmployees.length} personas · ${atRiskTotal} obj. en riesgo`,
        tone: alertCount === 0 ? "success" : alertCount <= 3 ? "warning" : "danger",
      },
      {
        label: "Planes en curso",
        value: (overview.development?.active || 0).toLocaleString("es-AR"),
        hint: `${(overview.development?.overdue || 0).toLocaleString("es-AR")} vencidos`,
        tone: (overview.development?.overdue || 0) > 0 ? "warning" : "default",
      },
    ];
  }, [overview, evaluationCoverage, priorityEmployees]);

  if (!canViewExecutive || isEmployee) {
    return (
      <div className="space-y-5">
        <section className="pf-surface pf-surface-pad">
          <p className="pf-section-title">Reportes &gt; Reporte ejecutivo</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Reporte ejecutivo</h1>
          <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            No tienes permisos para ver este reporte organizacional.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="pf-section-title">Reportes &gt; Reporte ejecutivo</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white">Reporte ejecutivo</h1>
              {overview?.selectedCycle ? (
                <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                  {overview.selectedCycle.label}
                  {overview.selectedCycle.estado ? ` · ${overview.selectedCycle.estado}` : ""}
                </span>
              ) : null}
              {overview?.summary?.employeesTotal > 0 ? (
                <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                  {overview.summary.employeesTotal.toLocaleString("es-AR")} personas
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
              Leé el estado general de la organización y, cuando haga falta, bajá al detalle individual de cada persona.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            disabled={loadingOverview}
            className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
          >
            {loadingOverview ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#14b8a6] text-[#0f172a] shadow-[0_12px_30px_rgba(20,184,166,0.22)]"
                  : "border border-white/10 bg-[#122530] text-[#c5d5de]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <SurfaceCard title="Parámetros del análisis" subtitle="Acoté el alcance por ciclo, unidad o colaborador sin salir de la pantalla.">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Ciclo</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.cycleId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, cycleId: event.target.value }))}
            >
              <option value="">Todos los ciclos visibles</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Área / departamento</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.department}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  department: event.target.value,
                  employeeId: "",
                }))
              }
            >
              <option value="">Todas las áreas visibles</option>
              {departments.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Persona</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={draftFilters.employeeId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">Selección automática</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName} {employee.area ? `· ${employee.area}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3 pb-1">
            {loadingOverview ? (
              <span className="text-sm text-[#9fb6c4]">Cargando...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-[#9fb6c4]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Actualizado
              </span>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              title="Limpiar filtros guardados"
              className="rounded-xl border border-white/10 bg-[#122530] px-3 py-2 text-xs text-[#9fb6c4] transition hover:bg-white/5 hover:text-white"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </SurfaceCard>

      {error ? <div className="pf-alert-error">{error}</div> : null}

      {/* ══ DASHBOARD ══ */}
      {activeTab === "dashboard" ? (
        loadingSummary ? (
          <EmptyPanel text="Cargando dashboard..." />
        ) : (
          <div className="space-y-4">
            {/* Stat cards */}
            {(() => {
              const s = summaryData?.stats || (overview ? overview.summary : null);
              if (!s) return <EmptyPanel text="Cargando estadísticas..." />;
              const cards = [
                { val: s.employeesTotal ?? s.employeesTotal, lbl: "Personas evaluadas", color: "#ffffff" },
                { val: (s.averageScore ?? 0).toFixed(1), lbl: "Promedio general", color: scColor(s.averageScore) },
                { val: s.evaluatedCount ?? s.completedEvaluations ?? "—", lbl: "Evaluados", color: "#a78bfa" },
                { val: s.scoreExcepcional ?? "—", lbl: "Nivel Excepcional ≥4.5", color: "#4ade80" },
                { val: s.scoreNeedsAttention ?? "—", lbl: "Necesitan atención <2.5", color: "#f87171" },
              ];
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
                  {cards.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div style={{ fontSize:26, fontWeight:900, color:c.color, lineHeight:1.1 }}>{c.val}</div>
                      <div style={{ fontSize:11, color:"#7a9aaa", marginTop:4 }}>{c.lbl}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Competency bars + Distribution */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
              {/* Competency bars */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:12 }}>Promedio por competencia</div>
                {Array.isArray(summaryData?.competencyAverages) && summaryData.competencyAverages.length > 0 ? (
                  summaryData.competencyAverages.map((c) => {
                    const pct = Math.round((c.avg / 5) * 100);
                    const color = scColor(c.avg);
                    return (
                      <div key={c.nombre} style={{ marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"#c5d5de" }}>{c.nombre}</span>
                          <span style={{ fontSize:11, fontWeight:800, color }}>{c.avg.toFixed(1)}</span>
                        </div>
                        <div style={{ height:6, borderRadius:4, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:4 }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize:11, color:"#7a9aaa" }}>Sin datos de competencias aún.</p>
                )}
              </div>

              {/* Distribution */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:12 }}>Distribución general de desempeño</div>
                {Array.isArray(summaryData?.scoreDistribution) ? (
                  <>
                    <DistBars dist={summaryData.scoreDistribution.map((d) => d.count)} />
                    <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
                      {summaryData.scoreDistribution.map((d) => (
                        <span key={d.bucket} style={{ flex:1, textAlign:"center", fontSize:8, color:"#7a9aaa", minWidth:40 }}>{d.label}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize:11, color:"#7a9aaa" }}>Sin datos de distribución aún.</p>
                )}
              </div>
            </div>

            {/* Recent evals table */}
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:12 }}>📋 Últimas evaluaciones registradas</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
                      {["#","Nombre","Puesto","Área","Puntaje"].map((h) => (
                        <th key={h} style={{ textAlign:"left", padding:"6px 8px", color:"#7a9aaa", fontWeight:600, fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(summaryData?.recentEvaluations) && summaryData.recentEvaluations.length > 0 ? (
                      summaryData.recentEvaluations.map((e, i) => (
                        <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding:"6px 8px", color:"#7a9aaa" }}>{i + 1}</td>
                          <td style={{ padding:"6px 8px", fontWeight:600, color:"#fff" }}>{e.employeeName}</td>
                          <td style={{ padding:"6px 8px", color:"#9bb5c4", fontSize:10 }}>{e.cargo}</td>
                          <td style={{ padding:"6px 8px", color:"#9bb5c4", fontSize:10 }}>{e.area}</td>
                          <td style={{ padding:"6px 8px" }}><ScorePill v={e.finalScore} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} style={{ padding:24, textAlign:"center", color:"#7a9aaa" }}>Sin evaluaciones recientes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )

      /* ══ PERSONAS ══ */
      ) : activeTab === "personas" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando datos de personas..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const areas = [...new Set(analyticsData.personas.map((p) => p.area))].sort();
          const filtered = analyticsData.personas.filter((p) => {
            if (personaSearch && !p.nombre.toLowerCase().includes(personaSearch.toLowerCase()) && !p.cargo.toLowerCase().includes(personaSearch.toLowerCase())) return false;
            if (personaFilterArea && p.area !== personaFilterArea) return false;
            return true;
          });
          const comps = analyticsData.competencias;
          return (
            <div className="space-y-3">
              {/* Filters */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                <input
                  className="rounded-xl border border-white/15 bg-[#0F1A21] px-3 py-2 text-sm text-white placeholder-[#7a9aaa]"
                  placeholder="Buscar nombre o cargo..."
                  value={personaSearch}
                  onChange={(e) => setPersonaSearch(e.target.value)}
                  style={{ minWidth:180 }}
                />
                <select
                  className="rounded-xl border border-white/15 bg-[#0F1A21] px-3 py-2 text-sm text-white"
                  value={personaFilterArea}
                  onChange={(e) => setPersonaFilterArea(e.target.value)}
                >
                  <option value="">Todas las áreas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {/* Table */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28]" style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ padding:"8px 10px", textAlign:"left", color:"#7a9aaa", fontWeight:600, fontSize:10, whiteSpace:"nowrap" }}>Nombre</th>
                      <th style={{ padding:"8px 10px", textAlign:"left", color:"#7a9aaa", fontWeight:600, fontSize:10 }}>Cargo</th>
                      <th style={{ padding:"8px 10px", textAlign:"left", color:"#7a9aaa", fontWeight:600, fontSize:10 }}>Área</th>
                      <th style={{ padding:"8px 10px", textAlign:"left", color:"#7a9aaa", fontWeight:600, fontSize:10 }}>Reporta a</th>
                      {comps.map((c) => (
                        <th key={c.id} style={{ padding:"8px 6px", textAlign:"center", color:"#7a9aaa", fontWeight:600, fontSize:9, whiteSpace:"nowrap" }} title={c.nombre}>
                          {c.nombre.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()}
                        </th>
                      ))}
                      <th style={{ padding:"8px 10px", textAlign:"center", color:"#7a9aaa", fontWeight:700, fontSize:10 }}>⌀</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5 + comps.length} style={{ padding:24, textAlign:"center", color:"#7a9aaa" }}>Sin resultados</td></tr>
                    ) : filtered.map((p) => (
                      <tr key={p._id} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding:"6px 10px", fontWeight:600, color:"#fff", whiteSpace:"nowrap" }}>{p.nombre}</td>
                        <td style={{ padding:"6px 10px", color:"#9bb5c4", fontSize:10, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.cargo}</td>
                        <td style={{ padding:"6px 10px", color:"#9bb5c4", fontSize:10, whiteSpace:"nowrap" }}>{p.area}</td>
                        <td style={{ padding:"6px 10px", color:"#7a9aaa", fontSize:10, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.managerName}</td>
                        {comps.map((c) => {
                          const s = p.compScores[c.id];
                          return (
                            <td key={c.id} style={{ padding:"4px 6px", textAlign:"center" }}>
                              {s?.auto != null ? <ScorePill v={s.auto} small /> : <span style={{ color:"rgba(255,255,255,0.15)" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding:"4px 10px", textAlign:"center" }}>
                          {p.general != null ? <ScorePill v={p.general} /> : <span style={{ color:"rgba(255,255,255,0.15)" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize:9, color:"#7a9aaa" }}>Las columnas de competencias muestran el promedio de la autoevaluación.</p>
            </div>
          );
        })()

      /* ══ POR NIVEL ══ */
      ) : activeTab === "por-nivel" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando análisis por nivel..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const { grupos, competencias } = analyticsData;
          if (!grupos.length) return <EmptyPanel text="Sin datos de áreas." />;
          const globalAvgByComp = {};
          competencias.forEach(({ id }) => {
            const all = grupos.flatMap((gr) => gr.compStats[id] ? [gr.compStats[id].avg] : []);
            globalAvgByComp[id] = all.length ? all.reduce((a,b)=>a+b,0)/all.length : 0;
          });
          const toggleTab = (i) => {
            setSelectedGrafTabs((prev) => {
              const next = new Set(prev);
              if (next.has(i)) {
                if (next.size === 1) return prev; // never allow empty
                next.delete(i);
              } else {
                next.add(i);
              }
              return next;
            });
          };
          const activeTabs = [...selectedGrafTabs].sort();
          return (
            <div className="space-y-3">
              {/* Area multi-select buttons */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {grupos.map((gr, i) => {
                  const selected = selectedGrafTabs.has(i);
                  return (
                    <button key={gr.area} type="button"
                      onClick={() => toggleTab(i)}
                      style={{
                        padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
                        background: selected ? areaColor(i) + "20" : "transparent",
                        color: selected ? areaColor(i) : "#7a9aaa",
                        border: `1px solid ${areaColor(i)}${selected ? "50" : "20"}`,
                      }}
                    >
                      {gr.area}
                    </button>
                  );
                })}
              </div>
              {/* One panel per selected area, side by side */}
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${activeTabs.length}, minmax(280px, 1fr))`, gap:12 }}>
                {activeTabs.map((tabIdx) => {
                  const g = grupos[tabIdx];
                  if (!g) return null;
                  const color = areaColor(tabIdx);
                  return (
                    <div key={g.area} className="space-y-3">
                      {/* Header */}
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <span style={{ padding:"4px 14px", borderRadius:16, fontSize:12, fontWeight:700, background:color+"18", color, border:`1px solid ${color}30` }}>{g.area}</span>
                        <span style={{ fontSize:11, color:"#7a9aaa" }}>{g.count} personas</span>
                        {g.avgScore != null && (
                          <span style={{ marginLeft:"auto", fontSize:12, fontWeight:700, color:scColor(g.avgScore), background:color+"15", border:`1px solid ${color}30`, padding:"4px 12px", borderRadius:8 }}>
                            {g.avgScore.toFixed(1)} — {scLabel(g.avgScore)}
                          </span>
                        )}
                      </div>
                      {/* Competency cards grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:10 }}>
                        {competencias.map(({ id, nombre }) => {
                          const st = g.compStats[id];
                          if (!st) return null;
                          const diff = (st.avg - (globalAvgByComp[id] || 0)).toFixed(1);
                          const diffColor = diff >= 0 ? "#4ade80" : "#f87171";
                          return (
                            <div key={id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                              <div style={{ fontSize:11, fontWeight:700, color:"#fff", marginBottom:4 }}>{nombre}</div>
                              <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:2 }}>
                                <div style={{ fontSize:22, fontWeight:900, color:scColor(st.avg) }}>{st.avg.toFixed(1)}</div>
                                <div style={{ fontSize:10, fontWeight:700, color:diffColor }}>{diff >= 0 ? "+" : ""}{diff} vs global</div>
                              </div>
                              <div style={{ fontSize:10, color:"#7a9aaa", marginBottom:10 }}>{scLabel(st.avg)}</div>
                              <DistBars dist={st.dist} />
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#7a9aaa", borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:6, marginTop:6 }}>
                                <span>Bajo: {st.pctLow}%</span>
                                <span>Alto: {st.pctHigh}%</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* General card */}
                        {g.avgScore != null && (
                          <div className="rounded-2xl bg-[#0f1f28] p-4" style={{ border:`1px solid ${color}30` }}>
                            <div style={{ fontSize:11, fontWeight:700, color, marginBottom:4 }}>⌀ General</div>
                            <div style={{ fontSize:22, fontWeight:900, color, marginBottom:2 }}>{g.avgScore.toFixed(1)}</div>
                            <div style={{ fontSize:10, color:"#7a9aaa", marginBottom:10 }}>{scLabel(g.avgScore)} · {g.count} personas</div>
                            {Array.isArray(g.genDist) && <DistBars dist={g.genDist} />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()

      /* ══ COMPARATIVO ══ */
      ) : activeTab === "comparativo" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando comparativo..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const { grupos, competencias } = analyticsData;
          return (
            <div className="space-y-4">
              {/* Cross-level table */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:12 }}>Competencias transversales — comparación entre áreas</div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
                        <th style={{ padding:"6px 10px", textAlign:"left", color:"#7a9aaa", fontSize:10, fontWeight:600 }}>Competencia</th>
                        {grupos.map((g, i) => (
                          <th key={g.area} style={{ padding:"6px 8px", textAlign:"center", color:areaColor(i), fontSize:10, fontWeight:600, whiteSpace:"nowrap" }}>{g.area}</th>
                        ))}
                        <th style={{ padding:"6px 8px", textAlign:"center", color:"#c5d5de", fontSize:10, fontWeight:600 }}>Global</th>
                        <th style={{ padding:"6px 8px", textAlign:"center", color:"#c5d5de", fontSize:10, fontWeight:600 }}>Brecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competencias.map(({ id, nombre }) => {
                        const stats = grupos.map((g) => g.compStats[id]);
                        const avgs = stats.map((s) => s?.avg).filter((v) => v != null);
                        if (!avgs.length) return null;
                        const gAvg = avgs.reduce((a,b)=>a+b,0)/avgs.length;
                        const brecha = (Math.max(...avgs) - Math.min(...avgs)).toFixed(1);
                        const bColor = brecha >= 1.5 ? "#f87171" : brecha >= 0.8 ? "#facc15" : "#4ade80";
                        const minV = Math.min(...avgs), maxV = Math.max(...avgs);
                        return (
                          <tr key={id} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding:"8px 10px", fontWeight:700, color:"#fff" }}>{nombre}</td>
                            {grupos.map((g, i) => {
                              const s = g.compStats[id];
                              if (!s) return <td key={i} style={{ padding:"8px", textAlign:"center", color:"rgba(255,255,255,0.15)" }}>—</td>;
                              return (
                                <td key={i} style={{ padding:"6px 8px" }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                                    <div style={{ flex:1, height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
                                      <div style={{ width:`${(s.avg/5)*100}%`, height:"100%", background:areaColor(i), borderRadius:3 }} />
                                    </div>
                                    <span style={{ fontWeight:800, color:scColor(s.avg), fontSize:11 }}>{s.avg.toFixed(1)}</span>
                                    {s.avg === minV && brecha > 0.3 && <span style={{ fontSize:9, color:"#f87171" }}>▼</span>}
                                    {s.avg === maxV && brecha > 0.3 && <span style={{ fontSize:9, color:"#4ade80" }}>▲</span>}
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{ padding:"6px 8px", textAlign:"center", fontWeight:800, color:"#fff" }}>{gAvg.toFixed(1)}</td>
                            <td style={{ padding:"6px 8px", textAlign:"center", fontWeight:700, color:bColor }}>{brecha}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Heatmap */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:12 }}>Mapa de calor — desempeño por área y competencia</div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
                        <th style={{ padding:"6px 10px", textAlign:"left", color:"#7a9aaa", fontSize:10 }}>Área</th>
                        {competencias.map((c) => (
                          <th key={c.id} style={{ padding:"6px 6px", textAlign:"center", color:"#7a9aaa", fontSize:9, whiteSpace:"nowrap" }}
                              title={c.nombre}>{c.nombre.split(" ").map((w)=>w[0]).join("").slice(0,3).toUpperCase()}</th>
                        ))}
                        <th style={{ padding:"6px 8px", textAlign:"center", color:"#c5d5de", fontSize:10 }}>⌀ Área</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map((g, gi) => {
                        const compAvgs = competencias.map(({ id }) => g.compStats[id]?.avg).filter((v) => v != null);
                        const nAvg = compAvgs.length ? compAvgs.reduce((a,b)=>a+b,0)/compAvgs.length : null;
                        return (
                          <tr key={g.area} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding:"6px 10px", color:areaColor(gi), fontWeight:700 }}>{g.area}</td>
                            {competencias.map(({ id }) => {
                              const s = g.compStats[id];
                              if (!s) return <td key={id} style={{ textAlign:"center", color:"rgba(255,255,255,0.15)" }}>—</td>;
                              const bg = s.avg >= 4 ? "rgba(34,197,94,.15)" : s.avg >= 3 ? "rgba(234,179,8,.1)" : s.avg >= 2 ? "rgba(249,115,22,.1)" : "rgba(239,68,68,.15)";
                              return (
                                <td key={id} style={{ textAlign:"center", background:bg, padding:"4px 6px" }}>
                                  <div style={{ fontWeight:800, fontSize:11, color:scColor(s.avg) }}>{s.avg.toFixed(1)}</div>
                                  <div style={{ fontSize:8, color:"#7a9aaa" }}>{s.pctLow}%↓</div>
                                </td>
                              );
                            })}
                            <td style={{ textAlign:"center", fontWeight:900, color:nAvg ? scColor(nAvg) : "#7a9aaa" }}>
                              {nAvg ? nAvg.toFixed(1) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()

      /* ══ RADAR ══ */
      ) : activeTab === "radar" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando radar..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const { grupos, competencias } = analyticsData;
          const labels = competencias.map((c) => c.nombre.split(" ")[0]);
          return (
            <div className="space-y-4">
              {/* Individual per area */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
                {grupos.map((g, i) => {
                  const vals = competencias.map(({ id }) => g.compStats[id]?.avg ?? 0);
                  const color = areaColor(i);
                  return (
                    <div key={g.area} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div style={{ fontSize:12, fontWeight:700, color, marginBottom:8 }}>
                        {g.area} <span style={{ fontSize:10, color:"#7a9aaa", fontWeight:400 }}>{g.count} personas</span>
                      </div>
                      <RadarCanvas labels={labels} datasets={[{ vals, color, label:g.area }]} width={260} height={210} />
                    </div>
                  );
                })}
              </div>
              {/* Combined */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <div style={{ fontSize:12, fontWeight:700, color:"#c5d5de", marginBottom:8 }}>🕸 Comparativo — todas las áreas</div>
                <RadarCanvas
                  labels={competencias.map((c) => c.nombre)}
                  datasets={grupos.map((g, i) => ({ vals: competencias.map(({ id }) => g.compStats[id]?.avg ?? 0), color: areaColor(i), label: g.area }))}
                  width={460}
                  height={320}
                />
              </div>
            </div>
          );
        })()

      /* ══ RECOMENDACIONES ══ */
      ) : activeTab === "recomendaciones" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando recomendaciones..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const recs = computeRecomendaciones(analyticsData.grupos, analyticsData.competencias);
          const critCount = recs.filter((r) => r.sev === "crit").length;
          const warnCount = recs.filter((r) => r.sev === "warn").length;
          const infoCount = recs.filter((r) => r.sev === "info").length;
          return (
            <div className="space-y-4">
              {/* Summary badges */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <span style={{ padding:"7px 14px", borderRadius:8, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.2)", fontSize:12, fontWeight:700, color:"#f87171" }}>🚨 Críticas: {critCount}</span>
                <span style={{ padding:"7px 14px", borderRadius:8, background:"rgba(249,115,22,.1)", border:"1px solid rgba(249,115,22,.2)", fontSize:12, fontWeight:700, color:"#fb923c" }}>⚠️ Advertencias: {warnCount}</span>
                <span style={{ padding:"7px 14px", borderRadius:8, background:"rgba(20,184,166,.1)", border:"1px solid rgba(20,184,166,.2)", fontSize:12, fontWeight:700, color:"#14b8a6" }}>💡 Informativas: {infoCount}</span>
              </div>
              {/* Cards */}
              {recs.length === 0 ? (
                <EmptyPanel text="No hay recomendaciones con los datos disponibles." />
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
                  {recs.map((r, idx) => {
                    const borderColor = r.sev === "crit" ? "rgba(239,68,68,.3)" : r.sev === "warn" ? "rgba(249,115,22,.3)" : "rgba(20,184,166,.2)";
                    const bg = r.sev === "crit" ? "rgba(239,68,68,.08)" : r.sev === "warn" ? "rgba(249,115,22,.08)" : "rgba(20,184,166,.05)";
                    const actionColor = r.sev === "crit" ? "#f87171" : r.sev === "warn" ? "#fb923c" : "#14b8a6";
                    return (
                      <div key={idx} className="rounded-2xl p-4" style={{ border:`1px solid ${borderColor}`, background:bg }}>
                        <div style={{ display:"flex", gap:8, marginBottom:7 }}>
                          <span style={{ fontSize:18, flexShrink:0 }}>{r.icon}</span>
                          <div>
                            <div style={{ fontSize:10, fontWeight:700, color:actionColor, marginBottom:2 }}>{r.area} · {r.comp}</div>
                            <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{r.title}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:11, color:"#c5d5de", lineHeight:1.6, marginBottom:8 }}>{r.body}</div>
                        <div style={{ fontSize:10, fontWeight:700, color:actionColor, padding:"4px 10px", border:`1px solid ${actionColor}30`, borderRadius:6, display:"inline-block" }}>
                          → {r.action}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()

      /* ══ ESTRUCTURA ══ */
      ) : activeTab === "estructura" ? (
        loadingAnalytics ? <EmptyPanel text="Cargando estructura..." /> :
        !analyticsData ? <EmptyPanel text="No se pudieron cargar los datos." /> : (() => {
          const { personas } = analyticsData;
          // Build id→persona map
          const personaMap = new Map(personas.map((p) => [p._id, p]));
          // Find roots: managerId is null or not found in map
          const roots = personas.filter((p) => !p.managerId || !personaMap.has(p.managerId));
          // Build children map
          const childrenOf = {};
          personas.forEach((p) => {
            if (p.managerId && personaMap.has(p.managerId)) {
              if (!childrenOf[p.managerId]) childrenOf[p.managerId] = [];
              childrenOf[p.managerId].push(p);
            }
          });

          function OrgNode({ p, level, color }) {
            const children = childrenOf[p._id] || [];
            const MAX_CHILDREN_SHOWN = level < 2 ? children.length : 3;
            const shownChildren = children.slice(0, MAX_CHILDREN_SHOWN);
            const hiddenCount = children.length - shownChildren.length;
            const nodeBorder = level === 0 ? `2px solid ${color}50` : `1px solid ${color}25`;
            const nodeBg = level === 0 ? `${color}12` : "#0f1f28";
            return (
              <div style={{ marginBottom: level < 2 ? 10 : 6 }}>
                {/* Node box */}
                <div style={{ display:"inline-flex", flexDirection:"column", gap:3, padding: level === 0 ? "10px 14px" : "6px 10px", borderRadius:10, border:nodeBorder, background:nodeBg, minWidth:130, maxWidth:200 }}>
                  <div style={{ fontSize: level === 0 ? 12 : 10, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nombre}</div>
                  {p.cargo && <div style={{ fontSize:9, color:`${color}99`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.cargo}</div>}
                  {p.general != null && (
                    <div style={{ marginTop:2 }}>
                      <ScorePill v={p.general} small />
                    </div>
                  )}
                </div>
                {/* Children at next level */}
                {(shownChildren.length > 0 || hiddenCount > 0) && level < 2 && (
                  <div style={{ marginLeft:16, borderLeft:`2px solid ${color}20`, paddingLeft:10, marginTop:6 }}>
                    {shownChildren.map((child) => (
                      <OrgNode key={child._id} p={child} level={level + 1} color={color} />
                    ))}
                    {hiddenCount > 0 && (
                      <div style={{ fontSize:9, color:"#7a9aaa", padding:"4px 8px", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:6, display:"inline-block", marginTop:4 }}>
                        +{hiddenCount} más
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          if (!roots.length) return <EmptyPanel text="Sin estructura jerárquica disponible." />;

          // Group roots by area for color coding
          const areaColorMap = {};
          let areaIdx = 0;
          roots.forEach((r) => {
            if (!areaColorMap[r.area]) {
              areaColorMap[r.area] = areaColor(areaIdx++);
            }
          });

          return (
            <div className="space-y-4">
              <p style={{ fontSize:11, color:"#7a9aaa" }}>Organigrama jerárquico basado en relaciones de reporte. Se muestran hasta 3 niveles.</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
                {roots.map((root) => {
                  const color = areaColorMap[root.area] || areaColor(0);
                  return (
                    <div key={root._id} style={{ padding:14, background:`${color}06`, borderRadius:11, border:`1px solid ${color}18`, minWidth:180 }}>
                      <OrgNode p={root} level={0} color={color} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()

      ) : null}
    </div>
  );
}

// ─── STUB so old tab-rendering references don't break ───
function _OldTabsRemoved() { return null; }
void _OldTabsRemoved;

// ─────────────────────────────────────────────────────────────────────────────
// The block below replaces the old comparar / por-nivel / radar / general / individual tabs.
// All of that content is now handled above by the new demo-style tab system.
// ─────────────────────────────────────────────────────────────────────────────

export default function ExecutiveReportPageBounded() {
  return (
    <ReportErrorBoundary>
      <ExecutiveReportPage />
    </ReportErrorBoundary>
  );
}
