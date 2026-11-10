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
      // No filter here: a lingering filter would turn this wrapper into the containing block
      // for position:fixed descendants (skip link, overlays). Scale ends at 1, so transform resets to none.
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
