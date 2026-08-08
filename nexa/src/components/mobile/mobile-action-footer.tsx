"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface MobileActionFooterProps {
  children: React.ReactNode;
  className?: string;
}

/** Fixed bottom action bar — sits above the global bottom nav on mobile. */
export function MobileActionFooter({ children, className }: MobileActionFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-lg md:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface MobilePrimaryButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean;
}

export function MobilePrimaryButton({
  children,
  className,
  loading,
  disabled,
  ...props
}: MobilePrimaryButtonProps) {
  return (
    <Button
      type="button"
      className={cn("h-12 w-full rounded-xl text-base font-semibold", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" /> : children}
    </Button>
  );
}
