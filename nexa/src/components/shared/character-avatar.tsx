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

const LIME = "#CDEB03";
/** Skin, its shade, hair and shirt palettes; the person's seed picks one of each so a list never looks cloned. */
const SKINS: [string, string][] = [
  ["#f6cfaa", "#e9b78f"],
  ["#ecbd94", "#dca47a"],
  ["#d9a27c", "#c48b64"],
];
const HAIRS = ["#2b2320", "#3d2a20", "#1c1917"];
const SHIRTS = ["#0f766e", "#115e59", "#0d9488"];

/** Stable small number from a string (employee id or name), so the same person always looks the same. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Hair drawn behind the head (long and bob cuts fall past the face). */
function BackHair({ character, style, color }: { character: AvatarCharacter; style: number; color: string }) {
  if (character !== "FEMALE") return null;
  if (style === 0) return <path d="M17.5 29c0-10.5 6.5-17 14.5-17s14.5 6.5 14.5 17v15c-3.5 2.4-7 2.6-10 1.4V29H27v16.4c-3 1.2-6.5 1-9.5-1.4z" fill={color} />;
  if (style === 1) return <path d="M18 30c0-10 6.2-16.5 14-16.5S46 20 46 30v8.5c-2.8 1.6-5.4 1.8-8 1V29H26v10.5c-2.6.8-5.2.6-8-1z" fill={color} />;
  return <circle cx="32" cy="13" r="5.5" fill={color} />;
}

/** Hair on top of the head: three cuts each for men and women, one soft cut otherwise. */
function FrontHair({ character, style, color }: { character: AvatarCharacter; style: number; color: string }) {
  if (character === "MALE") {
    if (style === 0) return <path d="M20.3 28.5c-.8-9.3 4.6-15.3 12-15.3 7.6 0 12.6 5.4 11.5 14.8-1.4-3.8-3.4-5.8-6.2-6.6-3.6 2-9.5 2.7-14.6 1.6-1.4 1.4-2.3 3.2-2.7 5.5z" fill={color} />;
    if (style === 1) return <path d="M20.5 27.5c0-8.6 5-14 11.5-14s11.5 5.4 11.5 14c-2-3.2-5.6-4.6-11.5-4.6s-9.5 1.4-11.5 4.6z" fill={color} />;
    return <path d="M20.4 28c-.4-8 3.8-13.6 10-14.4l1.6-2.4 1.4 2.3 2-1.6.6 2.4c5 1.6 8.2 6.4 7.6 13.4-1.8-3.6-4.6-5.6-11.6-5.6s-9.8 2.2-11.6 5.9z" fill={color} />;
  }
  if (character === "FEMALE") {
    if (style === 1) return <path d="M20.6 27c.4-8 5.2-13 11.4-13s11 5 11.4 13c-4-1.8-8-2.4-11.4-2.4S24.6 25.2 20.6 27z" fill={color} />;
    return <path d="M20.4 28.8c-.6-9.6 5-15.6 11.6-15.6 7 0 12.3 5.6 11.6 15-3.8-1-7.6-3.6-9.7-7.4-2.6 4.2-7.6 7-13.5 8z" fill={color} />;
  }
  return <path d="M20.4 29c-1-9.5 4.6-15.8 11.6-15.8s12.6 6.3 11.6 15.8c-1.6-4.4-4.4-6.8-7.8-7.6-2.4 1.8-5.4 2.6-8.6 2.4-2.8 1-5.4 2.8-6.8 5.2z" fill="#4a3b33" />;
}

/**
 * Round character picture used when a person has no photo (GV One look:
 * teal shirt, lime GV badge). Men and women each get one of three haircuts,
 * anyone else a soft neutral cut; skin, hair colour and shirt shade vary by
 * `seed`, so a list of people reads as different people while the same
 * person always looks the same. An account with no employee record (admin)
 * gets the GV mark — น้องวีบอท stays on the AI shortcut only. Purely
 * decorative (aria-hidden): the name is always shown beside it.
 *
 * @param character From characterFor().
 * @param seed The employee id (or name) that picks the variation.
 * @param className Size it with size-* classes; it fills its box.
 */
export function CharacterAvatar({ character, seed = "", className }: { character: AvatarCharacter; seed?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (character === "BOT") {
    return (
      <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(150deg,#ecfeff,#ccfbf1)]", className)}>
        <Logo size={40} className="h-auto w-[76%]" />
      </span>
    );
  }
  const h = hashSeed(seed);
  const [skin, shade] = SKINS[h % SKINS.length];
  const hair = HAIRS[(h >>> 3) % HAIRS.length];
  const shirt = SHIRTS[(h >>> 6) % SHIRTS.length];
  const style = (h >>> 9) % 3;
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
        <BackHair character={character} style={style} color={hair} />
        {/* Shoulders, collar and the lime GV badge. */}
        <path d="M8 66c0-12.5 10.5-20.5 24-20.5S56 53.5 56 66z" fill={shirt} />
        <path d="M26.5 45.8 32 52l5.5-6.2" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="44" cy="54.5" r="2.6" fill={LIME} />
        {/* Neck and face. */}
        <path d="M28 38h8v7.5c-2.4 2-5.6 2-8 0z" fill={shade} />
        <circle cx="32" cy="29" r="11.5" fill={skin} />
        <circle cx="20.8" cy="30" r="2.2" fill={shade} />
        <circle cx="43.2" cy="30" r="2.2" fill={shade} />
        <FrontHair character={character} style={style} color={hair} />
        {character === "FEMALE" && style !== 2 && <circle cx="41.5" cy="19.5" r="2" fill={LIME} />}
        {/* Eyes and smile. */}
        <ellipse cx="27.6" cy="30.2" rx="1.5" ry="1.8" fill="#2b2320" />
        <ellipse cx="36.4" cy="30.2" rx="1.5" ry="1.8" fill="#2b2320" />
        <path d="M28.6 34.6q3.4 3 6.8 0" fill="none" stroke="#9a5a3a" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="25" cy="34" r="1.6" fill="#f9a8a8" fillOpacity=".55" />
        <circle cx="39" cy="34" r="1.6" fill="#f9a8a8" fillOpacity=".55" />
      </g>
    </svg>
  );
}
