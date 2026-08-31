import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a left lock icon and a right show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--login-brand-green-dark)]" />
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "h-[52px] rounded-[11px] border-[var(--login-border)] !bg-[var(--login-surface)] pr-11 pl-11 text-[15px] text-[var(--login-text-primary)] placeholder:text-[var(--login-text-secondary)] focus-visible:border-[var(--login-brand-green)] focus-visible:ring-[var(--login-brand-green)]/15",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[var(--login-text-secondary)] hover:text-[var(--login-text-primary)]"
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
