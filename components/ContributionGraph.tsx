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
import { highlightedConditions, highlightedSymptoms, pct, type Highlight } from "@/lib/explain";
import { springs } from "@/lib/motion";
import type { PredictionResult } from "@/lib/predict/types";

const SUPPORT = "var(--support)";
const CONTRA = "var(--contra)";
const CYAN = "var(--accent)";
const NOEFFECT = "var(--noeffect)";

// ---------- graph model ----------

type Kind = "symptom" | "condition";

interface GNode extends SimulationNodeDatum {
  id: string;
  kind: Kind;
  label: string;
  r: number;
  confidence?: number;
  /** Symptom that was sent but has no link: "no effect" or excluded in what-if. */
  tag?: "no effect" | "excluded";
}

interface GLink extends SimulationLinkDatum<GNode> {
  id: string;
  symptom: string;
  condition: string;
  weight: number;
  reason: string;
}

export interface ExtraSymptom {
  label: string;
  tag: "no effect" | "excluded";
}

const sid = (s: string) => `s:${s}`;
const cid = (c: string) => `c:${c}`;

function buildGraph(result: PredictionResult, extras: ExtraSymptom[]) {
  const nodes = new Map<string, GNode>();
  const links: GLink[] = [];
  for (const p of result.predictions) {
    nodes.set(cid(p.condition), { id: cid(p.condition), kind: "condition", label: p.condition, r: 9 + p.confidence * 13, confidence: p.confidence });
    for (const c of p.contributions) {
      if (!nodes.has(sid(c.symptom))) nodes.set(sid(c.symptom), { id: sid(c.symptom), kind: "symptom", label: c.symptom, r: 6 });
      links.push({ id: `${c.symptom}→${p.condition}`, source: sid(c.symptom), target: cid(p.condition), symptom: c.symptom, condition: p.condition, weight: c.weight, reason: c.reason });
    }
  }
  for (const e of extras) {
    if (!nodes.has(sid(e.label))) nodes.set(sid(e.label), { id: sid(e.label), kind: "symptom", label: e.label, r: 5, tag: e.tag });
  }
  return { nodes: [...nodes.values()], links };
}

type Pos = Map<string, { x: number; y: number }>;

interface Tip {
  x: number;
  y: number;
  title: string;
  rows: GLink[];
  other?: "symptom" | "condition";
  note?: string;
}

// ---------- component ----------

interface ContributionGraphProps {
  result: PredictionResult;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  /** Symptoms sent with no influence, or excluded in what-if; shown greyed and labelled. */
  extras?: ExtraSymptom[];
  /** Minimum height; the graph otherwise fills its container. */
  minHeight?: number;
}

