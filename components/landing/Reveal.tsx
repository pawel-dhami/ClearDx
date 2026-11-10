"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Scroll reveal: fade + 12px rise, once, when 30% is in view. Reduced motion → MotionConfig drops the rise. */
export function Reveal({ children, delay = 0, className = "", as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "article" | "section" }) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}
