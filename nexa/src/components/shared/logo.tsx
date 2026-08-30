import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The one shared logo component — every header/sidebar/auth-page logo
 * renders through this instead of an ad-hoc `<img>`, so a future brand
 * asset swap is a one-file change. Source is the app icon mark (clock +
 * checkmark), background-removed to a true transparent PNG so it sits
 * directly on any surface.
 *
 * The mark's rim is near-black, which would nearly disappear against the
 * dark sidebar/auth-panel background (`--sidebar: #15200f`) — so
 * `variant="dark"` uses a copy with a soft cream glow behind the mark to
 * keep its edge visible there, while `variant="light"` (default) is the
 * plain mark for light backgrounds. Same artwork in both; only the glow
 * differs.
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
    <Image
      src={variant === "dark" ? "/gadgetvilla-logo-dark-bg.png" : "/gadgetvilla-logo.png"}
      alt="Gadget Villa"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * Full horizontal lockup — icon + "GV ONE" wordmark + "AI WORKFORCE
 * PLATFORM" subtitle, all baked into one image (source is 2010×668, ratio
 * ~3.01:1). Used wherever the full brand mark should read as one unit
 * (login page, site header) instead of the icon-plus-separately-styled-text
 * composition. `variant="dark"` recolors the wordmark/subtitle ink to a
 * light cream for dark surfaces — the icon itself is untouched, same as
 * `Logo`'s dark variant.
 */
export function LogoHorizontal({
  height = 48,
  className,
  variant = "light",
}: {
  height?: number;
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      src={variant === "dark" ? "/gv-one-horizontal-logo-dark-bg.png" : "/gv-one-horizontal-logo.png"}
      alt="GV One — AI Workforce Platform"
      height={height}
      width={Math.round(height * (2010 / 668))}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
