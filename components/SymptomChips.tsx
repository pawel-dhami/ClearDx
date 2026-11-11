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
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useState, type KeyboardEvent, type Ref } from "react";
import { springs } from "@/lib/motion";
import { hasDetail, summarize, type SymptomDetail } from "@/lib/symptomDetail";
import { SymptomDetailPanel } from "./SymptomDetailPanel";

interface SymptomChipsProps {
  symptoms: string[];
  onReorder: (next: string[]) => void;
  onRemove: (label: string) => void;
  /** What-if mode: clicking a symptom toggles it in/out of the prediction. */
  whatIf?: boolean;
  disabled?: Set<string>;
  onToggleEnabled?: (label: string) => void;
  /** Symptoms highlighted from the graph, reasoning or body. */
  highlighted?: string[];
  /** Symptoms that were sent but influence nothing. */
  noEffect?: Set<string>;
  onHover?: (label: string | null) => void;
  /** Optional per-symptom details (severity, onset, pattern, side, note). */
  details?: Record<string, SymptomDetail>;
  onDetail?: (label: string, detail: SymptomDetail) => void;
}

/**
 * The symptom log: a ranked, draggable list. Each symptom can open an optional
 * detail panel. dnd-kit handles pointer dragging; Motion's `layout` animates the
 * reflow. Keyboard: arrow keys reorder, Delete/Backspace removes; in what-if mode
 * Enter/Space or click toggles a symptom in or out.
 */
