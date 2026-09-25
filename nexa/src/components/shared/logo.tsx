import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The one shared logo component — every header/sidebar/auth-page logo
 * renders through this instead of an ad-hoc `<img>`, so a future brand
 * asset swap is a one-file change. Source is the real GV mark (icon only,
 * no wordmark), a true transparent PNG (720×431 native, ~2.08:1) so it
 * sits directly on any surface — light or dark — without a variant swap.
 */
export function Logo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/gv-mark.png"
      alt="Gadget Villa"
      width={size}
      height={Math.round(size * (231 / 480))}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
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
