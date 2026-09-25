import Image from "next/image";
import { cn } from "@/lib/utils";

/** Login-page brand mark: the real GV lockup image plus "One HR" as live text. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3.5", className)}>
      <Image
        src="/gv-logo.png"
        alt="GV Gadget Villa"
        width={200}
        height={120}
        priority
        className="h-[120px] w-[200px] object-contain"
      />
      <div className="text-xl leading-tight font-bold text-[var(--login-text-primary)]">One HR</div>
    </div>
  );
}
