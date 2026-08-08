"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gv1-mobile-menu-hidden";

function readHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Persists which home-menu tiles the user has hidden, scoped to this browser. */
export function useMenuVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHidden(readHidden());
  }, []);

  const setItemVisible = useCallback((id: string, visible: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden]);

  return { isVisible, setItemVisible };
}
