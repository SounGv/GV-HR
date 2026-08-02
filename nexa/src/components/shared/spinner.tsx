import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Single inline loading spinner. Replaces ad-hoc `Loader2 + animate-spin` copies. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}
