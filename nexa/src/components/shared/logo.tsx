import { cn } from "@/lib/utils";

/**
 * The one shared logo component — every header/sidebar/auth-page logo
 * renders through this instead of an ad-hoc `<img>`, so a future brand
 * asset swap is a one-file change. Source is the real Gadget Villa company
 * logo (supplied by the company, not a recreation) with its background
 * made transparent so it sits directly on any surface.
 *
 * The "GADGET VILLA" wordmark under the mark is dark text baked into the
 * artwork — legible on a light surface but not on a dark one, so there are
 * two recolored variants of the same file: `variant="light"` (default,
 * dark wordmark — use on light backgrounds) and `variant="dark"` (wordmark
 * relit to near-white — use on dark backgrounds like the sidebar/auth
 * panel). Only the wordmark pixels differ between the two files; the GV
 * mark itself is identical.
 */
export function Logo({
  size = 40,
  className,
  variant = "light",
}: {
  size?: number;
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variant === "dark" ? "/gadgetvilla-logo-dark-bg.png" : "/gadgetvilla-logo.png"}
      alt="Gadget Villa"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
