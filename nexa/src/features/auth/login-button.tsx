import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoginButton({
  loading,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button
      size="lg"
      className={cn(
        "h-[52px] w-full rounded-[11px] bg-[var(--login-brand-green)] text-base text-white hover:bg-[var(--login-brand-green-dark)]",
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
