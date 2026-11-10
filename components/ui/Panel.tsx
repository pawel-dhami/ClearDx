"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, springs } from "@/lib/motion";

interface PanelProps {
  title?: ReactNode;
  /** Small label right of the title (badge, count, action). */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: "cyan" | "violet" | "rose" | "amber";
  children: ReactNode;
  id?: string;
  /** Lets skip links move focus here. */
  focusTarget?: boolean;
}

const accents = {
  cyan: "from-neon-cyan/60",
  violet: "from-neon-violet/60",
  rose: "from-contra/70",
  amber: "from-warn/70",
};

/** Glass bento tile. Children of a `staggerChildren` parent animate in sequence. */
export function Panel({ title, aside, className = "", bodyClassName = "", accent = "cyan", children, id, focusTarget }: PanelProps) {
  return (
    <motion.section
      id={id}
      tabIndex={focusTarget ? -1 : undefined}
      variants={fadeUp}
      transition={springs.gentle}
      className={`glass relative flex min-w-0 scroll-mt-4 flex-col overflow-hidden rounded-3xl outline-none ${className}`}
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      {/* neon hairline at the top edge */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r ${accents[accent]} via-transparent to-transparent`}
      />
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          {title && (
            <h2
              id={id ? `${id}-title` : undefined}
              className="text-xs font-medium uppercase tracking-[0.18em] text-muted"
            >
              {title}
            </h2>
          )}
          {aside}
        </header>
      )}
      <div className={`flex-1 px-5 pb-5 ${bodyClassName}`}>{children}</div>
    </motion.section>
  );
}
