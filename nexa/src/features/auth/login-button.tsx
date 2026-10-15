import { ArrowRight, Loader2 } from "lucide-react";
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
        "h-[54px] w-full rounded-full bg-[var(--login-brand-green)] text-base font-semibold text-white shadow-[var(--login-button-shadow)] hover:bg-[var(--login-brand-green-dark)] active:scale-[0.98] motion-reduce:active:scale-100",
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {children}
      {loading ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />
      ) : (
        <ArrowRight className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
