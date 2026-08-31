import { cn } from "@/lib/utils";

export function LoginCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[520px] rounded-[22px] border border-[var(--login-border)] bg-[var(--login-surface)] p-6 shadow-[0_20px_60px_-25px_rgba(24,85,31,0.25)] sm:p-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
