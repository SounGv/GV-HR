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
