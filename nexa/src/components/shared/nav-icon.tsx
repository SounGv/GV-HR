import { navIconArt } from "@/config/nav-icon-art";
import { cn } from "@/lib/utils";

/**
 * The small icon in front of a sub-menu entry in the side menu (16px, an outline in the current text colour). An entry the
 * set does not know gets nothing, so a new menu item without an icon still shows as plain text. The art is a fixed string
 * from `nav-icon-art.ts`, not user input.
 */
export function NavIcon({ href, className }: { href: string; className?: string }) {
  const art = navIconArt(href);
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("gv-nav-ico size-4 shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}
