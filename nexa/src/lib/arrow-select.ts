import type { KeyboardEvent } from "react";

/**
 * Arrow keys (and Home / End) move through the radios or tabs of one group and pick, as native ones do.
 * Put it on the element with role="radiogroup" or role="tablist"; each item is a button with role="radio" or
 * role="tab", and only the picked one (or the first when none is picked) has tabIndex 0, so Tab enters the
 * group once and the arrows move inside it.
 */
export function arrowSelect(e: KeyboardEvent<HTMLElement>) {
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled), [role="tab"]:not(:disabled)'),
  );
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (at === -1 || items.length === 0) return;
  let to = -1;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") to = (at + 1) % items.length;
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = (at - 1 + items.length) % items.length;
  else if (e.key === "Home") to = 0;
  else if (e.key === "End") to = items.length - 1;
  if (to === -1) return;
  e.preventDefault();
  items[to].focus();
  items[to].click();
}
