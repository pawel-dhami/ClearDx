"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useState, type KeyboardEvent, type Ref } from "react";
import { springs } from "@/lib/motion";
import { findSymptom, type Region } from "@/lib/symptoms";

const REGION_DOT: Record<Region, string> = {
  head: "bg-neon-cyan",
  throat: "bg-sky-300",
  chest: "bg-neon-blue",
  abdomen: "bg-neon-violet",
  pelvis: "bg-neon-pink",
  limbs: "bg-emerald-300",
  skin: "bg-amber-300",
  general: "bg-slate-300",
};

interface SymptomChipsProps {
  symptoms: string[];
  onReorder: (next: string[]) => void;
  onRemove: (label: string) => void;
  /** What-if mode: clicking a chip toggles it in/out of the prediction. */
  whatIf?: boolean;
  disabled?: Set<string>;
  onToggleEnabled?: (label: string) => void;
  /** Symptom highlighted from the graph / cards. */
  highlighted?: string | null;
}

/**
 * Draggable, removable chips. dnd-kit handles pointer dragging and hit-testing;
 * items are reordered live on drag-over and Motion's `layout` animates the reflow
 * with springs (dnd-kit transforms are intentionally unused). Keyboard reordering
 * is handled directly with arrow keys, since dnd-kit's KeyboardSensor cancels when
 * the live reorder moves the focused node.
 */
export function SymptomChips({
  symptoms,
  onReorder,
  onRemove,
  whatIf = false,
  disabled,
  onToggleEnabled,
  highlighted,
}: SymptomChipsProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const nudge = (label: string, delta: number) => {
    const i = symptoms.indexOf(label);
    const j = i + delta;
    if (i !== -1 && j >= 0 && j < symptoms.length) onReorder(arrayMove(symptoms, i, j));
  };

  const move = (from: string, to: string) => {
    const a = symptoms.indexOf(from);
    const b = symptoms.indexOf(to);
    if (a !== -1 && b !== -1 && a !== b) onReorder(arrayMove(symptoms, a, b));
  };

  const onStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onOver = (e: DragOverEvent) => e.over && move(String(e.active.id), String(e.over.id));
  const onEnd = (e: DragEndEvent) => {
    if (e.over) move(String(e.active.id), String(e.over.id));
    setDragging(null);
  };

  if (symptoms.length === 0) {
    return (
      <div className="grid h-full min-h-20 place-items-center rounded-2xl border border-dashed border-line text-center text-sm text-muted">
        <p className="px-4">Click a body region to add symptoms. They&apos;ll appear here.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onStart}
      onDragOver={onOver}
      onDragEnd={onEnd}
      onDragCancel={() => setDragging(null)}
    >
      <SortableContext items={symptoms} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-2" aria-label="Selected symptoms, in order of importance">
          <AnimatePresence initial={false} mode="popLayout">
            {symptoms.map((s, i) => (
              <Chip
                key={s}
                label={s}
                index={i}
                ghost={dragging === s}
                off={disabled?.has(s) ?? false}
                whatIf={whatIf}
                highlighted={highlighted === s}
                onRemove={onRemove}
                onNudge={nudge}
                onToggle={onToggleEnabled}
              />
            ))}
          </AnimatePresence>
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.9,.3,1.2)" }}>
        {dragging ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.08, rotate: -2 }}
            transition={springs.snappy}
            className="cursor-grabbing"
          >
            <ChipFace label={dragging} index={symptoms.indexOf(dragging)} off={disabled?.has(dragging) ?? false} lifted />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ChipProps {
  label: string;
  index: number;
  ghost: boolean;
  off: boolean;
  whatIf: boolean;
  highlighted: boolean;
  onRemove: (l: string) => void;
  onNudge: (l: string, delta: number) => void;
  onToggle?: (l: string) => void;
  /** AnimatePresence popLayout needs a ref on each direct child. */
  ref?: Ref<HTMLLIElement>;
}

function Chip({ label, index, ghost, off, whatIf, highlighted, onRemove, onNudge, onToggle, ref }: ChipProps) {
  const { setNodeRef, listeners } = useSortable({ id: label });
  const setRefs = (el: HTMLLIElement | null) => {
    setNodeRef(el);
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (delta) {
      e.preventDefault();
      onNudge(label, delta);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(label);
    }
  };
  return (
    <motion.li
      ref={setRefs}
      layout
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: ghost ? 0.3 : 1, scale: highlighted ? 1.06 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
      transition={springs.layout}
      className="touch-none"
    >
      <ChipFace
        label={label}
        index={index}
        off={off}
        highlighted={highlighted}
        whatIf={whatIf}
        onRemove={() => onRemove(label)}
        handleProps={{
          ...listeners,
          onKeyDown,
          onClick: whatIf && onToggle ? () => onToggle(label) : undefined,
          "aria-pressed": whatIf ? !off : undefined,
        }}
      />
    </motion.li>
  );
}

function ChipFace({
  label,
  index,
  off,
  lifted,
  highlighted,
  whatIf,
  onRemove,
  handleProps,
}: {
  label: string;
  index: number;
  off: boolean;
  lifted?: boolean;
  highlighted?: boolean;
  whatIf?: boolean;
  onRemove?: () => void;
  handleProps?: Record<string, unknown>;
}) {
  const region = findSymptom(label)?.region ?? "general";
  const hint = whatIf
    ? `${off ? "Excluded" : "Included"}. Click to ${off ? "include" : "exclude"}; drag or arrow keys to reorder.`
    : "Drag or use arrow keys to reorder, Delete to remove.";
  return (
    <div
      className={`group flex items-center rounded-full border text-sm transition-colors ${
        lifted
          ? "border-neon-cyan/70 bg-surface shadow-[0_10px_30px_-8px_rgba(94,234,212,.55)]"
          : highlighted
            ? "border-neon-cyan/60 bg-neon-cyan/10 shadow-[0_0_18px_-6px_rgba(94,234,212,.7)]"
            : off
              ? "border-dashed border-white/15 bg-transparent"
              : "border-white/12 bg-white/[0.04] hover:border-white/25"
      }`}
    >
      <button
        type="button"
        {...handleProps}
        aria-label={`${label}, position ${index + 1}. ${hint}`}
        className="flex cursor-grab items-center gap-2 py-1.5 pr-1 pl-3 active:cursor-grabbing"
      >
        <span aria-hidden className="font-mono text-[10px] text-muted">
          {index + 1}
        </span>
        {whatIf ? (
          <motion.span
            aria-hidden
            initial={false}
            animate={{ scale: off ? 0.8 : 1 }}
            transition={springs.snappy}
            className={`grid size-3.5 place-items-center rounded-[5px] border text-[9px] ${
              off ? "border-white/25 text-transparent" : "border-neon-cyan bg-neon-cyan/25 text-neon-cyan"
            }`}
          >
            ✓
          </motion.span>
        ) : (
          <span aria-hidden className={`size-1.5 rounded-full ${REGION_DOT[region]}`} />
        )}
        <span className={`transition-colors ${off ? "text-muted line-through decoration-white/30" : ""}`}>{label}</span>
      </button>
      {onRemove && (
        <motion.button
          type="button"
          onClick={onRemove}
          whileHover={{ scale: 1.15, rotate: 90 }}
          whileTap={{ scale: 0.85 }}
          transition={springs.snappy}
          aria-label={`Remove ${label}`}
          className="mr-1 grid size-6 place-items-center rounded-full text-xs text-muted hover:bg-contra/20 hover:text-contra"
        >
          ✕
        </motion.button>
      )}
      {!onRemove && <span className="pr-3" />}
    </div>
  );
}
