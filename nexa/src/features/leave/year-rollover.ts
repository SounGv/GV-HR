/**
 * Pure rules for setting up next year's leave entitlements from this year's
 * (no imports; checked by `node --experimental-strip-types scripts/check-leave-rollover.mjs`).
 *
 * The new year starts from the same entitlement each person had, with nothing used.
 * Annual leave can also carry over what is left, up to a cap HR chooses.
 */

export const PAID_TYPES = ["SICK", "PERSONAL", "ANNUAL"] as const;
export type PaidType = (typeof PAID_TYPES)[number];

export interface PrevBalance {
  type: string;
  totalDays: number;
  usedDays: number;
  totalHours: number;
}

export interface NewBalance {
  type: PaidType;
  totalDays: number;
  totalHours: number;
  /** Days carried over from last year (annual leave only), already included in `totalDays`. */
  carried: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const isPaid = (t: string): t is PaidType => (PAID_TYPES as readonly string[]).includes(t);

/**
 * One person's next-year rows. A type last year had no row for gets none. Carry-over only applies to
 * annual leave: the unused days, never more than `carryAnnualCap` (0 = no carry-over).
 */
export function rolloverBalances(prev: readonly PrevBalance[], carryAnnualCap: number): NewBalance[] {
  const out: NewBalance[] = [];
  for (const p of prev) {
    if (!isPaid(p.type)) continue;
    const left = Math.max(0, p.totalDays - p.usedDays);
    const carried = p.type === "ANNUAL" && carryAnnualCap > 0 ? r1(Math.min(carryAnnualCap, left)) : 0;
    out.push({ type: p.type, totalDays: r1(p.totalDays + carried), totalHours: p.totalHours, carried });
  }
  return out;
}

/** Years must be sensible: the new year comes after the old one, and not more than 5 years later. */
export function yearsProblem(fromYear: number, toYear: number): string | null {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) return "ปีไม่ถูกต้อง";
  if (toYear <= fromYear) return "ปีใหม่ต้องมากกว่าปีเดิม";
  if (toYear - fromYear > 5) return "ปีใหม่ห่างจากปีเดิมเกินไป";
  return null;
}
