import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Icon-prefixed text input for the login card — email/username field. */
export const LoginInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { icon: React.ReactNode }>(
  function LoginInput({ icon, className, ...props }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--login-brand-green-dark)]">
          {icon}
        </span>
        <Input
          ref={ref}
          className={cn(
            "h-[52px] rounded-[11px] border-[var(--login-border)] !bg-[var(--login-surface)] pl-11 text-[15px] text-[var(--login-text-primary)] placeholder:text-[var(--login-text-secondary)] focus-visible:border-[var(--login-brand-green)] focus-visible:ring-[var(--login-brand-green)]/15",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
