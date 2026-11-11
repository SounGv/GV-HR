"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const THEME_COLOR = { light: "#0D9488", dark: "#0A0E1A" };
/** The sign-in page opens on its dark hero, so the phone's status bar matches it instead of teal. */
const LOGIN_COLOR = "#0b1414";

/**
 * Keeps the browser-chrome `theme-color` meta tag in sync with the resolved
 * theme, since layout.tsx only ships one static default value.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const onLogin = pathname === "/login";

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || !resolvedTheme) return;
    meta.setAttribute("content", onLogin ? LOGIN_COLOR : THEME_COLOR[resolvedTheme as "light" | "dark"]);
  }, [resolvedTheme, onLogin]);

  return null;
}
