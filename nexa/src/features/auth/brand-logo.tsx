import { cn } from "@/lib/utils";

/**
 * Login-page brand mark: a flat vector icon (crisp at any size, unlike the
 * raster gadgetvilla-logo.png clock mark, which looked muddy at this small
 * a display size) plus "Gadget Villa" as live text — never the
 * gv-one-horizontal-logo.png lockup, which has "GV ONE" baked into the
 * image pixels and can't be relabeled.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <svg viewBox="0 0 100 100" className="size-11 shrink-0" aria-hidden="true">
        <path
          d="M 76 28 A 38 38 0 1 0 88 50"
          fill="none"
          stroke="var(--login-brand-green)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 36 52 L 48 64 L 76 34"
          fill="none"
          stroke="var(--login-brand-lime)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-2xl font-bold text-[var(--login-brand-green)]">Gadget Villa</span>
    </div>
  );
}
