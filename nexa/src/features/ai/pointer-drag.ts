import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Starts a mouse or pen drag from a resize handle and reports how far the pointer has moved
 * since the press (dx, dy in pixels). Listens on the window so the drag keeps going when the
 * pointer leaves the thin handle, and blocks text selection until it ends.
 *
 * @param e The pointerdown event on the handle.
 * @param cursor CSS cursor to keep while dragging, so it does not flicker over other elements.
 * @param onMove Called on every move with the distance from the starting point.
 * @param onEnd Called once when the pointer is released or the drag is cancelled.
 */
export function beginPointerDrag(
  e: ReactPointerEvent,
  cursor: string,
  onMove: (dx: number, dy: number) => void,
  onEnd: () => void,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY);
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    onEnd();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  document.body.style.userSelect = "none";
  document.body.style.cursor = cursor;
}
