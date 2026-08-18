"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const MOBILE_BREAKPOINT_PX = 768;
const THEME_STORAGE_KEY = "theme"; // next-themes' default storageKey
const THEME_COLOR = { light: "#84CC16", dark: "#10130A" };

/**
 * First-time visitors on a phone-width screen land in dark mode (the brand's
 * intended look for the employee mobile view) instead of the site-wide
 * "light" default. Anyone who has ever explicitly picked a theme — on mobile
 * or desktop — keeps that choice; desktop's default is untouched.
 *
 * Also keeps the browser-chrome `theme-color` meta tag in sync with the
 * *actual* resolved theme — layout.tsx's static `media` queries only track
 * OS-level prefers-color-scheme, which drifts from the in-app theme as soon
 * as this component (or the toggle) sets one independently of the OS.
 */
export function MobileDefaultDarkTheme() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) setTheme("dark");
  }, [setTheme]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && resolvedTheme) meta.setAttribute("content", THEME_COLOR[resolvedTheme as "light" | "dark"]);
  }, [resolvedTheme]);

  return null;
}
