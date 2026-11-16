import { VBot } from "@/components/shared/v-bot";

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/**
 * The login hero's centrepiece: GV One's own idea (a clock that checks you in)
 * drawn large. A dial with minute ticks, a teal arc and the GV check mark as
 * the clock's hands draw themselves once on load, a small dot keeps orbiting
 * like a second hand, and น้องวีบอท waves in front. Pure SVG; only
 * stroke-dashoffset and transform animate, so it costs next to nothing.
 */
export function LoginDial({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative aspect-square w-full">
        <svg viewBox="0 0 420 420" className="absolute inset-0 size-full">
          <defs>
            <radialGradient id="login-dial-face" cx="0.42" cy="0.36" r="0.75">
              <stop offset="0" stopColor="#115e59" />
              <stop offset="0.65" stopColor="#0c2a29" />
              <stop offset="1" stopColor="#0b1414" />
            </radialGradient>
          </defs>
          <circle cx="210" cy="210" r="196" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
          <circle cx="210" cy="210" r="162" fill="url(#login-dial-face)" />
          <circle cx="210" cy="210" r="162" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
          {TICKS.map((i) => {
            const major = i % 5 === 0;
            return (
              <line
                key={i}
                x1="210"
                y1={major ? 26 : 30}
                x2="210"
                y2={major ? 44 : 38}
                stroke={major ? "rgba(205,235,3,0.75)" : "rgba(255,255,255,0.22)"}
                strokeWidth={major ? 3 : 1.5}
                strokeLinecap="round"
                transform={`rotate(${i * 6} 210 210)`}
              />
            );
          })}
          {/* Teal arc: today's progress round the dial. */}
          <circle
            className="login-dial-arc"
            cx="210"
            cy="210"
            r="176"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="72 100"
            transform="rotate(-90 210 210)"
          />
          {/* The GV check mark as the clock's hands. */}
          <path
            className="login-dial-check"
            d="M146 214 L192 258 L292 150"
            fill="none"
            stroke="#0f766e"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
          />
          <path
            className="login-dial-check"
            d="M146 214 L192 258 L292 150"
            fill="none"
            stroke="#CDEB03"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
          />
          <circle cx="192" cy="258" r="9" fill="#0b1414" stroke="#CDEB03" strokeWidth="3" />
          {/* Second hand: one dot that keeps orbiting. */}
          <g className="login-dial-orbit">
            <circle cx="210" cy="34" r="7" fill="#CDEB03" stroke="#0b1414" strokeWidth="3" />
          </g>
        </svg>
        <VBot mood="hi" full className="absolute right-[-4%] bottom-[-6%] h-[48%] w-[42%] drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]" />
      </div>
    </div>
  );
}
