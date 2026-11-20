import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The one shared logo component — every header/sidebar/auth-page logo renders through this, so a brand change is a one-file
 * change. Since 2026-11-20 (owner: no green logo) it is the white "GV" on the Favpo blue, the same tile as the app icon, drawn in
 * text so it needs no image and sits on any surface. `size` is the width and height in px; the inline style wins over a caller's
 * size classes.
 */
export function Logo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="GV One"
      style={{ width: size, height: size, lineHeight: `${size}px`, fontSize: Math.round(size * 0.42) }}
      className={cn("shrink-0 rounded-md bg-[#0d47a1] text-center font-bold tracking-tight text-white", className)}
    >
      GV
    </span>
  );
}

/**
 * Full lockup — GV mark + "GADGET VILLA" wordmark baked into one image
 * (source is 720×431, ratio ~1.67:1). Used wherever the full brand mark
 * should read as one unit (login page, site header). Transparent PNG, so
 * it sits directly on any surface without a dark variant.
 */
export function LogoHorizontal({
  height = 48,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/gv-logo.png"
      alt="Gadget Villa"
      height={height}
      width={Math.round(height * (720 / 431))}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * The same full lockup for dark surfaces: the rule line and the GADGET VILLA name are light instead of black (they vanish on a dark
 * ground), the mark is unchanged. Cut from the company logo with the white background removed, so it sits directly on the surface.
 */
export function LogoOnDark({
  height = 56,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src="/gv-logo-on-dark.png"
      alt="Gadget Villa"
      height={height}
      width={Math.round(height * (900 / 530))}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
