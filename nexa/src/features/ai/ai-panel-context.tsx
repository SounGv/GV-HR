"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface AiPanelContextValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  toggle: () => void;
}

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

/**
 * One floating AI chat panel, opened only from the sidebar's "AI Assistant"
 * item — no more always-visible corner button (it sat on top of page
 * content on every screen and collided with sticky save bars). Mounted once
 * at the app-shell level; see `<AiChatPanel />` in floating-ai-launcher.tsx.
 */
export function AiPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(() => ({ open, openPanel, closePanel, toggle }), [open, openPanel, closePanel, toggle]);
  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}

export function useAiPanel(): AiPanelContextValue {
  const ctx = useContext(AiPanelContext);
  if (!ctx) throw new Error("useAiPanel must be used within <AiPanelProvider>");
  return ctx;
}
