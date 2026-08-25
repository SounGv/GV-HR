import { cn } from "@/lib/utils";

/**
 * The one shared logo component — every header/sidebar/auth-page logo
 * renders through this instead of an ad-hoc `<img>`, so a future brand
 * asset swap is a one-file change. Source is the real Gadget Villa company
 * logo (public/gadgetvilla-logo.png, supplied by the company — not a
 * recreation), square, white background baked in, no transparency — any
 * frame styling (rounding, etc.) belongs on the wrapper via `className`.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/gadgetvilla-logo.png"
      alt="Gadget Villa"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
