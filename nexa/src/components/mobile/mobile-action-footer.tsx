import { cn } from "@/lib/utils";

export function MobileActionFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MobilePrimaryButton({
  children,
  disabled,
  type = "button",
  form,
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[50px] w-full items-center justify-center rounded-[10px] text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed",
        disabled
          ? "bg-surface-muted text-muted-foreground"
          : "bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-primary-foreground shadow-sm shadow-primary/20 active:brightness-95",
        className,
      )}
    >
      {children}
    </button>
  );
}
