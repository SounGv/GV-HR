import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/shared/logo";

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
    <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/25 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-primary/10 blur-[120px]" />

      {cornerLogo ? (
        <Link href="/login" className="relative flex items-center gap-3">
          <Logo size={48} className="size-12 rounded-2xl" />
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">GV ONE</div>
            <div className="text-[11px] tracking-[0.18em] text-slate-400">AI WORKFORCE PLATFORM</div>
          </div>
        </Link>
      ) : (
        <span />
      )}

      <div className="relative space-y-6">
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            <Sparkles className="size-3.5 text-primary" /> {eyebrow}
          </span>
        )}
        {headline && (
          <h1 className="font-heading text-3xl leading-[1.2] font-bold lg:text-4xl">{headline}</h1>
        )}
        {subtitle && <p className="max-w-md text-sm text-slate-400">{subtitle}</p>}

        {children}
      </div>

      <div className="relative flex items-center justify-between text-xs text-slate-500">
        <span>© {new Date().getFullYear()} GV One AI Workforce Platform</span>
        {footer}
      </div>
    </div>
  );
}
