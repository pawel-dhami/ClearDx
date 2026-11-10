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

interface SymptomChipsProps {
  symptoms: string[];
  onReorder: (next: string[]) => void;
  onRemove: (label: string) => void;
  /** What-if mode: clicking a chip toggles it in/out of the prediction. */
  whatIf?: boolean;
  disabled?: Set<string>;
  onToggleEnabled?: (label: string) => void;
  /** Symptoms highlighted from the graph, reasoning or body. */
  highlighted?: string[];
  /** Symptoms that were sent but influence nothing. */
  noEffect?: Set<string>;
  onHover?: (label: string | null) => void;
}

/**
 * Draggable, removable chips. dnd-kit handles pointer dragging and hit-testing;
 * items reorder live on drag-over and Motion's `layout` animates the reflow
 * (dnd-kit transforms are intentionally unused). Keyboard: arrow keys reorder,
 * Delete/Backspace removes; in what-if mode Enter/Space or click toggles.
 */
export function SymptomChips({ symptoms, onReorder, onRemove, whatIf = false, disabled, onToggleEnabled, highlighted = [], noEffect, onHover }: SymptomChipsProps) {
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
      <div className="grid h-full min-h-24 place-items-center border border-dashed border-cyan/18 p-4 text-center">
        <div>
          <p className="font-display text-lg font-semibold tracking-[0.05em] uppercase">No symptoms yet</p>
          <p className="mt-1 text-sm text-soft">Choose a region above or point at the body.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <SortableContext items={symptoms} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected symptoms, in order of importance">
          <AnimatePresence initial={false} mode="popLayout">
            {symptoms.map((s, i) => (
              <Chip
                key={s}
                label={s}
                index={i}
                ghost={dragging === s}
                off={disabled?.has(s) ?? false}
                noEffect={noEffect?.has(s) ?? false}
                whatIf={whatIf}
                highlighted={highlighted.includes(s)}
                onRemove={onRemove}
                onNudge={nudge}
                onToggle={onToggleEnabled}
                onHover={onHover}
              />
            ))}
          </AnimatePresence>
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }}>
        {dragging ? (
          <motion.div initial={{ scale: 1 }} animate={{ scale: 1.06 }} transition={springs.snappy} className="cursor-grabbing">
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
  noEffect: boolean;
  whatIf: boolean;
  highlighted: boolean;
  onRemove: (l: string) => void;
  onNudge: (l: string, delta: number) => void;
  onToggle?: (l: string) => void;
  onHover?: (l: string | null) => void;
  /** AnimatePresence popLayout needs a ref on each direct child. */
  ref?: Ref<HTMLLIElement>;
}

function Chip({ label, index, ghost, off, noEffect, whatIf, highlighted, onRemove, onNudge, onToggle, onHover, ref }: ChipProps) {
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
      initial={{ opacity: 0, scale: 0.7, y: 6 }}
      animate={{ opacity: ghost ? 0.3 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
      transition={springs.layout}
      className="touch-none"
      onPointerEnter={() => onHover?.(label)}
      onPointerLeave={() => onHover?.(null)}
    >
      <ChipFace
        label={label}
        index={index}
        off={off}
        noEffect={noEffect}
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
  noEffect,
  lifted,
  highlighted,
  whatIf,
  onRemove,
  handleProps,
}: {
  label: string;
  index: number;
  off: boolean;
  noEffect?: boolean;
  lifted?: boolean;
  highlighted?: boolean;
  whatIf?: boolean;
  onRemove?: () => void;
  handleProps?: Record<string, unknown>;
}) {
  const hint = whatIf
    ? `${off ? "Excluded" : "Included"}. Click to ${off ? "include" : "exclude"}; arrow keys reorder.`
    : "Drag or use arrow keys to reorder, Delete to remove.";
  const tone = lifted
    ? "border-cyan bg-raised shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--accent)_55%,transparent)]"
    : highlighted
      ? "border-cyan bg-cyan/14 shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
      : off
        ? "border-dashed border-noeffect bg-transparent text-muted"
        : noEffect
          ? "border-muted/35 bg-transparent text-soft"
          : "border-line bg-cyan/6 hover:border-cyan";
  return (
    <div className={`flex min-h-8 items-center rounded-[2px] border text-sm transition-colors ${tone}`}>
      <button
        type="button"
        {...handleProps}
        aria-label={`${label}, position ${index + 1}${noEffect ? ", no effect" : ""}. ${hint}`}
        className="flex min-h-8 cursor-grab items-center gap-2 pr-1 pl-2.5 active:cursor-grabbing"
      >
        <span aria-hidden className="font-mono text-[11px] text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={off ? "line-through decoration-muted" : ""}>{label}</span>
        {noEffect && !off && <span className="font-mono text-[10px] tracking-[0.06em] text-muted">NO EFFECT</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="mr-0.5 grid size-7 place-items-center text-xs text-muted transition-colors hover:text-contra"
        >
          ✕
        </button>
      )}
      {!onRemove && <span className="pr-2.5" />}
    </div>
  );
}