export function ContributionGraph({ result, highlight, onHighlight, extras = [], minHeight = 220 }: ContributionGraphProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState<Pos>(new Map());
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  /** Narrow screens: tapped node stays selected (touch has no hover). */
  const [pinned, setPinned] = useState<Highlight>(null);
  const lastPos = useRef<Pos>(new Map());
  const reduced = useReducedMotion() ?? false;

  const extrasKey = extras.map((e) => e.label + e.tag).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graph = useMemo(() => buildGraph(result, extras), [result, extrasKey]);
  const width = size.w;
  const vertical = width > 0 && width < 340;
  const height = Math.max(minHeight, vertical ? Math.max(size.h, 360) : size.h);

  // Measure synchronously on mount (ResizeObserver alone waits for a rendering frame), then track resizes.
  const wrap = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const b = el.getBoundingClientRect();
    setSize({ w: Math.round(b.width), h: Math.round(b.height) });
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Force layout; seeded from previous positions so result changes morph instead of jump.
  useEffect(() => {
    if (!width || !height) return;
    const w = width;
    const h = height;
    const colX = (k: Kind) => (vertical ? w / 2 : k === "symptom" ? w * 0.3 : w * 0.7);
    // Side-by-side layout: every node gets an evenly spaced row so 12px+ labels never collide.
    // Conditions in rank order; symptoms ordered by the conditions they feed (fewer crossings); no-effect last.
    const conds = graph.nodes.filter((n) => n.kind === "condition").sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const condRank = new Map(conds.map((n, i) => [n.id, i]));
    const bary = (n: GNode) => {
      const ls = graph.links.filter((l) => l.source === n.id);
      const tw = ls.reduce((a, l) => a + Math.abs(l.weight), 0) || 1;
      return ls.reduce((a, l) => a + (condRank.get(l.target as string) ?? 0) * Math.abs(l.weight), 0) / tw;
    };
    const syms = graph.nodes.filter((n) => n.kind === "symptom").sort((a, b) => (a.tag ? 1 : 0) - (b.tag ? 1 : 0) || bary(a) - bary(b));
    const slot = new Map<string, number>();
    const spread = (list: GNode[]) => list.forEach((n, i) => slot.set(n.id, 14 + ((i + 0.5) * (h - 28)) / list.length));
    spread(conds);
    spread(syms);
    const rowY = (n: GNode) => (vertical ? (n.kind === "symptom" ? h * 0.2 : h * 0.78) : (slot.get(n.id) ?? h / 2));

    const nodes: GNode[] = graph.nodes.map((n, i) => {
      const prev = lastPos.current.get(n.id);
      const jitter = ((i * 37) % 23) - 11;
      return { ...n, x: prev?.x ?? colX(n.kind) + jitter, y: prev?.y ?? rowY(n) + jitter * 3 };
    });
    const links: GLink[] = graph.links.map((l) => ({ ...l }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink<GNode, GLink>(links).id((d) => d.id).distance((l) => (vertical ? 160 : 150) - Math.abs(l.weight) * 40).strength((l) => 0.05 + Math.abs(l.weight) * 0.25))
      .force("charge", forceManyBody().strength(vertical ? -300 : -40))
      .force("x", forceX<GNode>((d) => colX(d.kind)).strength(vertical ? 0.03 : 0.9))
      .force("y", forceY<GNode>((d) => rowY(d)).strength(vertical ? 0.45 : 0.9))
      .force("collide", forceCollide<GNode>((d) => (vertical ? Math.max(d.r + 12, (d.label.length * 6.6) / 2 + 6) : d.r + 2)))
      .alpha(lastPos.current.size ? 0.5 : 1)
      .alphaDecay(0.035);

    const pad = 10;
    const extent = (n: GNode): [number, number] => {
      const text = n.label.length * (n.kind === "condition" ? 8 : 6.8) + (n.tag ? 70 : 0);
      if (vertical) return [Math.max(n.r, text / 2 + 2), Math.max(n.r, text / 2 + 2)];
      return n.kind === "symptom" ? [n.r + 10 + n.label.length * 6.8, n.r + (n.tag ? 80 : 0)] : [n.r, n.r + 12 + Math.max(text, 40)];
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
    const settle = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        sim.tick();
        clamp();
      }
    };

    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (reduced) {
      sim.stop();
      settle(300);
      timeout = setTimeout(publish, 0);
    } else {
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
  const hs = new Set(highlightedSymptoms(focus));
  const hc = new Set(highlightedConditions(focus));
  const activeLink = hoverLink ? graph.links.find((l) => l.id === hoverLink) : undefined;
  const linkLit = (l: GLink) => {
    if (activeLink) return l.id === activeLink.id;
    if (focus?.kind === "refs") return hs.has(l.symptom) && (hc.size === 0 || hc.has(l.condition));
    return hs.has(l.symptom) || hc.has(l.condition);
  };
  const anyFocus = Boolean(activeLink || hs.size || hc.size);
  const nodeLit = (n: GNode) => {
    if (activeLink) return n.id === activeLink.source || n.id === activeLink.target;
    if ((n.kind === "symptom" ? hs : hc).has(n.label)) return true;
    return graph.links.some((l) => linkLit(l) && (l.source === n.id || l.target === n.id));
  };

  const tip: Tip | null = (() => {
    if (activeLink) {
      const p = pos.get(activeLink.target as string);
      const q = pos.get(activeLink.source as string);
      if (!p || !q) return null;
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, title: `${activeLink.symptom} → ${activeLink.condition}`, rows: [activeLink] };
    }
    if (focus && focus.kind !== "refs") {
      const n = graph.nodes.find((x) => x.kind === focus.kind && x.label === focus.id);
      const p = n && pos.get(n.id);
      if (!n || !p) return null;
      if (n.tag) {
        return { x: p.x, y: p.y, title: n.label, rows: [], note: n.tag === "excluded" ? "Excluded in what-if, so it isn't affecting any result right now." : "Sent with your symptoms, but it doesn't change any of these conditions." };
      }
      const rows = graph.links.filter((l) => l.source === n.id || l.target === n.id);
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

  const edgePath = (s: { x: number; y: number }, t: { x: number; y: number }) => {
    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2;
    return vertical ? `M${s.x},${s.y} Q${mx + (t.x - s.x) * 0.2},${my} ${t.x},${t.y}` : `M${s.x},${s.y} C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={(e) => e.key === "Escape" && (onHighlight(null), setPinned(null), setHoverLink(null))}>
      <div ref={wrap} className="relative min-h-0 w-full flex-1" style={{ minHeight: vertical ? 360 : minHeight }}>
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
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* edges: thickness = |weight|, solid green supports, dashed red contradicts */}
            <g aria-hidden>
              {graph.links.map((l) => {
                const s = pos.get(l.source as string);
                const t = pos.get(l.target as string);
                if (!s || !t) return null;
                const d = edgePath(s, t);
                const support = l.weight >= 0;
                const lit = linkLit(l);
                return (
                  <g key={l.id}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={support ? SUPPORT : CONTRA}
                      strokeLinecap="round"
                      strokeDasharray={support ? undefined : "7 5"}
                      initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: anyFocus ? (lit ? 1 : 0.08) : support ? 0.6 : 0.95,
                        strokeWidth: 1.5 + Math.abs(l.weight) * 6 + (lit ? 1 : 0),
                      }}
                      transition={{ pathLength: { duration: 0.8, ease: "easeOut" }, default: springs.gentle }}
                      style={{ filter: lit ? `drop-shadow(0 0 6px ${support ? SUPPORT : CONTRA})` : undefined }}
                    />
                    {/* particles flowing symptom → condition */}
                    {Math.abs(l.weight) >= 0.3 && (!anyFocus || lit) && (
                      <path d={d} fill="none" stroke="var(--text)" strokeOpacity={0.65} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="2 14" className="animate-flow" />
                    )}
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
                const lit = nodeLit(n);
                const dim = anyFocus && !lit;
                const isCond = n.kind === "condition";
                const labelProps = vertical
                  ? { x: 0, y: isCond ? n.r + 16 : -n.r - 9, textAnchor: "middle" as const }
                  : isCond
                    ? { x: n.r + 9, y: -1, textAnchor: "start" as const }
                    : { x: -n.r - 9, y: 4, textAnchor: "end" as const };
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
                        : n.tag
                          ? `${n.label}, ${n.tag}`
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
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: dim ? 0.28 : 1 }} transition={springs.gentle}>
                      <circle r={n.r + 8} fill="none" stroke={CYAN} strokeWidth={2} strokeDasharray="3 3" className="opacity-0 transition-opacity group-focus-visible:opacity-100" />
                      <circle r={Math.max(n.r, 16)} fill="transparent" />
                      {isCond ? (
                        <>
                          <circle r={n.r + 4} fill="none" stroke={CYAN} strokeOpacity={lit ? 0.7 : 0.25} />
                          <circle r={n.r} fill={`color-mix(in oklab, var(--accent) ${lit ? 30 : 16}%, transparent)`} stroke={CYAN} strokeWidth={1.5} filter={lit ? "url(#node-glow)" : undefined} />
                        </>
                      ) : (
                        <circle r={n.r * (lit ? 1.2 : 1)} fill="var(--ink)" stroke={n.tag ? NOEFFECT : CYAN} strokeWidth={2} strokeDasharray={n.tag ? "3 2" : undefined} filter={lit && !n.tag ? "url(#node-glow)" : undefined} />
                      )}
                      <text
                        {...labelProps}
                        fontSize={isCond ? 15 : 12.5}
                        fontWeight={isCond ? 700 : 400}
                        fill={n.tag ? "var(--muted)" : "var(--text)"}
                        style={{ fontFamily: isCond ? "var(--font-display)" : "var(--font-sans)", textTransform: isCond ? "uppercase" : undefined, letterSpacing: isCond ? "0.05em" : undefined, paintOrder: "stroke", stroke: "var(--ink)", strokeWidth: 3 }}
                        textDecoration={n.tag === "excluded" ? "line-through" : undefined}
                        pointerEvents="none"
                        aria-hidden
                      >
                        {n.label}
                      </text>
                      {isCond && !vertical && (
                        <text x={n.r + 9} y={14} fontSize={11.5} fill={lit ? CYAN : "var(--muted)"} style={{ fontFamily: "var(--font-mono)" }} pointerEvents="none" aria-hidden>
                          {pct(n.confidence ?? 0)}%
                        </text>
                      )}
                      {n.tag && !vertical && (
                        <text x={n.r + 9} y={4} fontSize={11} fill="var(--muted)" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }} pointerEvents="none" aria-hidden>
                          {n.tag}
                        </text>
                      )}
                    </motion.g>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {!ready && <div className="skeleton absolute inset-0 opacity-40" aria-hidden />}

        {!vertical && (
          <AnimatePresence>
            {tip && (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                transition={springs.snappy}
                className="hud-strong pointer-events-none absolute z-10 w-64 p-3 text-xs"
                style={{ left: Math.max(4, Math.min(width - 260, tip.x - 128)), ...(tip.y > height / 2 ? { top: 4 } : { bottom: 4 }) }}
                aria-hidden
              >
                <TipBody tip={tip} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {vertical && (
        <div className="mt-2 min-h-24 border border-cyan/12 bg-ink/40 p-3 text-xs" aria-hidden>
          <AnimatePresence mode="wait">
            {tip ? (
              <motion.div key={tip.title} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={springs.snappy}>
                <TipBody tip={tip} />
              </motion.div>
            ) : (
              <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-soft">
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
              <td>{l.weight >= 0 ? "supports" : "contradicts"}, weight {Math.abs(l.weight).toFixed(2)}</td>
              <td>{l.reason}</td>
            </tr>
          ))}
          {extras.map((e) => (
            <tr key={e.label}>
              <td>{e.label}</td>
              <td>none</td>
              <td>{e.tag}</td>
              <td>{e.tag === "excluded" ? "Excluded in what-if mode." : "Does not change any listed condition."}</td>
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
      <p className="mb-1.5 font-display text-sm font-bold tracking-[0.05em] text-text uppercase">{tip.title}</p>
      {tip.note && <p className="text-soft">{tip.note}</p>}
      <ul className="space-y-1.5">
        {tip.rows.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className={`shrink-0 font-mono ${l.weight >= 0 ? "text-support" : "text-contra"}`}>
              {l.weight >= 0 ? "+" : "−"}
              {Math.abs(l.weight).toFixed(2)}
            </span>
            <span className="text-soft">
              {tip.other && <span className="text-text">{tip.other === "condition" ? l.condition : l.symptom}: </span>}
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-soft" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="h-[3px] w-5 bg-support" />+ supports
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="4">
          <line x1="0" y1="2" x2="20" y2="2" stroke={CONTRA} strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        − contradicts
      </span>
    </div>
  );
}
