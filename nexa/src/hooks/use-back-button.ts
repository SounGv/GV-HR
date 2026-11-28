"use client";

import { useEffect, useRef } from "react";

/** Until this time (ms since epoch) a `popstate` is the one our own cleanup caused with `history.back()`, not a press of back. */
let ownPopUntil = 0;
/** The pending `history.back()` of a flow that just closed. A flow that opens again at once (React's dev double-run) takes the entry over instead. */
let pendingPop: ReturnType<typeof setTimeout> | null = null;

/**
 * Makes the phone's back button (or the back swipe) step through a full-screen flow instead of leaving the app.
 *
 * While `active`, one history entry is pushed so a press of back produces a `popstate` here instead of leaving the
 * page. `onBack` then decides: return "stay" to keep the flow open (for example, go back one step) and a fresh entry
 * is pushed for the next press, or "leave" when it has closed the flow itself. If the flow ends some other way
 * (a Close button, finishing), the cleanup pops the entry it pushed so history does not grow by one each time.
 *
 * @param active Whether the flow is open.
 * @param onBack Called on each press of back; may read the latest state (the newest function is always used).
 */
export function useBackButton(active: boolean, onBack: () => "stay" | "leave") {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    let pushed = true;
    if (pendingPop) {
      // Closed and opened again in the same moment: keep the entry that is already there.
      clearTimeout(pendingPop);
      pendingPop = null;
    } else {
      window.history.pushState({ flowBack: true }, "");
    }

    function onPopState() {
      if (Date.now() < ownPopUntil) return;
      pushed = false; // the browser already took our entry away
      if (onBackRef.current() === "stay") {
        window.history.pushState({ flowBack: true }, "");
        pushed = true;
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (!pushed) return;
      pendingPop = setTimeout(() => {
        pendingPop = null;
        ownPopUntil = Date.now() + 500;
        window.history.back();
      }, 0);
    };
  }, [active]);
}
