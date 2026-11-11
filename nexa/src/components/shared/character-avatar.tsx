import { useId } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** Who the avatar draws: an employee by gender, or the GV mark for an account with no employee record. */
export type AvatarCharacter = "MALE" | "FEMALE" | "OTHER" | "BOT";

/** Maps the employee's stored gender (or no employee) to a character; unknown gender gets the neutral one. */
export function characterFor(employee: { gender?: string | null } | null | undefined): AvatarCharacter {
  if (!employee) return "BOT";
  if (employee.gender === "MALE" || employee.gender === "FEMALE") return employee.gender;
  return "OTHER";
}

const SKIN = "#f6cfaa";
const SKIN_SHADE = "#e9b78f";
const HAIR = "#2b2320";
const SHIRT = "#0f766e";
const LIME = "#CDEB03";

/**
 * Round character picture used when a person has no photo (GV One look:
 * teal shirt, lime GV badge). Men get short hair, women longer hair, anyone
 * else a soft neutral cut; an account with no employee record (admin) gets
 * the GV mark — น้องวีบอท stays on the AI shortcut only. Purely decorative (aria-hidden): the name is always shown beside it.
 *
 * @param character From characterFor().
 * @param className Size it with size-* classes; it fills its box.
 */
export function CharacterAvatar({ character, className }: { character: AvatarCharacter; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (character === "BOT") {
    return (
      <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(150deg,#ecfeff,#ccfbf1)]", className)}>
        <Logo size={40} className="h-auto w-[76%]" />
      </span>
    );
  }
  const bg = character === "FEMALE" ? ["#fdf2f8", "#ccfbf1"] : ["#ecfeff", "#ccfbf1"];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={cn("shrink-0 rounded-full", className)}>
      <defs>
        <linearGradient id={`av-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <clipPath id={`av-clip-${id}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-clip-${id})`}>
        <rect width="64" height="64" fill={`url(#av-bg-${id})`} />
        {/* Long hair falls behind the shoulders. */}
        {character === "FEMALE" && <path d="M17.5 29c0-10.5 6.5-17 14.5-17s14.5 6.5 14.5 17v15c-3.5 2.4-7 2.6-10 1.4V29H27v16.4c-3 1.2-6.5 1-9.5-1.4z" fill={HAIR} />}
        {/* Shoulders, collar and the lime GV badge. */}
        <path d="M8 66c0-12.5 10.5-20.5 24-20.5S56 53.5 56 66z" fill={SHIRT} />
        <path d="M26.5 45.8 32 52l5.5-6.2" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="44" cy="54.5" r="2.6" fill={LIME} />
        {/* Neck and face. */}
        <path d="M28 38h8v7.5c-2.4 2-5.6 2-8 0z" fill={SKIN_SHADE} />
        <circle cx="32" cy="29" r="11.5" fill={SKIN} />
        <circle cx="20.8" cy="30" r="2.2" fill={SKIN_SHADE} />
        <circle cx="43.2" cy="30" r="2.2" fill={SKIN_SHADE} />
        {/* Hair on top. */}
        {character === "MALE" && <path d="M20.3 28.5c-.8-9.3 4.6-15.3 12-15.3 7.6 0 12.6 5.4 11.5 14.8-1.4-3.8-3.4-5.8-6.2-6.6-3.6 2-9.5 2.7-14.6 1.6-1.4 1.4-2.3 3.2-2.7 5.5z" fill={HAIR} />}
        {character === "FEMALE" && <path d="M20.4 28.8c-.6-9.6 5-15.6 11.6-15.6 7 0 12.3 5.6 11.6 15-3.8-1-7.6-3.6-9.7-7.4-2.6 4.2-7.6 7-13.5 8z" fill={HAIR} />}
        {character === "OTHER" && <path d="M20.4 29c-1-9.5 4.6-15.8 11.6-15.8s12.6 6.3 11.6 15.8c-1.6-4.4-4.4-6.8-7.8-7.6-2.4 1.8-5.4 2.6-8.6 2.4-2.8 1-5.4 2.8-6.8 5.2z" fill="#4a3b33" />}
        {character === "FEMALE" && <circle cx="41.5" cy="19.5" r="2" fill={LIME} />}
        {/* Eyes and smile. */}
        <ellipse cx="27.6" cy="30.2" rx="1.5" ry="1.8" fill={HAIR} />
        <ellipse cx="36.4" cy="30.2" rx="1.5" ry="1.8" fill={HAIR} />
        <path d="M28.6 34.6q3.4 3 6.8 0" fill="none" stroke="#9a5a3a" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="25" cy="34" r="1.6" fill="#f9a8a8" fillOpacity=".55" />
        <circle cx="39" cy="34" r="1.6" fill="#f9a8a8" fillOpacity=".55" />
      </g>
    </svg>
  );
}
