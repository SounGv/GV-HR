import { cn } from "@/lib/utils";

/**
 * The one shared "GV One" mark component — every header/sidebar/auth-page
 * logo renders through this instead of an ad-hoc `<img>`, so a future brand
 * asset swap is a one-file change. Source file is white-background with no
 * border/shadow baked in (2026-08-25 icon/logo spec) — any frame styling
 * (rounding, drop shadow, etc.) belongs on the wrapper via `className`, not
 * on the asset itself.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/nexa-logo.svg"
      alt="GV One"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
