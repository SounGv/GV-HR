/** Shared formatting helpers (Thai locale defaults). */

export function getInitials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  if (!a && !b) return "?";
  return (a.charAt(0) + b.charAt(0)).toUpperCase() || a.charAt(0).toUpperCase();
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

/**
 * A person's name as shown on screens: "first last (nickname)".
 *
 * The nickname key is required (it may be null) so a query that forgets to select
 * it fails the type check instead of silently dropping the nickname. Official
 * documents (payslips, filings) keep using {@link fullName}.
 *
 * @param person Anything with first name, last name and nickname.
 * @returns The full name, followed by the nickname in parentheses when there is one.
 */
export function displayName(person: {
  firstName?: string | null;
  lastName?: string | null;
  nickname: string | null | undefined;
}): string {
  const name = fullName(person.firstName, person.lastName);
  const nickname = person.nickname?.trim();
  return nickname ? `${name} (${nickname})` : name;
}

/** Login identifier for display when there's no employee name to show —
 * accounts can have an email, a username, or (rarely, transiently) neither. */
export function loginIdentifier(user: { email?: string | null; username?: string | null }): string {
  return user.email ?? user.username ?? "ผู้ใช้งาน";
}

export function formatCurrency(value: number | null | undefined, currency = "THB"): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("th-TH").format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** "2 นาทีที่แล้ว" style relative timestamp for notification/activity feeds. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "เมื่อสักครู่";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return formatDate(d);
}
