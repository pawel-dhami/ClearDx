"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
export const DEFAULT_HUE = 190;
const KEY_THEME = "cleardx-theme";
const KEY_HUE = "cleardx-hue";
export const THEME_EVENT = "cleardx-theme-change";

/**
 * Runs before first paint (inlined in <head>) so there is no flash of the wrong theme.
 * Reads saved preferences, falling back to the OS colour scheme for the theme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${KEY_THEME}"),h=localStorage.getItem("${KEY_HUE}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";d.dataset.theme=t;if(h!==null&&!isNaN(+h))d.style.setProperty("--hue",String(+h));}catch(e){document.documentElement.dataset.theme="dark";}})();`;

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode): the choice still applies for this visit */
  }
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
export function getHue(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hue"));
  return Number.isFinite(v) ? v : DEFAULT_HUE;
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  save(KEY_THEME, t);
  window.dispatchEvent(new Event(THEME_EVENT));
}
export function setHue(h: number) {
  document.documentElement.style.setProperty("--hue", String(Math.round(h)));
  save(KEY_HUE, String(Math.round(h)));
  window.dispatchEvent(new Event(THEME_EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
};

/** Current theme + hue, re-rendering when the toggle or slider changes them. */
export function useThemeState() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);
  const hue = useSyncExternalStore(subscribe, getHue, () => DEFAULT_HUE);
  return { theme, hue };
}

/** Resolves the live --accent colour (an oklch() value) to sRGB 0–1 via a 1px canvas. */
export function readAccentRGB(): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d");
  if (!g) return [0, 0.94, 1];
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#00f0ff";
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [r / 255, gr / 255, b / 255];
}