export function SymptomChips({
  symptoms,
  onReorder,
  onRemove,
  whatIf = false,
  disabled,
  onToggleEnabled,
  highlighted = [],
  noEffect,
  onHover,
  details = {},
  onDetail,
}: SymptomChipsProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
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

  const onStart = (e: DragStartEvent) => {
    setOpen(null);
    setDragging(String(e.active.id));
  };
  const onOver = (e: DragOverEvent) => e.over && move(String(e.active.id), String(e.over.id));
  const onEnd = (e: DragEndEvent) => {
    if (e.over) move(String(e.active.id), String(e.over.id));
    setDragging(null);
  };

  if (symptoms.length === 0) {
    return (
      <div className="grid h-full min-h-24 place-items-center rounded-2xl bg-fill p-4 text-center">
        <div>
          <p className="font-display text-lg font-semibold">No symptoms yet</p>
          <p className="mt-1 text-sm text-soft">Choose a region above or point at the body.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <SortableContext items={symptoms} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5" aria-label="Selected symptoms, in order of importance">
          <AnimatePresence initial={false} mode="popLayout">
            {symptoms.map((s, i) => (
              <Row
                key={s}
                label={s}
                index={i}
                ghost={dragging === s}
                off={disabled?.has(s) ?? false}
                noEffect={noEffect?.has(s) ?? false}
                whatIf={whatIf}
                highlighted={highlighted.includes(s)}
                detail={details[s]}
                expanded={open === s}
                onExpand={onDetail ? () => setOpen((o) => (o === s ? null : s)) : undefined}
                onDetail={onDetail}
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
          <motion.div initial={{ scale: 1 }} animate={{ scale: 1.03 }} transition={springs.snappy} className="cursor-grabbing">
            <RowFace label={dragging} index={symptoms.indexOf(dragging)} off={disabled?.has(dragging) ?? false} detail={details[dragging]} lifted />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface RowProps {
  label: string;
  index: number;
  ghost: boolean;
  off: boolean;
  noEffect: boolean;
  whatIf: boolean;
  highlighted: boolean;
  detail?: SymptomDetail;
  expanded: boolean;
  onExpand?: () => void;
  onDetail?: (label: string, d: SymptomDetail) => void;
  onRemove: (l: string) => void;
  onNudge: (l: string, delta: number) => void;
  onToggle?: (l: string) => void;
  onHover?: (l: string | null) => void;
  /** AnimatePresence popLayout needs a ref on each direct child. */
  ref?: Ref<HTMLLIElement>;
}

function Row({ label, index, ghost, off, noEffect, whatIf, highlighted, detail, expanded, onExpand, onDetail, onRemove, onNudge, onToggle, onHover, ref }: RowProps) {
  const { setNodeRef, listeners } = useSortable({ id: label });
  const setRefs = (el: HTMLLIElement | null) => {
    setNodeRef(el);
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (delta) {
      e.preventDefault();
      onNudge(label, delta);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(label);
    }
  };
  const panelId = `detail-${label.replace(/\W+/g, "-")}`;
  return (
    <motion.li
      ref={setRefs}
      layout
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: ghost ? 0.3 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={springs.layout}
      onPointerEnter={() => onHover?.(label)}
      onPointerLeave={() => onHover?.(null)}
    >
      <RowFace
        label={label}
        index={index}
        off={off}
        noEffect={noEffect}
        highlighted={highlighted}
        whatIf={whatIf}
        detail={detail}
        expanded={expanded}
        panelId={panelId}
        onExpand={onExpand}
        onRemove={() => onRemove(label)}
        handleProps={{
          ...listeners,
          onKeyDown,
          onClick: whatIf && onToggle ? () => onToggle(label) : undefined,
          "aria-pressed": whatIf ? !off : undefined,
        }}
      />
      <AnimatePresence initial={false}>
        {expanded && onDetail && (
          <motion.div
            key="panel"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            className="overflow-hidden"
          >
            <SymptomDetailPanel label={label} detail={detail ?? {}} onChange={(d) => onDetail(label, d)} onDone={onExpand!} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function RowFace({
  label,
  index,
  off,
  noEffect,
  lifted,
  highlighted,
  whatIf,
  detail,
  expanded,
  panelId,
  onExpand,
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
  detail?: SymptomDetail;
  expanded?: boolean;
  panelId?: string;
  onExpand?: () => void;
  onRemove?: () => void;
  handleProps?: Record<string, unknown>;
}) {
  const hint = whatIf
    ? `${off ? "Excluded" : "Included"}. Click to ${off ? "include" : "exclude"}; arrow keys reorder.`
    : "Drag or use arrow keys to reorder, Delete to remove.";
  const summary = summarize(detail);
  const tone = lifted
    ? "bg-raised shadow-[var(--shadow-lg)]"
    : highlighted
      ? "bg-cyan/14 ring-1 ring-[var(--accent)]"
      : off
        ? "bg-transparent outline-1 outline-dashed outline-[var(--line-strong)] text-muted"
        : "bg-fill hover:bg-[var(--fill-hover)]";
  return (
    <div className={`flex min-h-10 items-center gap-1 rounded-xl pr-1 text-sm transition-colors ${tone}`}>
      <button
        type="button"
        {...handleProps}
        aria-label={`${label}, position ${index + 1}${noEffect ? ", no effect" : ""}${summary ? `, ${summary}` : ""}. ${hint}`}
        className="flex min-h-10 min-w-0 flex-1 cursor-grab items-center gap-2.5 py-1.5 pl-3 text-left active:cursor-grabbing"
      >
        <span aria-hidden className="font-mono text-xs text-faint">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className={`block truncate ${off ? "line-through decoration-muted" : ""}`}>{label}</span>
          {(summary || (noEffect && !off)) && (
            <span className="block truncate text-xs text-muted">
              {summary}
              {summary && noEffect && !off ? " · " : ""}
              {noEffect && !off ? "No effect on the result" : ""}
            </span>
          )}
        </span>
      </button>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${hasDetail(detail) ? "Edit" : "Add"} details for ${label}`}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors ${
            expanded ? "bg-[var(--accent-fill)] text-white" : hasDetail(detail) ? "bg-cyan/15 text-cyan" : "text-muted hover:bg-[var(--fill-hover)] hover:text-text"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
          {hasDetail(detail) ? "Edit" : "Details"}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-contra/12 hover:text-contra"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M1 1l8 8M9 1L1 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
