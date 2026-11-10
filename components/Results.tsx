"use client";

import { AnimatePresence, motion } from "motion/react";
import { springs } from "@/lib/motion";
import { Panel } from "./ui/Panel";

export function RedFlags({ flags }: { flags: string[] }) {
  return (
    <AnimatePresence>
      {flags.length > 0 && (
        <Panel title="Red flags · seek care" accent="rose" className="border-contra/30! bg-contra/[0.04]">
          <ul className="grid gap-2 sm:grid-cols-2" role="alert">
            <AnimatePresence initial={false}>
              {flags.map((f, i) => (
                <motion.li
                  key={f}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ ...springs.gentle, delay: i * 0.05 }}
                  className="flex gap-2.5 text-sm text-rose-100"
                >
                  <span aria-hidden className="relative mt-1.5 flex size-2 shrink-0">
                    <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-contra" />
                    <span className="relative size-2 rounded-full bg-contra" />
                  </span>
                  {f}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Panel>
      )}
    </AnimatePresence>
  );
}
