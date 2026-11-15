import { createElement, type ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * GV One's own icons for the dashboard groups (owner picked style A, 15 Nov 2026): 24x24, a 2px outline with round
 * ends, and a soft fill of the same colour as a second layer. Everything is drawn with `currentColor`, so one colour
 * class sets both layers; the tile that holds them (GvIconTile) is teal, never a colour per group. One icon per
 * idea, reused wherever the same thing is named (cards, rows, the news ticker, the numbers strip). No text inside.
 */

type Kind = "l" | "d" | "dl" | "dot";
type El = "path" | "rect" | "circle";
type Part = [Kind, El, Record<string, string | number>];

const p = (kind: Kind, d: string): Part => [kind, "path", { d }];
const rect = (kind: Kind, x: number, y: number, width: number, height: number, rx: number): Part => [kind, "rect", { x, y, width, height, rx }];
const circle = (kind: Kind, cx: number, cy: number, r: number): Part => [kind, "circle", { cx, cy, r }];

export type GvIconName =
  | "approvals"
  | "leave"
  | "ot"
  | "correction"
  | "expense"
  | "workflow"
  | "scan"
  | "late"
  | "absent"
  | "probation"
  | "meeting"
  | "evaluation"
  | "yearsetup"
  | "holiday"
  | "announce"
  | "draft"
  | "calc"
  | "checkin";

const ICONS: Record<GvIconName, Part[]> = {
  approvals: [rect("dl", 5, 4.5, 14, 16.5, 3), rect("dl", 9, 2.5, 6, 4, 1.6), p("l", "M9 14l2.2 2.2L15.2 12")],
  leave: [rect("dl", 3.5, 5, 17, 15.5, 3), p("l", "M8 3v4M16 3v4M3.5 10h17"), circle("d", 12, 15.3, 2.8), circle("l", 12, 15.3, 1.2)],
  ot: [circle("dl", 11, 13, 8), p("l", "M11 8.6V13l3 1.8"), p("dl", "M18.6 2.8a3.2 3.2 0 1 0 2.7 4.8 3.7 3.7 0 0 1-2.7-4.8z")],
  correction: [p("dl", "M4 20l1-4.2L16.6 4.2a2.2 2.2 0 0 1 3.1 3.1L8.1 18.9 4 20z"), p("l", "M14 6.8l3.2 3.2")],
  expense: [p("dl", "M6 3.5h12V21l-3-2-3 2-3-2-3 2z"), p("l", "M9.5 8h5M9.5 12h5")],
  workflow: [circle("dl", 6, 6, 2.3), circle("dl", 6, 18, 2.3), circle("dl", 18, 12, 2.3), p("l", "M6 8.3v7.4M8.3 6c5.4 0 7.4 2 7.4 4")],
  scan: [
    p("l", "M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"),
    circle("d", 12, 12, 5),
    p("l", "M12 9.2v3.4"),
    p("dot", "M12 15.1h.01"),
  ],
  late: [circle("dl", 12, 13.2, 7.4), p("l", "M12 9.5v3.8l2.5 1.5M5 4.6L2.8 6.8M19 4.6l2.2 2.2")],
  absent: [circle("dl", 9.5, 8, 3.7), p("l", "M3 20c0-3.6 3-5.8 6.5-5.8M16.5 9.5l5 5M21.5 9.5l-5 5")],
  probation: [p("dl", "M12 20v-7M12 13c0-3.5-2.6-5.6-6.5-5.6 0 3.8 2.6 5.6 6.5 5.6zM12 11c0-3 2.2-5 6-5 0 3.4-2.2 5-6 5z"), p("l", "M7.5 20h9")],
  meeting: [circle("dl", 9.5, 8, 3.5), p("l", "M16 20v-1.6a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.4a3.5 3.5 0 0 1 0 6.5")],
  evaluation: [rect("l", 5, 4.5, 14, 16.5, 3), p("dl", "M12 9.2l1.4 2.9 3.2.4-2.3 2.2.6 3.1L12 16.3l-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z")],
  yearsetup: [rect("dl", 3.5, 5, 17, 15.5, 3), p("l", "M8 3v4M16 3v4M3.5 10h17M9 15l2.2 2.2L15.4 13")],
  holiday: [p("dl", "M5 5h12l-2 4 2 4H5z"), p("l", "M5 21V4")],
  announce: [p("dl", "M3 10v4a1 1 0 0 0 1 1h2.5L15 19.5v-15L6.5 9H4a1 1 0 0 0-1 1z"), p("l", "M18.5 9.5a4 4 0 0 1 0 5")],
  draft: [p("dl", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"), p("l", "M14 3v5h5M9 13h6M9 17h4")],
  calc: [rect("dl", 5, 3, 14, 18, 3), rect("l", 8, 6, 8, 3, 1), p("dot", "M9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01")],
  checkin: [circle("dl", 12, 12, 9), p("l", "M8.2 12.4l2.7 2.7 5-5.4")],
};

const STROKE = { strokeLinecap: "round", strokeLinejoin: "round" } as const;
const LAYER: Record<Kind, Record<string, string | number>> = {
  l: { fill: "none", stroke: "currentColor", strokeWidth: 2, ...STROKE },
  d: { fill: "currentColor", fillOpacity: 0.2, stroke: "none" },
  dl: { fill: "currentColor", fillOpacity: 0.2, stroke: "currentColor", strokeWidth: 2, ...STROKE },
  dot: { fill: "none", stroke: "currentColor", strokeWidth: 2.6, ...STROKE },
};

export interface GvIconProps {
  className?: string;
  "aria-hidden"?: boolean | "true";
  /** Only for places that thicken icons (the news ticker); the default 2 matches every other icon. */
  strokeWidth?: number;
}

/** One of the dashboard icons, sized with `size-*` classes. Purely decorative: the label is always written beside it. */
export function GvIcon({ name, className, strokeWidth }: GvIconProps & { name: GvIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("shrink-0 overflow-visible", className)}>
      {ICONS[name].map(([kind, el, attrs], i) => {
        const layer = strokeWidth && (kind === "l" || kind === "dl") ? { ...LAYER[kind], strokeWidth } : LAYER[kind];
        return createElement(el, { key: i, ...layer, ...attrs });
      })}
    </svg>
  );
}

/** A component for one icon, for props that take an icon component (`icon={GvScanIcon}`). */
function make(name: GvIconName): ComponentType<GvIconProps> {
  const Icon = (props: GvIconProps) => <GvIcon name={name} className={props.className} strokeWidth={props.strokeWidth} />;
  Icon.displayName = `Gv${name[0].toUpperCase()}${name.slice(1)}Icon`;
  return Icon;
}

export const GvApprovalsIcon = make("approvals");
export const GvLeaveIcon = make("leave");
export const GvOtIcon = make("ot");
export const GvCorrectionIcon = make("correction");
export const GvExpenseIcon = make("expense");
export const GvWorkflowIcon = make("workflow");
export const GvScanIcon = make("scan");
export const GvLateIcon = make("late");
export const GvAbsentIcon = make("absent");
export const GvProbationIcon = make("probation");
export const GvMeetingIcon = make("meeting");
export const GvEvaluationIcon = make("evaluation");
export const GvYearSetupIcon = make("yearsetup");
export const GvHolidayIcon = make("holiday");
export const GvAnnounceIcon = make("announce");
export const GvDraftIcon = make("draft");
export const GvCalcIcon = make("calc");
export const GvCheckinIcon = make("checkin");

export type GvStatus = "bad" | "warn" | "info" | "ok";

const BADGE: Record<GvStatus, { bg: string; glyph: string }> = {
  bad: { bg: "bg-destructive text-white", glyph: "M12 6v7M12 18h.01" },
  warn: { bg: "bg-warning text-warning-foreground", glyph: "M12 7v5l3 2" },
  info: { bg: "bg-info text-info-foreground", glyph: "M12 11v6M12 7h.01" },
  ok: { bg: "bg-success text-success-foreground", glyph: "M5 12.5l4.5 4.5L19 7" },
};

/**
 * The teal tile an icon sits on. It is the same teal for every group; urgency is told by the small badge on the
 * corner (a glyph on a status colour) together with the status word written beside the card, never by recolouring
 * the tile.
 *
 * @param icon The icon component to draw.
 * @param status Draws the corner badge: bad = needs doing now, warn = coming due, info = for information, ok = fine.
 * @param className Size and spacing; defaults to 44px.
 * @param iconClassName Icon size inside a tile that is not 44px; defaults to 26px.
 */
export function GvIconTile({ icon: Icon, status, className, iconClassName }: { icon: ComponentType<GvIconProps>; status?: GvStatus; className?: string; iconClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary ring-1 ring-primary/15 ring-inset", className)}
    >
      <Icon className={iconClassName ?? "size-[26px]"} />
      {status && (
        <span className={cn("absolute -top-1.5 -right-1.5 flex size-[19px] items-center justify-center rounded-full ring-2 ring-card", BADGE[status].bg)}>
          <svg viewBox="0 0 24 24" className="size-[11px]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            {status === "warn" && <circle cx="12" cy="12" r="8" />}
            <path d={BADGE[status].glyph} />
          </svg>
        </span>
      )}
    </span>
  );
}
