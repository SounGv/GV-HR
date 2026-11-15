"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { VBot } from "@/components/shared/v-bot";

import { useAiAccess } from "./hooks";
import { AiChatView } from "./ai-chat-view";
import { useAiPanel } from "./ai-panel-context";
import { beginPointerDrag } from "./pointer-drag";

interface PanelSize {
  w: number;
  h: number;
}

/** 27rem x 38rem, the size before the panel could be resized. */
const DEFAULT_SIZE: PanelSize = { w: 432, h: 608 };
const MIN_W = 360;
const MIN_H = 420;
/** Gap kept to the window edges (the panel sits 24px from the right and bottom). */
const EDGE = 48;
const SIZE_KEY = "gv-ai-float-size";
const KEY_STEP = 24;

/** Keeps the size inside the window: never smaller than the minimum, never larger than the screen leaves room for. */
function clampSize(s: PanelSize): PanelSize {
  const maxW = Math.max(MIN_W, window.innerWidth - EDGE);
  const maxH = Math.max(MIN_H, window.innerHeight - EDGE);
  return { w: Math.round(Math.min(Math.max(s.w, MIN_W), maxW)), h: Math.round(Math.min(Math.max(s.h, MIN_H), maxH)) };
}

/** The size the person chose, remembered per browser. Read after mount so the first frame matches the server. */
function usePanelSize() {
  const [size, setSize] = useState<PanelSize>(DEFAULT_SIZE);
  const latest = useRef(size);

  useEffect(() => {
    const apply = (s: PanelSize) => {
      const c = clampSize(s);
      latest.current = c;
      setSize(c);
    };
    try {
      const raw = window.localStorage.getItem(SIZE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<PanelSize>;
        if (typeof p.w === "number" && typeof p.h === "number") apply({ w: p.w, h: p.h });
      }
    } catch {
      // Storage can be blocked or hold junk; the default size still works.
    }
    const onResize = () => apply(latest.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const save = useCallback(() => {
    try {
      window.localStorage.setItem(SIZE_KEY, JSON.stringify(latest.current));
    } catch {
      // Not remembered, still applied for this visit.
    }
  }, []);

  const update = useCallback((next: PanelSize, remember = true) => {
    const c = clampSize(next);
    latest.current = c;
    setSize(c);
    if (remember) save();
  }, [save]);

  return { size, latest, update, save };
}

/**
 * The floating AI chat panel — desktop only, opened from the sidebar's "AI
 * Assistant" item (see AppSidebar) instead of a persistent corner button
 * (that button sat on top of page content on every screen and collided with
 * sticky save bars). On mobile the bottom nav/drawer already routes to the
 * full /ai page, so this is never shown there.
 */
export function AiChatPanel() {
  const pathname = usePathname();
  const { data: aiAccess } = useAiAccess();
  const { open, closePanel } = useAiPanel();
  const { size, latest, update } = usePanelSize();

  if (!open || pathname === "/ai" || !aiAccess?.data.allowed) return null;

  // The panel is anchored to the bottom right, so pulling the left or top edge makes it bigger.
  const drag = (e: ReactPointerEvent, axis: "x" | "y" | "xy") => {
    const start = latest.current;
    const cursor = axis === "x" ? "ew-resize" : axis === "y" ? "ns-resize" : "nwse-resize";
    beginPointerDrag(
      e,
      cursor,
      (dx, dy) => update({ w: axis === "y" ? start.w : start.w - dx, h: axis === "x" ? start.h : start.h - dy }, false),
      () => update(latest.current),
    );
  };
  const keys = (e: KeyboardEvent, axis: "x" | "y") => {
    const dir = axis === "x" ? (e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0) : e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (e.key === "Home") {
      e.preventDefault();
      update(DEFAULT_SIZE);
      return;
    }
    if (dir === 0) return;
    e.preventDefault();
    const s = latest.current;
    update(axis === "x" ? { w: s.w + dir * KEY_STEP, h: s.h } : { w: s.w, h: s.h + dir * KEY_STEP });
  };
  const reset = () => update(DEFAULT_SIZE);
  const hint = "ลากเพื่อปรับขนาด ดับเบิลคลิกเพื่อคืนขนาดเดิม";

  return (
    <div
      role="dialog"
      aria-label="AI Assistant"
      style={{ width: size.w, height: size.h }}
      className="fixed right-6 bottom-6 z-50 hidden max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl md:flex"
    >
      {/* Resize handles: left edge, top edge and the top left corner. Arrow keys also work; Home puts the size back. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="ปรับความกว้างของช่องแชท"
        aria-valuemin={MIN_W}
        aria-valuenow={size.w}
        tabIndex={0}
        title={hint}
        onPointerDown={(e) => drag(e, "x")}
        onDoubleClick={reset}
        onKeyDown={(e) => keys(e, "x")}
        className="group absolute inset-y-6 left-0 z-10 w-2.5 cursor-ew-resize touch-none outline-none focus-visible:bg-ring/30"
      >
        <span className="absolute top-1/2 left-[3px] h-14 w-1 -translate-y-1/2 rounded-full bg-muted-foreground/45 transition-colors group-hover:bg-primary group-focus-visible:bg-primary" aria-hidden="true" />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="ปรับความสูงของช่องแชท"
        aria-valuemin={MIN_H}
        aria-valuenow={size.h}
        tabIndex={0}
        title={hint}
        onPointerDown={(e) => drag(e, "y")}
        onDoubleClick={reset}
        onKeyDown={(e) => keys(e, "y")}
        className="group absolute inset-x-14 top-0 z-10 h-2.5 cursor-ns-resize touch-none outline-none focus-visible:bg-white/30"
      >
        <span className="absolute top-[3px] left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-white/50 transition-colors group-hover:bg-white" aria-hidden="true" />
      </div>
      <div
        aria-hidden="true"
        title={hint}
        onPointerDown={(e) => drag(e, "xy")}
        onDoubleClick={reset}
        className="absolute top-0 left-0 z-20 size-6 cursor-nwse-resize touch-none"
      />
      <div className="flex items-center gap-3 bg-[var(--chat-teal)] px-4 py-3 text-white">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-white/25" aria-hidden="true">
          <VBot mood="hi" className="h-7 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">AI Assistant</p>
          <p className="text-xs leading-tight text-white/85">น้องวีบอท · ตอบจากข้อมูลจริง</p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="ปิด AI Assistant"
          className="flex size-11 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white md:size-9"
        >
          <X className="size-5" />
        </button>
      </div>
      <AiChatView className="h-full flex-1 rounded-none border-0 shadow-none" />
    </div>
  );
}
