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
        "h-[54px] w-full rounded-full bg-[linear-gradient(180deg,#14b8a6,#0f766e)] text-[17px] font-bold text-white shadow-[0_12px_26px_rgba(15,118,110,.38),inset_0_1px_0_rgba(255,255,255,.5),inset_0_-2px_6px_rgba(0,0,0,.12)] hover:brightness-105 active:scale-[0.98] motion-reduce:active:scale-100",
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
