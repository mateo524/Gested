import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function initials(nombre, apellido) {
  const a = (nombre?.[0] || "").toUpperCase();
  const b = (apellido?.[0] || "").toUpperCase();
  return a + b || "?";
}

function buildTree(nodes) {
  const byId = {};
  nodes.forEach((n) => { byId[n._id] = { ...n, children: [] }; });

  const roots = [];
  nodes.forEach((n) => {
    if (n.managerId && byId[n.managerId]) {
      byId[n.managerId].children.push(byId[n._id]);
    } else {
      roots.push(byId[n._id]);
    }
  });

  // Sort children alphabetically
  function sort(list) {
    list.sort((a, b) => a.apellido.localeCompare(b.apellido));
    list.forEach((node) => sort(node.children));
  }
  sort(roots);
  return roots;
}

function collectAllIds(nodes) {
  const ids = new Set();
  function walk(list) {
    list.forEach((n) => {
      ids.add(n._id);
      if (n.children?.length) walk(n.children);
    });
  }
  walk(nodes);
  return ids;
}

// ─── side panel ─────────────────────────────────────────────────────────────

const TIPO_COLOR = {
  DOCENTE: "#818cf8",
  DIRECTIVO: "#f59e0b",
  ADMINISTRATIVO: "#38bdf8",
  JEFE: "#f59e0b",
};

function ScoreMeter({ score, max = 5 }) {
  const pct = score > 0 ? Math.min(100, (score / max) * 100) : 0;
  const color = score >= 4 ? "#34d399" : score >= 3 ? "#fbbf24" : score > 0 ? "#f87171" : "#3d5a6a";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#5e7d8e]">Puntaje promedio</span>
        <span className="text-xl font-bold" style={{ color: score > 0 ? color : "#3d5a6a" }}>
          {score > 0 ? score.toFixed(1) : "—"}
          {score > 0 ? <span className="text-xs text-[#5e7d8e] font-normal"> / 5</span> : null}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: score > 0 ? `0 0 8px ${color}60` : "none" }}
        />
      </div>
    </div>
  );
}

