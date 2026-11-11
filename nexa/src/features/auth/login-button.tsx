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
        "h-12 w-full rounded-xl bg-[linear-gradient(150deg,#115e59,#0f766e_55%,#0d9488)] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_10px_20px_-10px_rgba(15,118,110,.7),inset_0_1px_0_rgba(255,255,255,.18)] hover:brightness-105 active:scale-[0.98] motion-reduce:active:scale-100",
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
