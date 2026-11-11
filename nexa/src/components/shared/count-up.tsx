"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a number that counts up from 0 to `value` once (about 0.9 s), then
 * stays put; later changes jump straight to the new value. Reduced-motion
 * users get the final number as soon as the page is interactive.
 */
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  // Start at 0 everywhere (server too): starting at the value made the number flash full → 0 → full.
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !Number.isFinite(value) || value === 0) {
      setShown(value);
      return;
    }
    done.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    let t0: number | null = null;
    const step = (ts: number) => {
      t0 ??= ts;
      const k = Math.min((ts - t0) / 900, 1);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} suppressHydrationWarning>
      {shown.toFixed(decimals)}
    </span>
  );
}
