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
        "h-14 w-full rounded-[14px] bg-[var(--login-brand-green)] text-[17px] font-semibold text-white hover:bg-[var(--login-brand-green-dark)]",
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
