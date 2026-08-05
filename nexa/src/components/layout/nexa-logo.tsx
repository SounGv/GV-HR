import { cn } from "@/lib/utils";

/** GV One brand lockup — a rounded gradient mark + wordmark. */
export function NexaLogo({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-base font-bold text-primary shadow-sm">
        G
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-white">GV ONE</div>
          <div className="text-[10px] font-medium tracking-[0.18em] text-slate-400">
            PEOPLE PLATFORM
          </div>
        </div>
      )}
    </div>
  );
}
