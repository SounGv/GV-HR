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
        "h-12 w-full rounded bg-[#1976d2] text-base font-medium text-white hover:bg-[#1565c0] active:scale-[0.99] motion-reduce:active:scale-100",
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {children}
      {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />}
    </Button>
  );
}
