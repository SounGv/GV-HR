import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A page's own "back" link, shown on phones only. On desktop the top bar's
 * ย้อนกลับ button is the single back control (13 Nov 2026: pages showed two
 * arrows going different places). 44px tall to meet the GV One touch-target
 * rule; `onHero` is for the dark teal page banners.
 */
export function BackLink({
  href,
  onClick,
  children,
  onHero = false,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  onHero?: boolean;
  className?: string;
}) {
  const cls = cn(
    "-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition",
    // A link to another page is covered by the top bar's ย้อนกลับ on desktop; a button
    // (onClick) steps back inside the page itself, so it stays everywhere.
    href && "md:hidden",
    onHero ? "text-white/85 hover:bg-white/12 hover:text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    className,
  );
  const body = (
    <>
      <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
