"use client";

import { useEffect } from "react";

const CARD = ".hud, .hud-strong, [data-reveal]";
const BUTTON = ".btn";
/** Things the pointer highlight morphs onto. */
const INTERACTIVE = 'button, a[href], [role="button"], [role="radio"], [role="switch"], [role="menuitem"], [role="tab"], select, summary';
/** Larger targets (whole cards, the mobile body header) keep only the card spotlight. */
const MAX_W = 380;
const MAX_H = 96;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  o: number;
}

/**
 * Site-wide pointer effects, driven by one listener and CSS (see globals.css, "Pointer effects"):
 * - pointer highlight: a soft shape that morphs onto whatever button, link or pill the mouse is
 *   over (its size and corner radius), drifting slightly toward the cursor, then shrinks back into it
 * - cards: a spotlight and a lit border that follow the cursor
 * - buttons: a ripple from the press point and a slight magnetic pull on primary buttons
 * Mouse only; motion is reduced when the OS asks for it.
 */
export function Interactions() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let card: HTMLElement | null = null;
    let button: HTMLElement | null = null;
    let pending: PointerEvent | null = null;
    let raf = 0;

    // ---------- pointer highlight ----------
    const hl = document.createElement("div");
    hl.setAttribute("aria-hidden", "true");
    hl.className = "pointer-highlight";
    document.body.appendChild(hl);
    const cur: Box = { x: 0, y: 0, w: 0, h: 0, r: 0, o: 0 };
    let target: HTMLElement | null = null;
    let mouse = { x: -100, y: -100 };
    let loop = 0;
    let last = 0;

    const goal = (): Box => {
      if (!target || !target.isConnected) return { x: mouse.x - 4, y: mouse.y - 4, w: 8, h: 8, r: 4, o: 0 };
      const r = target.getBoundingClientRect();
      const pad = 3;
      const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      const h = r.height + pad * 2;
      const w = r.width + pad * 2;
      // drift a little toward the cursor, like a pointer pulling on the shape
      const k = reduce.matches ? 0 : 0.1;
      const dx = Math.max(-6, Math.min(6, (mouse.x - (r.left + r.width / 2)) * k));
      const dy = Math.max(-4, Math.min(4, (mouse.y - (r.top + r.height / 2)) * k));
      return { x: r.left - pad + dx, y: r.top - pad + dy, w, h, r: Math.min(h / 2, Math.max(10, radius + pad)), o: 1 };
    };
    const paint = () => {
      hl.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
      hl.style.width = `${cur.w}px`;
      hl.style.height = `${cur.h}px`;
      hl.style.borderRadius = `${cur.r}px`;
      hl.style.opacity = String(cur.o);
    };
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const g = goal();
      const a = reduce.matches ? 1 : 1 - Math.exp(-dt * 16);
      let moving = false;
      for (const key of ["x", "y", "w", "h", "r", "o"] as const) {
        // fade faster than it moves so the shape never lingers on an old spot
        const rate = key === "o" ? Math.min(1, a * 1.4) : a;
        cur[key] += (g[key] - cur[key]) * rate;
        if (Math.abs(g[key] - cur[key]) > 0.05) moving = true;
      }
      paint();
      loop = moving || target ? requestAnimationFrame(tick) : 0;
      if (!loop) last = 0;
    };
    const wake = () => {
      if (!loop) loop = requestAnimationFrame(tick);
    };
    const pickTarget = (el: Element | null) => {
      const t = el?.closest(INTERACTIVE);
      if (!(t instanceof HTMLElement) || t.closest("canvas") || (t as HTMLButtonElement).disabled) return null;
      const r = t.getBoundingClientRect();
      return r.width > MAX_W || r.height > MAX_H ? null : t;
    };

    // ---------- cards & buttons ----------
    const place = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${x - r.left}px`);
      el.style.setProperty("--my", `${y - r.top}px`);
      return r;
    };
    const release = (el: HTMLElement | null) => {
      if (!el) return;
      el.removeAttribute("data-lit");
      el.style.removeProperty("--tx");
      el.style.removeProperty("--ty");
    };

    const frame = () => {
      raf = 0;
      const e = pending;
      if (!e) return;
      const el = e.target instanceof Element ? e.target : null;
      mouse = { x: e.clientX, y: e.clientY };

      const nextTarget = pickTarget(el);
      if (nextTarget && !target && cur.o < 0.05) {
        // start from the cursor so the shape visibly grows out of it
        Object.assign(cur, { x: mouse.x - 4, y: mouse.y - 4, w: 8, h: 8, r: 4 });
      }
      target = nextTarget;
      wake();

      const nextCard = (el?.closest(CARD) as HTMLElement | null) ?? null;
      if (nextCard !== card) {
        release(card);
        card = nextCard;
        card?.setAttribute("data-lit", "");
      }
      if (card) place(card, e.clientX, e.clientY);

      const nextButton = (el?.closest(BUTTON) as HTMLElement | null) ?? null;
      if (nextButton !== button) {
        release(button);
        button = nextButton;
        button?.setAttribute("data-lit", "");
      }
      if (button) {
        const r = place(button, e.clientX, e.clientY);
        if (button.classList.contains("btn-primary") && !reduce.matches && !(button as HTMLButtonElement).disabled) {
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          button.style.setProperty("--tx", `${(dx * 6).toFixed(1)}px`);
          button.style.setProperty("--ty", `${(dy * 4).toFixed(1)}px`);
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pending = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLeave = () => {
      release(card);
      release(button);
      card = button = null;
      target = null;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && target) hl.classList.add("is-pressed");
      if (reduce.matches) return;
      const el = e.target instanceof Element ? (e.target.closest(BUTTON) as HTMLElement | null) : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--rx", `${e.clientX - r.left}px`);
      el.style.setProperty("--ry", `${e.clientY - r.top}px`);
      // restart the ripple animation
      el.removeAttribute("data-ripple");
      void el.offsetWidth;
      el.setAttribute("data-ripple", "");
    };
    const onUp = () => hl.classList.remove("is-pressed");
    // Scrolling moves targets under a still mouse: keep the shape glued to them.
    const onScroll = () => target && wake();

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(loop);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.documentElement.removeEventListener("pointerleave", onLeave);
      onLeave();
      hl.remove();
    };
  }, []);
  return null;
}
