"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLOR = { light: "#22C55E", dark: "#0A0E1A" };

/**
 * Keeps the browser-chrome `theme-color` meta tag in sync with the resolved
 * theme, since layout.tsx only ships one static default value.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && resolvedTheme) meta.setAttribute("content", THEME_COLOR[resolvedTheme as "light" | "dark"]);
  }, [resolvedTheme]);

  return null;
}
