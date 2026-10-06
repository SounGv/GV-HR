import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff, Lock, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a left lock icon and a right show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);

    /** Reads the Caps Lock state from a key event so the warning follows the real keyboard. */
    const syncCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
      setCapsLockOn(e.getModifierState("CapsLock"));
    };

    return (
      <div>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--login-text-secondary)]" />
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn(
              "h-[52px] rounded-[12px] border-[var(--login-border)] !bg-[var(--login-surface)] pr-11 pl-11 text-[15px] text-[var(--login-text-primary)] placeholder:text-[var(--login-text-secondary)] focus-visible:border-[var(--login-brand-green)] focus-visible:ring-[var(--login-brand-green)]/15",
              className,
            )}
            {...props}
            onKeyDown={(e) => {
              syncCapsLock(e);
              props.onKeyDown?.(e);
            }}
            onKeyUp={(e) => {
              syncCapsLock(e);
              props.onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLockOn(false);
              props.onBlur?.(e);
            }}
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
        {capsLockOn && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--login-text-primary)]" role="status">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            Caps Lock เปิดอยู่ ตัวพิมพ์ใหญ่-เล็กในรหัสผ่านอาจไม่ตรง
          </p>
        )}
      </div>
    );
  },
);
