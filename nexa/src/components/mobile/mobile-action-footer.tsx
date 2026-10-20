import { cn } from "@/lib/utils";

/**
 * The action bar at the foot of a phone form. It sits just above the bottom
 * tab bar (fixed, h-16, z-40), which is always shown on phones: as a sticky
 * bar at the very bottom it slid underneath the tabs while scrolling, hiding
 * the send button. A spacer of the same height keeps the last fields clear.
 */
export function MobileActionFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="h-24 shrink-0 md:hidden" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card px-4 py-3 md:hidden",
          className,
        )}
      >
        {children}
      </div>
    </>
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
          : "bg-primary text-primary-foreground shadow-sm shadow-primary/20 active:brightness-95",
        className,
      )}
    >
      {children}
    </button>
  );
}
