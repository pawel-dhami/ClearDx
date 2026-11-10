"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pct, type Highlight } from "@/lib/explain";
import { springs } from "@/lib/motion";
import type { PredictionResult } from "@/lib/predict/types";

// ---------- graph model ----------

type Kind = "symptom" | "condition";

interface GNode extends SimulationNodeDatum {
  id: string;
  kind: Kind;
  label: string;
  r: number;
  confidence?: number;
}

interface GLink extends SimulationLinkDatum<GNode> {
  id: string;
  symptom: string;
  condition: string;
  weight: number;
  reason: string;
}

const sid = (s: string) => `s:${s}`;
const cid = (c: string) => `c:${c}`;

function buildGraph(result: PredictionResult) {
  const nodes = new Map<string, GNode>();
  const links: GLink[] = [];
  for (const p of result.predictions) {
    nodes.set(cid(p.condition), {
      id: cid(p.condition),
      kind: "condition",
      label: p.condition,
      r: 9 + p.confidence * 15,
      confidence: p.confidence,
    });
    for (const c of p.contributions) {
      if (!nodes.has(sid(c.symptom))) nodes.set(sid(c.symptom), { id: sid(c.symptom), kind: "symptom", label: c.symptom, r: 7 });
      links.push({
        id: `${c.symptom}→${p.condition}`,
        source: sid(c.symptom),
        target: cid(p.condition),
        symptom: c.symptom,
        condition: p.condition,
        weight: c.weight,
        reason: c.reason,
      });
    }
  }
  return { nodes: [...nodes.values()], links };
}

type Pos = Map<string, { x: number; y: number }>;

interface Tip {
  x: number;
  y: number;
  title: string;
  rows: GLink[];
  /** For node tips: which end of each row to name. */
  other?: "symptom" | "condition";
}

// ---------- component ----------

interface ContributionGraphProps {
  result: PredictionResult;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
}

