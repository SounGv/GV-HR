import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Icon-prefixed text input for the login card — email/username field. */
export const LoginInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { icon: React.ReactNode }>(
  function LoginInput({ icon, className, ...props }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4.5 -translate-y-1/2 text-[var(--login-text-secondary)]">
          {icon}
        </span>
        <Input
          ref={ref}
          className={cn(
            "h-12 rounded border border-[var(--lg-field)] !bg-white pl-12 text-base text-[var(--login-text-primary)] placeholder:text-[var(--login-text-secondary)] focus-visible:border-[#1976d2] focus-visible:ring-[#1976d2]/25",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
