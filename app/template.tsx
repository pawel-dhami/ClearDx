"use client";

import { motion } from "motion/react";

/**
 * Route transition: every navigation (e.g. landing → /app) "boots in" the new
 * page — a quick fade and scale from the centre, per the design system's
 * 480ms emphasis duration. MotionConfig reducedMotion="user" turns the
 * transform off for reduced-motion users, leaving only the fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
