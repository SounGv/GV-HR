import { useId, type ComponentType, type SVGProps } from "react";

import { realIconMarkup, type RealIconTone } from "./real-icon-art";

/** The tone owner approved with the mock (natural colours). Switch to "teal" here to turn every real icon into green glass. */
export const REAL_ICON_TONE: RealIconTone = "natural";

type Props = SVGProps<SVGSVGElement> & { size?: number };

export function RealIcon({ name, size = 32, className, ...rest }: Props & { name: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible", filter: "drop-shadow(0 2px 2px rgba(10,60,56,.18))" }}
      dangerouslySetInnerHTML={{ __html: realIconMarkup(name, REAL_ICON_TONE, uid) }}
      {...rest}
    />
  );
}

function make(name: string, label: string): ComponentType<Props> {
  const Icon = (props: Props) => <RealIcon name={name} {...props} />;
  Icon.displayName = label;
  return Icon;
}

// One icon per meaning; none repeats between the bottom tabs and the menus (see the approved mock's mapping table).
export const RHome = make("house", "RHome");
export const RUsers = make("users", "RUsers");
export const RUsersRound = make("users-round", "RUsersRound");
export const RUser = make("user", "RUser");
export const RUserPlus = make("user-plus", "RUserPlus");
export const RApprove = make("approve", "RApprove");
export const RStar = make("star", "RStar");
export const RPalm = make("palm", "RPalm");
export const RTimer = make("timer", "RTimer");
export const RClock = make("clock", "RClock");
export const RCalendarClock = make("calendar-clock", "RCalendarClock");
export const RCalendarDays = make("calendar-days", "RCalendarDays");
export const RCalendarRange = make("calendar-range", "RCalendarRange");
export const RScan = make("scan", "RScan");
export const RHandHeart = make("hand-heart", "RHandHeart");
export const RGrid = make("grid", "RGrid");
export const RBell = make("bell", "RBell");
export const RChart = make("chart-column", "RChart");
export const RShield = make("shield", "RShield");
export const RPencil = make("pencil", "RPencil");
export const RGlobe = make("globe", "RGlobe");
export const RLogOut = make("log-out", "RLogOut");
export const RReceipt = make("receipt", "RReceipt");
export const RTarget = make("target", "RTarget");
export const RClipboardList = make("clipboard-list", "RClipboardList");
export const RClipboardPen = make("clipboard-pen", "RClipboardPen");
export const RListChecks = make("list-checks", "RListChecks");
export const RFileCheck = make("file-check", "RFileCheck");
export const RSprout = make("sprout", "RSprout");
export const RVideo = make("video", "RVideo");
export const RNetwork = make("network", "RNetwork");
export const RBuilding = make("building", "RBuilding");
export const RGauge = make("gauge", "RGauge");
export const RDownload = make("download", "RDownload");
export const RSettings = make("settings", "RSettings");
export const RMapPin = make("map-pin", "RMapPin");
