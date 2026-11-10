"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { springs } from "@/lib/motion";
import type { FollowUpAnswer, FollowUpQuestion } from "@/lib/predict/types";

interface FollowUpCardsProps {
  questions: FollowUpQuestion[];
  answers: FollowUpAnswer[];
  disabled: boolean;
  onAnswer: (question: string, answer: "yes" | "no") => void;
  onUndo: (question: string) => void;
}

/** Tappable question cards. Tap to open, answer yes/no to refine the prediction. */
export function FollowUpCards({ questions, answers, disabled, onAnswer, onUndo }: FollowUpCardsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const answered = new Set(answers.map((a) => a.question));
  const pending = questions.filter((q) => !answered.has(q.question));

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="text-sm text-muted">No further questions right now.</p>
      ) : (
        <motion.ul layout className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {pending.map((q, i) => {
              const isOpen = open === q.question;
              return (
                <motion.li
                  key={q.question}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, y: -10, transition: { duration: 0.2 } }}
                  transition={{ ...springs.gentle, delay: i * 0.04 }}
                  className={`flex flex-col rounded-2xl border transition-colors ${
                    isOpen ? "border-neon-cyan/50 bg-neon-cyan/[0.05]" : "border-line bg-white/[0.025] hover:border-white/20"
                  }`}
                >
                  <motion.button
                    layout="position"
                    onClick={() => setOpen(isOpen ? null : q.question)}
                    whileTap={{ scale: 0.98 }}
                    aria-expanded={isOpen}
                    className="flex flex-1 items-start gap-3 p-3.5 text-left"
                  >
                    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-neon-violet/20 text-[11px] text-neon-violet">
                      ?
                    </span>
                    <span className="text-sm">{q.question}</span>
                  </motion.button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={springs.gentle}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-3.5">
                          <p className="mb-3 text-xs text-muted">{q.why_it_matters}</p>
                          <div className="flex gap-2">
                            {(["yes", "no"] as const).map((v) => (
                              <motion.button
                                key={v}
                                onClick={() => {
                                  setOpen(null);
                                  onAnswer(q.question, v);
                                }}
                                disabled={disabled}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.94 }}
                                transition={springs.snappy}
                                className={`flex-1 rounded-xl border py-1.5 text-sm font-medium capitalize disabled:opacity-40 ${
                                  v === "yes"
                                    ? "border-support/40 bg-support/10 text-support"
                                    : "border-contra/40 bg-contra/10 text-contra"
                                }`}
                              >
                                {v}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <AnimatePresence>
        {answers.length > 0 && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springs.gentle}
          >
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Your answers</p>
            <ul className="flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout">
                {answers.map((a) => (
                  <motion.li
                    key={a.question}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={springs.snappy}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] py-1 pr-1 pl-3 text-xs"
                  >
                    <span className="max-w-64 truncate text-muted" title={a.question}>
                      {a.question}
                    </span>
                    <span className={a.answer === "yes" ? "font-medium text-support" : "font-medium text-contra"}>
                      {a.answer}
                    </span>
                    <button
                      onClick={() => onUndo(a.question)}
                      disabled={disabled}
                      aria-label={`Undo answer to: ${a.question}`}
                      className="grid size-5 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-text disabled:opacity-40"
                    >
                      ↺
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
