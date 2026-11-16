"use client";

import { useEffect, useState } from "react";
import { VBot } from "@/components/shared/v-bot";

const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => i);
const NUMERALS = [
  { n: "12", x: 210, y: 92 },
  { n: "3", x: 328, y: 218 },
  { n: "6", x: 210, y: 348 },
  { n: "9", x: 92, y: 218 },
];

const fmtTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23", timeZone: "Asia/Bangkok" });
const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Asia/Bangkok" });

type Clock = { hour: number; minute: number; second: number; day: string };

/** Hands at the classic 10:08:35 until the browser has its own time, so the server and the browser draw the same first frame. */
const FIRST_FRAME: Clock = { hour: 10, minute: 8, second: 35, day: "" };

function readBangkok(): Clock {
  const now = new Date();
  const p = Object.fromEntries(fmtTime.formatToParts(now).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second), day: fmtDay.format(now) };
}

/**
 * The website sign-in hero's centrepiece: a metal watch (chrome case, crown and pushers, black ring, brushed green dial with lit markers,
 * glass reflection) that runs on Bangkok time, with น้องวีบอท waving in front. The small dial carries the GV check mark. Everything is
 * SVG and CSS; only the hands (one transform each) and the greeting animate, and the second hand only ticks once a second.
 *
 * The second hand keeps a rising angle instead of resetting at 60, so it never spins backwards across the dial.
 */
export function LoginWatch({ className }: { className?: string }) {
  const [clock, setClock] = useState<Clock>(FIRST_FRAME);
  const [secondAngle, setSecondAngle] = useState(FIRST_FRAME.second * 6);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let previous = -1;
    let first = true;
    const tick = () => {
      const c = readBangkok();
      let angle = c.second * 6;
      while (angle < previous) angle += 360;
      previous = angle;
      setClock(c);
      setSecondAngle(angle);
      // The first jump from the placeholder time to the real one must not sweep; the ticking transition starts with the next second.
      if (first) first = false;
      else setLive(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <div className="lw-stage" data-live={live}>
        <span className="lw-push lw-push-a" />
        <span className="lw-push lw-push-b" />
        <span className="lw-crown" />
        <div className="lw-case">
          <div className="lw-ring" />
          <div className="lw-face">
            <svg viewBox="0 0 420 420" className="lw-dial">
              <defs>
                <linearGradient id="lw-hand" x1="0" x2="1">
                  <stop offset="0" stopColor="#cfd9d9" />
                  <stop offset=".5" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#9fb0b0" />
                </linearGradient>
                <filter id="lw-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="2" dy="5" stdDeviation="3.5" floodColor="#000" floodOpacity=".6" />
                </filter>
                <radialGradient id="lw-hub" cx=".4" cy=".35">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset=".6" stopColor="#9fb0b0" />
                  <stop offset="1" stopColor="#4b5b5b" />
                </radialGradient>
              </defs>

              {MINUTE_TICKS.map((i) => {
                const major = i % 5 === 0;
                return (
                  <g key={i} transform={`rotate(${i * 6} 210 210)`}>
                    {major && <line x1="210" y1="20" x2="210" y2="46" stroke="rgba(205,235,3,.35)" strokeWidth="10" strokeLinecap="round" />}
                    <line
                      x1="210"
                      y1={major ? 20 : 24}
                      x2="210"
                      y2={major ? 46 : 34}
                      stroke={major ? "#CDEB03" : "rgba(255,255,255,.5)"}
                      strokeWidth={major ? 5 : 1.6}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
              {NUMERALS.map((m) => (
                <text key={m.n} x={m.x} y={m.y} textAnchor="middle" fontSize="34" fontWeight="700" fill="#f2f8f7">
                  {m.n}
                </text>
              ))}

              <text x="210" y="112" textAnchor="middle" fill="#e7f3f1" fontSize="17" fontWeight="700" letterSpacing="5">
                GV ONE
              </text>
              <text x="210" y="130" textAnchor="middle" fill="#7fd9cc" fontSize="8.5" letterSpacing="3">
                CHECK-IN CLOCK
              </text>

              {/* Date window */}
              <rect x="290" y="198" width="46" height="26" rx="4" fill="#f4f7f7" stroke="#0b1414" strokeWidth="2" />
              <text x="313" y="217" textAnchor="middle" fill="#0b1414" fontSize="17" fontWeight="700">
                {clock.day}
              </text>

              {/* Small dial: today's progress with the GV check mark */}
              <g transform="translate(210 290)">
                <circle r="38" fill="#06100f" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
                <circle r="30" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5" />
                <circle r="30" fill="none" stroke="#2dd4bf" strokeWidth="5" strokeLinecap="round" strokeDasharray="136 189" transform="rotate(-90)" />
                <path d="M-14 1 L-5 11 L15 -11" fill="none" stroke="#CDEB03" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </g>

              <g className="lw-hand" filter="url(#lw-shadow)" style={{ transform: `rotate(${(clock.hour % 12) * 30 + clock.minute * 0.5}deg)` }}>
                <path d="M203 232 L207 120 L210 108 L213 120 L217 232 Z" fill="url(#lw-hand)" stroke="#0b1414" strokeWidth="1.6" />
                <path d="M209 214 L209 130 L211 130 L211 214Z" fill="#CDEB03" />
              </g>
              <g className="lw-hand" filter="url(#lw-shadow)" style={{ transform: `rotate(${clock.minute * 6 + clock.second * 0.1}deg)` }}>
                <path d="M205 236 L208 62 L210 48 L212 62 L215 236 Z" fill="url(#lw-hand)" stroke="#0b1414" strokeWidth="1.6" />
                <path d="M209.2 220 L209.2 70 L210.8 70 L210.8 220Z" fill="#CDEB03" />
              </g>
              <g className="lw-hand lw-second" filter="url(#lw-shadow)" style={{ transform: `rotate(${secondAngle}deg)` }}>
                <rect x="208.6" y="34" width="2.8" height="196" rx="1.4" fill="#2dd4bf" />
                <rect x="206.5" y="226" width="7" height="34" rx="3" fill="#2dd4bf" />
                <circle cx="210" cy="86" r="8" fill="#0b1414" stroke="#2dd4bf" strokeWidth="3" />
              </g>
              <circle cx="210" cy="210" r="11" fill="url(#lw-hub)" stroke="#0b1414" strokeWidth="2" />
              <circle cx="210" cy="210" r="4" fill="#0b1414" />
            </svg>
          </div>
          <div className="lw-glass" />
        </div>
        <VBot mood="hi" full className="lw-bot" />
      </div>
    </div>
  );
}
