import { avatarInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CharacterAvatar, characterFor } from "./character-avatar";

/**
 * Small round picture in front of a person's name in lists. When the caller
 * knows the person's gender (pass `gender`, even null) it draws their
 * character (ชาย / หญิง / neutral, varied by `seed`); otherwise it falls back
 * to the initials badge.
 *
 * @param name The displayName() string; the nickname in brackets is preferred for the letters.
 * @param gender MALE / FEMALE / OTHER / null from the employee record.
 * @param seed Employee id (best) or anything stable; defaults to the name.
 */
export function PersonAvatar({
  name,
  gender,
  seed,
  className,
}: {
  name: string;
  gender?: string | null;
  seed?: string;
  className?: string;
}) {
  if (gender !== undefined) {
    return <CharacterAvatar character={characterFor({ gender })} seed={seed ?? name} className={cn("size-[30px]", className)} />;
  }
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
