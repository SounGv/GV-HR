import { useId } from "react";
import { cn } from "@/lib/utils";

/** น้องวีบอท's moods, one per chat state. */
export type VBotMood = "hi" | "think" | "ok" | "sorry";

const LIME = "#CDEB03";
const MINT = "#5eead4";
const INK = "#0b1414";
const TEAL_DARK = "#0f766e";

function sparkPath(x: number, y: number, r: number): string {
  const k = r * 0.32;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
}

/** Eyes and mouth on the dark face screen; the eyes sit in their own group so they can blink. */
function Face({ mood }: { mood: VBotMood }) {
  const lx = 47;
  const rx = 73;
  const ey = 60;
  const cx = 60;
  const cy = 64;
  if (mood === "hi") {
    return (
      <>
        <g className="vbot-eyes">
          <path
            d={`M${lx - 6} ${ey + 2}q6 -8 12 0M${rx - 6} ${ey + 2}q6 -8 12 0`}
            stroke={MINT}
            strokeWidth="3.6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <path d={`M${cx - 8} ${cy + 6}q8 10 16 0z`} fill={LIME} />
      </>
    );
  }
  if (mood === "think") {
    return (
      <>
        <g className="vbot-eyes">
          <ellipse cx={lx + 2} cy={ey - 2} rx="4" ry="5.2" fill={MINT} />
          <ellipse cx={rx + 2} cy={ey - 2} rx="4" ry="5.2" fill={MINT} />
        </g>
        <path d={`M${cx - 3} ${cy + 10}h9`} stroke={LIME} strokeWidth="3.4" strokeLinecap="round" />
      </>
    );
  }
  if (mood === "sorry") {
    return (
      <>
        <g className="vbot-eyes">
          <ellipse cx={lx} cy={ey + 1} rx="4.2" ry="5" fill={MINT} />
          <ellipse cx={rx} cy={ey + 1} rx="4.2" ry="5" fill={MINT} />
        </g>
        <path
          d={`M${lx - 6} ${ey - 6}l10 -3M${rx + 6} ${ey - 6}l-10 -3`}
          stroke={MINT}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={`M${cx - 8} ${cy + 11}q4 -4 8 0q4 4 8 0`}
          stroke={LIME}
          strokeWidth="3.2"
          fill="none"
          strokeLinecap="round"
        />
      </>
    );
  }
  return (
    <>
      <g className="vbot-eyes">
        <ellipse cx={lx} cy={ey} rx="4.5" ry="6" fill={MINT} />
        <ellipse cx={rx} cy={ey} rx="4.5" ry="6" fill={MINT} />
      </g>
      {/* The GV check mark doubles as the smile. */}
      <path
        d={`M${cx - 7} ${cy + 7}l5 5l11 -10`}
        stroke={LIME}
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/**
 * น้องวีบอท, GV One's AI assistant character: a round-headed teal robot with a
 * dark face screen, mint eyes and the GV check mark as its smile.
 *
 * @param mood Which face to show; match it to the chat state (hi = welcome,
 *   think = waiting for an answer, ok = answered, sorry = an error).
 * @param full Draw the whole body (waving) instead of just the head.
 * @param className Size it with width/height classes.
 */
export function VBot({ mood = "ok", full = false, className }: { mood?: VBotMood; full?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const fill = `url(#vbot-${id})`;
  return (
    <svg
      viewBox={full ? "6 0 108 128" : "10 2 100 96"}
      className={cn("vbot shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`vbot-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset=".55" stopColor="#0d9488" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      {full && (
        <>
          <rect x="36" y="92" width="48" height="34" rx="15" fill={fill} />
          <circle cx="60" cy="108" r="8.5" fill={INK} />
          <path
            d="M55.5 108l3 3l6.5 -6"
            stroke={LIME}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {mood === "hi" ? (
            <>
              <path d="M37 100L22 82" stroke={TEAL_DARK} strokeWidth="8" strokeLinecap="round" />
              <circle cx="20" cy="79" r="6" fill="#2dd4bf" />
            </>
          ) : (
            <path d="M37 100L27 116" stroke={TEAL_DARK} strokeWidth="8" strokeLinecap="round" />
          )}
          <path d="M83 100L93 116" stroke={TEAL_DARK} strokeWidth="8" strokeLinecap="round" />
        </>
      )}
      <path d="M60 30V17" stroke={TEAL_DARK} strokeWidth="4" strokeLinecap="round" />
      <path d={sparkPath(60, 11, 7)} fill={LIME} stroke={TEAL_DARK} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="14" y="50" width="11" height="24" rx="5.5" fill={TEAL_DARK} />
      <rect x="95" y="50" width="11" height="24" rx="5.5" fill={TEAL_DARK} />
      <rect x="20" y="28" width="80" height="66" rx="25" fill={fill} />
      <path d="M33 39q10 -6 26 -6" stroke="#fff" strokeOpacity=".4" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="29" y="43" width="62" height="42" rx="17" fill={INK} />
      <Face mood={mood} />
      {mood === "think" && (
        <g fill="#94a3b8">
          <circle cx="98" cy="26" r="2.6" />
          <circle cx="105" cy="21" r="3.4" />
          <circle cx="114" cy="14" r="4.4" />
        </g>
      )}
    </svg>
  );
}
