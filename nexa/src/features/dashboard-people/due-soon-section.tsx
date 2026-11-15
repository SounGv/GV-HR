import Link from "next/link";
import { Clock } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { GvHolidayIcon, GvIconTile, GvYearSetupIcon } from "@/components/shared/gv-icons";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import { bangkokParts } from "@/lib/datetime";
import type { AccessClaims } from "@/lib/auth/jwt";
import { DUE_SOON_FROM_MONTH, dueSoonItems, type DueSoonItem } from "./due-soon-rules";

const BTN = "inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-accent";

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
    <section id="due-soon" aria-label="ใกล้ครบกำหนด" className="scroll-mt-24 space-y-3">
      <SectionHeading title="ใกล้ครบกำหนด" hint="ต้องเตรียมให้เสร็จก่อนขึ้นปีใหม่" />
      <article className="rounded-2xl border border-border bg-card p-4 shadow-[var(--card-shadow)] sm:p-5">
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
                <GvIconTile icon={it.key === "holidays" ? GvHolidayIcon : GvYearSetupIcon} status="warn" />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-semibold break-words">{it.title}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{it.sub}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-status-late-border bg-status-late-bg px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-status-late-fg">
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
      </article>
    </section>
  );
}
