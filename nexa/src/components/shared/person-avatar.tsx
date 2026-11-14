import { avatarInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CharacterAvatar, characterFor } from "./character-avatar";

/**
 * Small round picture in front of a person's name in lists. Shows the person's photo when `src` is
 * given (the character is drawn behind it until it loads, and stays if it fails to load). With no
 * photo and a known gender (pass `gender`, even null) it draws their character (ชาย / หญิง / neutral,
 * varied by `seed`); with neither it falls back to the initials badge.
 *
 * @param name The displayName() string; the nickname in brackets is preferred for the letters.
 * @param gender MALE / FEMALE / OTHER / null from the employee record.
 * @param seed Employee id (best) or anything stable; defaults to the name.
 * @param src The employee's photo address (`avatarUrl`); leave out or pass null when there is none.
 */
export function PersonAvatar({
  name,
  gender,
  seed,
  src,
  className,
}: {
  name: string;
  gender?: string | null;
  seed?: string;
  src?: string | null;
  className?: string;
}) {
  const character =
    gender !== undefined ? (
      <CharacterAvatar character={characterFor({ gender })} seed={seed ?? name} className="size-full" />
    ) : (
      <span
        aria-hidden="true"
        className="flex size-full items-center justify-center rounded-full bg-[linear-gradient(150deg,#ccfbf1,#99f6e4)] font-semibold text-[#0f766e]"
      >
        {avatarInitials(name)}
      </span>
    );

  if (!src) {
    return (
      <span aria-hidden="true" className={cn("inline-flex size-[30px] shrink-0 rounded-full text-[11.5px]", className)}>
        {character}
      </span>
    );
  }
  return (
    <Avatar aria-hidden="true" className={cn("size-[30px] text-[11.5px]", className)}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback className="bg-transparent p-0">{character}</AvatarFallback>
    </Avatar>
  );
}
