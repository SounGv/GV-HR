import Link from "next/link";
import { Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import { bangkokParts } from "@/lib/datetime";
import type { AccessClaims } from "@/lib/auth/jwt";
import { DUE_SOON_FROM_MONTH, dueSoonItems, type DueSoonItem } from "./due-soon-rules";

/** Primary solid, 44px tall (the mock drew 40px; touch targets stay at 44px). */
const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-[14px] leading-[1.5] font-semibold text-primary-foreground transition-colors hover:brightness-110";

/** Distinct people who have a leave entitlement row for the year. */
async function peopleWithEntitlements(companyId: string, year: number): Promise<number> {
  const rows = await prisma.leaveBalance.groupBy({ by: ["employeeId"], where: { companyId, year } });
  return rows.length;
}

/**
 * HR's "ใกล้ครบกำหนด" list: what has to be ready before the new year. Shown only from October and only while
 * something is missing, so on a normal day it takes no room (it renders nothing).
 */
export async function DueSoonSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  const now = bangkokParts();
  if (now.month < DUE_SOON_FROM_MONTH) return null;
  const canSetHolidays = can(session.perms, "holiday:create");
  const canSetLeaveYear = can(session.perms, "employee:update");
  if (!canSetHolidays && !canSetLeaveYear) return null;

  let items;
  try {
    // Sequential reads: the connection pool has one slot.
    const holidaysNextYear = canSetHolidays
      ? await prisma.holiday.count({ where: { companyId, deletedAt: null, date: { gte: new Date(Date.UTC(now.year + 1, 0, 1)), lt: new Date(Date.UTC(now.year + 2, 0, 1)) } } })
      : 0;
    const balancePeopleThisYear = canSetLeaveYear ? await peopleWithEntitlements(companyId, now.year) : 0;
    const balancePeopleNextYear = canSetLeaveYear ? await peopleWithEntitlements(companyId, now.year + 1) : 0;
    items = dueSoonItems({ year: now.year, month: now.month, day: now.day, holidaysNextYear, balancePeopleThisYear, balancePeopleNextYear, canSetHolidays, canSetLeaveYear });
  } catch (e) {
    // A failed read must not break the home page: this list is a reminder, not the work itself.
    console.error("[dashboard] due-soon read failed:", e instanceof Error ? e.message : e);
    return null;
  }
  if (items.length === 0) return null;

  return <DueSoonList items={items} />;
}

/** The card itself, kept apart from the database reads so it can be looked at on its own. */
export function DueSoonList({ items }: { items: DueSoonItem[] }) {
  return (
    <section id="due-soon" aria-label="ใกล้ครบกำหนด" className="scroll-mt-24">
      <h2 className="text-[18px] leading-[1.4] font-bold text-foreground">ใกล้ครบกำหนด</h2>
      <p className="mt-1 mb-3 text-[14px] leading-[1.6] text-muted-foreground">ต้องเตรียมให้เสร็จก่อนขึ้นปีใหม่</p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
            <span className="min-w-0 flex-[1_1_16rem]">
              <span className="block text-[15px] leading-[1.5] font-bold break-words text-foreground">{it.title}</span>
              <span className="block text-[13px] leading-[1.5] text-muted-foreground">{it.sub}</span>
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ffb900] px-2.5 py-0.5 text-[13px] leading-[1.5] font-bold whitespace-nowrap text-[#3a2a00]">
                <Clock className="size-3.5" aria-hidden="true" />
                เหลือ {it.daysLeft} วัน
              </span>
              <Link href={it.href} className={BTN}>
                {it.action}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