function SidePanel({ employee, onClose, onViewEvals }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!employee) return null;

  const teamSize = employee.children?.length || 0;
  const tipoColor = TIPO_COLOR[employee.tipoEmpleado] || "#14b8a6";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#091319] shadow-[-4px_0_40px_rgba(2,8,23,0.7)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5e7d8e]">Perfil del empleado</p>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-[#8ea5b3] transition hover:text-white"
            aria-label="Cerrar panel">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Hero */}
        <div className="relative mx-4 mb-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f2230] to-[#091319] p-6">
          <div className="absolute inset-0 opacity-30"
            style={{ background: `radial-gradient(circle at 80% 20%, ${tipoColor}22 0%, transparent 60%)` }} />
          <div className="relative flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-[#0f172a]"
              style={{ backgroundColor: tipoColor }}>
              {initials(employee.nombre, employee.apellido)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-white leading-tight">
                {employee.nombre} {employee.apellido}
              </p>
              <p className="mt-0.5 text-sm font-medium" style={{ color: tipoColor }}>{employee.cargo || "Sin cargo"}</p>
              {employee.area ? (
                <p className="mt-1 text-xs text-[#7a9aaa]">{employee.area}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {employee.tipoEmpleado ? (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ backgroundColor: `${tipoColor}18`, color: tipoColor, border: `1px solid ${tipoColor}40` }}>
                    {employee.tipoEmpleado}
                  </span>
                ) : null}
                {teamSize > 0 ? (
                  <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                    {teamSize} {teamSize === 1 ? "reporte directo" : "reportes directos"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {/* Score meter */}
          <div className="relative mt-5 border-t border-white/8 pt-4">
            <ScoreMeter score={employee.averageScore || 0} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="mx-4 mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#0c1e28] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#5e7d8e]">Evaluaciones</p>
            <p className="mt-1.5 text-2xl font-bold text-white">{employee.evaluationCount ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c1e28] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#5e7d8e]">Planes activos</p>
            <p className="mt-1.5 text-2xl font-bold text-white">{employee.planCount ?? "—"}</p>
          </div>
          {employee.needsAttention ? (
            <div className="col-span-2 rounded-2xl border border-amber-300/25 bg-amber-500/8 p-3 flex items-center gap-2">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-amber-300 shrink-0">
                <path d="M8 2l6 12H2L8 2z" /><path d="M8 7v3M8 12v.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-amber-200">Requiere atención — puntaje bajo o evaluaciones pendientes</p>
            </div>
          ) : null}
        </div>

        {/* Fields */}
        <div className="mx-4 mb-4 space-y-3">
          {employee.email ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0c1e28] px-4 py-3">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 text-[#5e7d8e]">
                <rect x="1" y="3" width="14" height="10" rx="2" /><path d="M1 5l7 5 7-5" />
              </svg>
              <p className="truncate text-sm text-[#c5d5de]">{employee.email}</p>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-auto border-t border-white/10 p-4 space-y-2">
          <button type="button" onClick={() => onViewEvals(employee._id)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M3 8h10M3 5h6M3 11h8" strokeLinecap="round" />
            </svg>
            Ver evaluaciones
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-[#5e7d8e]">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}

// ─── connector lines via SVG overlay ────────────────────────────────────────

function ConnectorLines({ containerRef, treeRef }) {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    function compute() {
      if (!containerRef.current || !treeRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      const parentEls = treeRef.current.querySelectorAll("[data-node-id]");
      const nodeRects = {};
      parentEls.forEach((el) => {
        const id = el.getAttribute("data-node-id");
        const rect = el.getBoundingClientRect();
        nodeRects[id] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height,
          top: rect.top - containerRect.top,
        };
      });

      const childEls = treeRef.current.querySelectorAll("[data-child-of]");
      const newLines = [];
      childEls.forEach((el) => {
        const childId = el.getAttribute("data-node-id");
        const parentId = el.getAttribute("data-child-of");
        const parent = nodeRects[parentId];
        const child = nodeRects[childId];
        if (!parent || !child) return;
        newLines.push({ id: `${parentId}-${childId}`, x1: parent.x, y1: parent.y + 8, x2: child.x, y2: child.top - 8 });
      });
      setLines(newLines);
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [containerRef, treeRef]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      {lines.map((l) => (
        <path
          key={l.id}
          d={`M ${l.x1} ${l.y1} C ${l.x1} ${(l.y1 + l.y2) / 2}, ${l.x2} ${(l.y1 + l.y2) / 2}, ${l.x2} ${l.y2}`}
          fill="none"
          stroke="rgba(20,184,166,0.25)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

// ─── org node card ───────────────────────────────────────────────────────────

function OrgCard({ node, highlight, collapsed, onToggle, onClick, parentId }) {
  const hasChildren = node.children?.length > 0;
  const isHighlighted = highlight && (
    node.nombre.toLowerCase().includes(highlight) ||
    node.apellido.toLowerCase().includes(highlight) ||
    node.cargo.toLowerCase().includes(highlight) ||
    node.area.toLowerCase().includes(highlight)
  );
  const dimmed = highlight && !isHighlighted;

  return (
    <div
      data-node-id={node._id}
      data-child-of={parentId || undefined}
      className={`relative z-10 w-40 cursor-pointer rounded-2xl border bg-[#0c1e28] p-3 text-center transition-all ${
        isHighlighted
          ? "border-[#14b8a6] shadow-[0_0_16px_rgba(20,184,166,0.3)]"
          : "border-white/10"
      } ${dimmed ? "opacity-30" : "opacity-100"} hover:border-[#14b8a6]/50`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#14b8a6] text-sm font-bold text-[#0f172a]">
        {initials(node.nombre, node.apellido)}
      </div>
      <p className="truncate text-xs font-semibold text-white">
        {node.nombre} {node.apellido}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[#14b8a6]">{node.cargo}</p>
      {node.area ? (
        <p className="mt-0.5 truncate text-[10px] text-[#7a9aaa]">{node.area}</p>
      ) : null}
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-[#12222d] text-[#14b8a6] transition hover:bg-[#14b8a6] hover:text-[#0f172a]"
          aria-label={collapsed ? "Expandir" : "Colapsar"}
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            {collapsed ? <path d="M2 4l4 4 4-4" /> : <path d="M2 8l4-4 4 4" />}
          </svg>
        </button>
      ) : null}
    </div>
  );
}

// ─── recursive tree level ────────────────────────────────────────────────────

function TreeLevel({ nodes, highlight, collapsedIds, onToggle, onSelect, parentId, depth }) {
  return (
    <div className={`flex flex-col items-center ${depth > 0 ? "mt-10" : ""}`}>
      <div className="flex flex-wrap items-start justify-center gap-8">
        {nodes.map((node) => (
          <div key={node._id} className="flex flex-col items-center">
            <OrgCard
              node={node}
              highlight={highlight}
              collapsed={collapsedIds.has(node._id)}
              onToggle={() => onToggle(node._id)}
              onClick={() => onSelect(node)}
              parentId={parentId}
            />
            {node.children?.length > 0 && !collapsedIds.has(node._id) ? (
              <TreeLevel
                nodes={node.children}
                highlight={highlight}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                parentId={node._id}
                depth={depth + 1}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const { token } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const containerRef = useRef(null);
  const treeRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch("/employees/org-chart", { token })
      .then((data) => setNodes(data.nodes || []))
      .catch((err) => setError(err.message || "Error al cargar el organigrama"))
      .finally(() => setLoading(false));
  }, [token]);

  const areas = useMemo(() => {
    const set = new Set(nodes.map((n) => n.area).filter(Boolean));
    return [...set].sort();
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    if (!areaFilter) return nodes;
    // When filtering by area, include the manager chain so tree still makes sense
    const areaIds = new Set(nodes.filter((n) => n.area === areaFilter).map((n) => n._id));
    return nodes.filter((n) => areaIds.has(n._id) || (n.managerId && areaIds.has(n.managerId)));
  }, [nodes, areaFilter]);

  const tree = useMemo(() => buildTree(filteredNodes), [filteredNodes]);

  const allIds = useMemo(() => collectAllIds(tree), [tree]);

  const handleToggle = useCallback((id) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = () => setCollapsedIds(new Set());
  const handleCollapseAll = () => setCollapsedIds(new Set(allIds));

  const highlight = search.trim().toLowerCase();

  // Recompute lines whenever tree changes (trigger via key)
  const treeKey = `${filteredNodes.length}-${collapsedIds.size}`;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#14b8a6] border-t-transparent" />
          <p className="text-sm text-[#7a9aaa]">Cargando organigrama…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-red-300">Error al cargar el organigrama</p>
          <p className="mt-1 text-xs text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5e7d8e]">Estructura</p>
          <h1 className="text-2xl font-bold text-white">Organigrama</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c1e28] px-3 py-2">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#7a9aaa]">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5l3 3" />
            </svg>
            <input
              className="w-44 bg-transparent text-sm text-[#e8eef1] outline-none placeholder:text-[#7a9aaa]"
              placeholder="Buscar persona…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Area filter */}
          <select
            className="rounded-2xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {/* Expand / collapse */}
          <button
            type="button"
            onClick={collapsedIds.size > 0 ? handleExpandAll : handleCollapseAll}
            className="rounded-2xl border border-white/10 bg-[#0c1e28] px-4 py-2 text-sm text-[#c7d5dc] transition hover:bg-white/5"
          >
            {collapsedIds.size > 0 ? "Expandir todo" : "Colapsar todo"}
          </button>
        </div>
      </div>

      {/* Tree canvas */}
      {tree.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-3xl border border-white/10 bg-[#0c1e28]">
          <p className="text-sm text-[#7a9aaa]">No hay empleados para mostrar.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-auto rounded-3xl border border-white/10 bg-[#091319] p-8"
          style={{ minHeight: "60vh" }}
        >
          <ConnectorLines containerRef={containerRef} treeRef={treeRef} />
          <div ref={treeRef} key={treeKey} className="relative inline-flex min-w-full flex-col items-center">
            <TreeLevel
              nodes={tree}
              highlight={highlight}
              collapsedIds={collapsedIds}
              onToggle={handleToggle}
              onSelect={setSelectedEmployee}
              parentId={null}
              depth={0}
            />
          </div>
        </div>
      )}

      {/* Side panel — rendered in a portal so fixed positioning works regardless of CSS transforms */}
      {selectedEmployee
        ? createPortal(
            <SidePanel
              employee={selectedEmployee}
              onClose={() => setSelectedEmployee(null)}
              onViewEvals={() => {
                setSelectedEmployee(null);
                window.dispatchEvent(new CustomEvent("performia:set-view", { detail: { view: "evaluaciones" } }));
              }}
            />,
            document.body
          )
        : null}
    </div>
  );
}