export function ContributionGraph({ result, highlight, onHighlight }: ContributionGraphProps) {
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<Pos>(new Map());
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  /** Narrow screens: tapped node stays selected (touch has no hover). */
  const [pinned, setPinned] = useState<Highlight>(null);
  const lastPos = useRef<Pos>(new Map());
  const reduced = useReducedMotion() ?? false;

  const graph = useMemo(() => buildGraph(result), [result]);
  const vertical = width > 0 && width < 520;
  const height = vertical ? 400 : 380;

  // Measure synchronously on mount (ResizeObserver alone waits for a rendering frame), then track resizes.
  const wrap = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Run the force simulation whenever the graph or size changes; seed from previous positions so it morphs.
  useEffect(() => {
    if (!width) return;
    const w = width;
    const h = height;
    const colX = (k: Kind) => (vertical ? w / 2 : k === "symptom" ? w * 0.27 : w * 0.73);
    const rowY = (k: Kind) => (vertical ? (k === "symptom" ? h * 0.2 : h * 0.78) : h / 2);

    const nodes: GNode[] = graph.nodes.map((n, i) => {
      const prev = lastPos.current.get(n.id);
      const jitter = ((i * 37) % 23) - 11;
      return { ...n, x: prev?.x ?? colX(n.kind) + jitter, y: prev?.y ?? rowY(n.kind) + jitter * 3 };
    });
    const links: GLink[] = graph.links.map((l) => ({ ...l }));

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance((l) => (vertical ? 170 : 150) - Math.abs(l.weight) * 40)
          .strength((l) => 0.05 + Math.abs(l.weight) * 0.25),
      )
      .force("charge", forceManyBody().strength(vertical ? -300 : -220))
      .force("x", forceX<GNode>((d) => colX(d.kind)).strength(vertical ? 0.03 : 0.45))
      .force("y", forceY<GNode>((d) => rowY(d.kind)).strength(vertical ? 0.45 : 0.06))
      // Stacked layout puts labels beside each other, so collide on label width there.
      .force(
        "collide",
        forceCollide<GNode>((d) => (vertical ? Math.max(d.r + 12, (d.label.length * 6.4) / 2 + 6) : d.r + 12)),
      )
      .alpha(lastPos.current.size ? 0.5 : 1)
      .alphaDecay(0.035);

    const pad = 12;
    // Keep labels on-canvas too, not just the circles (≈6.2px per char at 11–12px).
    const extent = (n: GNode): [left: number, right: number] => {
      const text = n.label.length * (n.kind === "condition" ? 6.6 : 6.2);
      if (vertical) return [Math.max(n.r, text / 2 + 2), Math.max(n.r, text / 2 + 2)];
      return n.kind === "symptom" ? [n.r + 8 + text, n.r] : [n.r, n.r + 8 + text];
    };
    const clamp = () => {
      for (const n of nodes) {
        const [left, right] = extent(n);
        const lo = pad + left;
        const hi = w - pad - right;
        n.x = lo <= hi ? Math.max(lo, Math.min(hi, n.x ?? 0)) : w / 2;
        n.y = Math.max(pad + n.r, Math.min(h - pad - n.r, n.y ?? 0));
      }
    };
    const publish = () => {
      const next: Pos = new Map(nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]));
      lastPos.current = next;
      setPos(next);
    };

    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const settle = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        sim.tick();
        clamp();
      }
    };
    if (reduced) {
      // No visible physics: settle off-screen, then draw once.
      sim.stop();
      settle(300);
      timeout = setTimeout(publish, 0);
    } else {
      // First layout: pre-settle and draw right away (not rAF-dependent, so it also shows in
      // background tabs); the live simulation then finishes settling. Updates morph from the old layout.
      if (lastPos.current.size === 0) {
        settle(120);
        timeout = setTimeout(publish, 0);
      }
      sim.on("tick", () => {
        clamp();
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(publish);
      });
    }
    return () => {
      sim.stop();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [graph, width, height, vertical, reduced]);

  // ---------- highlight logic ----------
  const focus = highlight ?? (vertical ? pinned : null);
  const hlNode = focus ? (focus.kind === "symptom" ? sid(focus.id) : cid(focus.id)) : null;
  const activeLink = hoverLink ? graph.links.find((l) => l.id === hoverLink) : undefined;
  const linkLit = (l: GLink) =>
    activeLink ? l.id === activeLink.id : hlNode ? l.source === hlNode || l.target === hlNode : false;
  const anyFocus = Boolean(activeLink || (hlNode && graph.nodes.some((n) => n.id === hlNode)));
  const nodeLit = (id: string) => {
    if (activeLink) return id === activeLink.source || id === activeLink.target;
    if (!hlNode) return false;
    return id === hlNode || graph.links.some((l) => linkLit(l) && (l.source === id || l.target === id));
  };

  const tip: Tip | null = (() => {
    if (activeLink) {
      const p = pos.get(activeLink.target as string);
      const q = pos.get(activeLink.source as string);
      if (!p || !q) return null;
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, title: `${activeLink.symptom} → ${activeLink.condition}`, rows: [activeLink] };
    }
    if (hlNode) {
      const p = pos.get(hlNode);
      const n = graph.nodes.find((x) => x.id === hlNode);
      if (!p || !n) return null;
      const rows = graph.links.filter((l) => l.source === hlNode || l.target === hlNode);
      if (rows.length === 0) return null;
      return {
        x: p.x,
        y: p.y,
        title: n.kind === "condition" ? `${n.label} · ${pct(n.confidence ?? 0)}%` : n.label,
        rows: [...rows].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, vertical ? 6 : 4),
        other: n.kind === "symptom" ? "condition" : "symptom",
      };
    }
    return null;
  })();

  const ready = width > 0 && pos.size > 0;
  const symptomCount = graph.nodes.filter((n) => n.kind === "symptom").length;

  return (
    <div onKeyDown={(e) => e.key === "Escape" && (onHighlight(null), setPinned(null), setHoverLink(null))}>
      <div ref={wrap} className="relative w-full" style={{ height }}>
        {ready && (
          <svg
            width={width}
            height={height}
            className="absolute inset-0 overflow-visible"
            role="group"
            aria-label={`Graph linking ${symptomCount} symptoms to ${result.predictions.length} conditions. Tab through the nodes; a full table follows.`}
            onPointerLeave={() => setHoverLink(null)}
          >
            <defs>
              <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* edges */}
            <g aria-hidden>
              {graph.links.map((l) => {
                const s = pos.get(l.source as string);
                const t = pos.get(l.target as string);
                if (!s || !t) return null;
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2;
                const bend = vertical ? (t.x - s.x) * 0.2 : (t.y - s.y) * -0.15;
                const d = vertical
                  ? `M${s.x},${s.y} Q${mx + bend},${my} ${t.x},${t.y}`
                  : `M${s.x},${s.y} Q${mx},${my + bend} ${t.x},${t.y}`;
                const support = l.weight >= 0;
                const lit = linkLit(l);
                return (
                  <g key={l.id}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={support ? "#4ade80" : "#fb7185"}
                      strokeLinecap="round"
                      initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: anyFocus ? (lit ? 0.95 : 0.06) : 0.45,
                        strokeWidth: 1 + Math.abs(l.weight) * 7 + (lit ? 1 : 0),
                      }}
                      transition={{ pathLength: { duration: 0.8, ease: "easeOut" }, default: springs.gentle }}
                      strokeDasharray={support ? undefined : "6 5"}
                      style={{ filter: lit ? `drop-shadow(0 0 6px ${support ? "#4ade80" : "#fb7185"})` : undefined }}
                    />
                    {/* wide invisible hit area */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setHoverLink(l.id)}
                      onPointerLeave={() => setHoverLink(null)}
                      className="cursor-help"
                    />
                  </g>
                );
              })}
            </g>

            {/* nodes */}
            <g>
              {graph.nodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const lit = nodeLit(n.id);
                const dim = anyFocus && !lit;
                const isCond = n.kind === "condition";
                const labelProps = vertical
                  ? { x: 0, y: isCond ? n.r + 14 : -n.r - 8, textAnchor: "middle" as const }
                  : isCond
                    ? { x: n.r + 8, y: 4, textAnchor: "start" as const }
                    : { x: -n.r - 8, y: 4, textAnchor: "end" as const };
                const h: Highlight = { kind: n.kind, id: n.label };
                const isPinned = pinned?.kind === n.kind && pinned.id === n.label;
                return (
                  // Plain <g> owns focus + events (motion.g doesn't forward onFocus); inner motion.g animates.
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={vertical ? isPinned : undefined}
                    aria-label={
                      isCond
                        ? `${n.label}, ${pct(n.confidence ?? 0)}% confidence`
                        : `${n.label}, linked to ${graph.links.filter((l) => l.symptom === n.label).length} conditions`
                    }
                    onPointerEnter={(e) => e.pointerType === "mouse" && onHighlight(h)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && onHighlight(null)}
                    onClick={() => setPinned(isPinned ? null : h)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPinned(isPinned ? null : h);
                      }
                    }}
                    onFocus={() => onHighlight(h)}
                    onBlur={() => onHighlight(null)}
                    className="group cursor-pointer outline-none"
                  >
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: dim ? 0.25 : 1 }} transition={springs.gentle}>
                    {/* keyboard focus ring */}
                    <circle
                      r={n.r + 9}
                      fill="none"
                      stroke="#5eead4"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      className="opacity-0 transition-opacity group-focus-visible:opacity-100"
                    />
                    {/* larger touch target */}
                    <circle r={Math.max(n.r, 18)} fill="transparent" />
                    {isCond && (
                      <circle r={n.r + 5} fill="none" stroke="#a78bfa" strokeOpacity={lit ? 0.6 : 0.2} strokeWidth={1} />
                    )}
                    <motion.circle
                      initial={reduced ? false : { r: 0 }}
                      animate={{ r: n.r * (lit ? 1.15 : 1) }}
                      transition={springs.snappy}
                      fill={isCond ? "rgba(167,139,250,.85)" : "#0a0e18"}
                      stroke={isCond ? "#a78bfa" : "#5eead4"}
                      strokeWidth={isCond ? 0 : 2}
                      filter={lit ? "url(#node-glow)" : undefined}
                    />
                    <text
                      {...labelProps}
                      fontSize={isCond ? 12 : 11}
                      fontWeight={isCond ? 600 : 400}
                      fill={isCond ? "#e6e9f2" : "#b8c0d4"}
                      pointerEvents="none"
                      aria-hidden
                      style={{ paintOrder: "stroke", stroke: "#05070d", strokeWidth: 3 }}
                    >
                      {n.label}
                    </text>
                  </motion.g>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {!ready && <div className="skeleton absolute inset-0 opacity-40" aria-hidden />}

        {/* Wide: floating tooltip on the half of the graph away from the focused point. */}
        {!vertical && (
          <AnimatePresence>
            {tip && (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                transition={springs.snappy}
                className="glass-strong pointer-events-none absolute z-10 w-64 rounded-xl p-3 text-xs"
                style={{
                  left: Math.max(4, Math.min(width - 260, tip.x - 128)),
                  ...(tip.y > height / 2 ? { top: 4 } : { bottom: 4 }),
                }}
                aria-hidden
              >
                <TipBody tip={tip} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Narrow / touch: detail strip under the graph, tap a node to pin it. */}
      {vertical && (
        <div className="mt-2 min-h-24 rounded-xl border border-line bg-black/20 p-3 text-xs" aria-hidden>
          <AnimatePresence mode="wait">
            {tip ? (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={springs.snappy}
              >
                <TipBody tip={tip} />
              </motion.div>
            ) : (
              <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted">
                Tap a symptom or condition to see why they&apos;re linked.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Screen-reader equivalent of the whole graph. */}
      <table className="sr-only">
        <caption>Symptom contributions to each condition</caption>
        <thead>
          <tr>
            <th scope="col">Symptom</th>
            <th scope="col">Condition</th>
            <th scope="col">Effect</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {graph.links.map((l) => (
            <tr key={l.id}>
              <td>{l.symptom}</td>
              <td>{l.condition}</td>
              <td>
                {l.weight >= 0 ? "supports" : "contradicts"}, weight {Math.abs(l.weight).toFixed(2)}
              </td>
              <td>{l.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipBody({ tip }: { tip: Tip }) {
  return (
    <>
      <p className="mb-1.5 font-medium text-text">{tip.title}</p>
      <ul className="space-y-1.5">
        {tip.rows.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className={`shrink-0 font-mono ${l.weight >= 0 ? "text-support" : "text-contra"}`}>
              {l.weight >= 0 ? "+" : "−"}
              {Math.abs(l.weight).toFixed(2)}
            </span>
            <span className="text-muted">
              {tip.other && <span className="text-text/80">{tip.other === "condition" ? l.condition : l.symptom}: </span>}
              {l.reason}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded bg-support" /> supports
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-contra" /> contradicts
      </span>
      <span>thickness = weight</span>
    </div>
  );
}
