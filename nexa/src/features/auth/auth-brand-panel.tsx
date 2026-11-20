import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/shared/logo";

/**
 * Dark brand half of the desktop sign-up / recovery pages. Everything on it is
 * set in white or the sidebar's teal: the app's `--primary` is charcoal in the
 * light theme and the global heading rule paints headings in the foreground
 * colour, so both would vanish on this charcoal surface.
 */
export function AuthBrandPanel({
  eyebrow,
  headline,
  subtitle,
  children,
  footer,
  cornerLogo = true,
}: {
  eyebrow?: string;
  headline?: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  cornerLogo?: boolean;
}) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0d47a1] dark:bg-[#0a2f6b] p-10 text-white lg:flex xl:p-14">
      {/* ambient glow */}

      {cornerLogo ? (
        <Link href="/login" className="relative flex items-center gap-3">
          <Logo size={44} className="size-11" />
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">GV ONE</div>
            <div className="text-xs tracking-[0.18em] text-slate-400">AI WORKFORCE PLATFORM</div>
          </div>
        </Link>
      ) : (
        <span />
      )}

      <div className="relative max-w-xl space-y-8">
        <div className="space-y-5">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ">
              <Sparkles className="size-3.5 text-sidebar-primary" aria-hidden="true" /> {eyebrow}
            </span>
          )}
          {headline && (
            <h1 className="font-heading text-3xl leading-[1.3] font-bold text-white lg:text-4xl xl:text-5xl">{headline}</h1>
          )}
          {subtitle && <p className="max-w-md text-base leading-relaxed text-slate-300">{subtitle}</p>}
        </div>

        {children}
      </div>

      <div className="relative flex items-center justify-between text-xs text-slate-400">
        <span>© {new Date().getFullYear()} GV One AI Workforce Platform</span>
        {footer}
      </div>
    </div>
  );
}
