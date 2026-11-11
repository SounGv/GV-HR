import { avatarInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Small round initials badge in front of a person's name in dashboard lists.
 *
 * @param name The displayName() string; the nickname in brackets is preferred for the letters.
 */
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(150deg,#ccfbf1,#99f6e4)] text-[11.5px] font-semibold text-[#0f766e]",
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}
