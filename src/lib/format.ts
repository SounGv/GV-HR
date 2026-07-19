export const thMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export const thMonthsLong = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export const thDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const thDaysShort = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function hhmm(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export function fmtBaht(n: number): string {
  return "฿" + Number(n).toLocaleString("en-US");
}

export function thDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.split("-");
  if (p.length < 3) return iso;
  return parseInt(p[2], 10) + " " + thMonths[parseInt(p[1], 10) - 1];
}

export function computeOtHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [a, b] = start.split(":").map(Number);
  const [c, d] = end.split(":").map(Number);
  let mins = c * 60 + d - (a * 60 + b);
  if (mins < 0) mins += 1440;
  return Math.round((mins / 60) * 10) / 10;
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 60) return mins + " นาที";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " ชม.";
  const days = Math.floor(hours / 24);
  return days + " วัน";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0] || " ")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
