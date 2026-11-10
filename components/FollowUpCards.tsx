"use client";

import { AnimatePresence, motion } from "motion/react";
import { springs } from "@/lib/motion";
import type { FollowUpAnswer, FollowUpQuestion } from "@/lib/predict/types";

export type AnswerValue = "yes" | "no" | "not sure";

export interface AnswerFeedback {
  answer: AnswerValue;
  condition: string;
  delta: number; // confidence points
  after: number; // percent
}

interface FollowUpCardsProps {
  questions: FollowUpQuestion[];
  answers: FollowUpAnswer[];
  disabled: boolean;
  onAnswer: (question: string, answer: AnswerValue) => void;
  onUndo: (question: string) => void;
  feedback?: AnswerFeedback | null;
}

const ANSWERS: { v: AnswerValue; label: string; cls: string }[] = [
  { v: "yes", label: "Yes", cls: "border-support text-support hover:bg-support/10" },
  { v: "no", label: "No", cls: "border-contra text-contra hover:bg-contra/10" },
  { v: "not sure", label: "Not sure", cls: "border-amber text-amber hover:bg-amber/10" },
];

/** One question at a time with always-visible Yes / No / Not sure, then the visible effect of the answer. */
export function FollowUpCards({ questions, answers, disabled, onAnswer, onUndo, feedback }: FollowUpCardsProps) {
  const answered = new Set(answers.map((a) => a.question));
  const pending = questions.filter((q) => !answered.has(q.question));
  const q = pending[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {q ? (
          <motion.div key={q.question} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={springs.gentle} className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <span className="label">
                Question {answers.length + 1} of {answers.length + pending.length}
              </span>
            </div>
            <p className="mt-2 text-[15px] leading-snug text-text">{q.question}</p>
            <p className="mt-1.5 text-[13px] text-soft">{q.why_it_matters}</p>
            <div className="mt-auto grid grid-cols-3 gap-2 pt-3" role="group" aria-label="Your answer">
              {ANSWERS.map((a) => (
                <button key={a.v} type="button" disabled={disabled} onClick={() => onAnswer(q.question, a.v)} className={`btn border !px-0 disabled:opacity-40 ${a.cls}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-soft">
            No further questions right now.
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedback && (
          <motion.p
            key={`${feedback.condition}-${feedback.delta}-${feedback.answer}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.snappy}
            className="text-sm text-soft"
            aria-live="polite"
          >
            You answered <b className="text-text">{feedback.answer}</b>. {feedback.condition}{" "}
            <span className={`font-mono ${feedback.delta > 0 ? "text-support" : feedback.delta < 0 ? "text-contra" : "text-muted"}`}>
              {feedback.delta > 0 ? `▲ +${feedback.delta}` : feedback.delta < 0 ? `▼ −${Math.abs(feedback.delta)}` : "±0"}
            </span>{" "}
            → {feedback.after}%
          </motion.p>
        )}
      </AnimatePresence>

      {answers.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your answers">
          {answers.map((a) => (
            <li key={a.question} className="flex items-center gap-1.5 border border-line py-0.5 pr-0.5 pl-2 text-xs">
              <span className="max-w-40 truncate text-soft" title={a.question}>
                {a.question}
              </span>
              <span className="font-mono text-text uppercase">{a.answer}</span>
              <button type="button" onClick={() => onUndo(a.question)} disabled={disabled} aria-label={`Undo answer to: ${a.question}`} className="grid size-6 place-items-center text-muted hover:text-cyan disabled:opacity-40">
                ↺
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
