import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { DailyWorkerIcon, PeopleIcon } from "@/components/shared/illustrated-icons";
import { cn } from "@/lib/utils";

export interface EmploymentTypeRow {
  type: string;
  label: string;
  count: number;
  pct: number;
}

/** Daily workers get their own artwork; every other type shares the "people" mark. */
function employmentTypeIcon(type: string) {
  return type === "DAILY_WORKER" ? DailyWorkerIcon : PeopleIcon;
}

/** A row that opens a list: highlighted on hover with a small arrow, a keyboard focus ring; plain when there is nowhere it may go. */
function RowLink({ href, label, className, children }: { href?: string; label: string; className?: string; children: React.ReactNode }) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(className, "gv-row group relative -mx-2 rounded-lg px-2 pr-6 focus-visible:outline-2 focus-visible:outline-primary")}
    >
      {children}
      <ArrowRight className="text-primary absolute top-1/2 right-0.5 size-3.5 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
    </Link>
  );
}

/**
 * Dashboard "ทีมงาน" section: employment types as one split bar with a
 * row per type, and departments as a ranked two-column list with thin bars
 * (the three biggest in teal). Replaces the old full-width grey rows and
 * the three stat tiles. Server-safe (no hooks).
 */
export function TeamOverview({
  headcount,
  employmentTypes,
  departments,
  canOpenEmployees = false,
}: {
  headcount: number;
  employmentTypes: EmploymentTypeRow[];
  departments: { id?: string | null; name: string; count: number }[];
  /** The viewer may open the employee list and the org pages (employee:read); without it the rows stay plain text. */
  canOpenEmployees?: boolean;
}) {
  return (
    <section aria-label="ทีมงาน" className="space-y-3">
      <SectionHeading
        title="ทีมงาน"
        hint="ประเภทการจ้างและจำนวนคนในแต่ละแผนก"
        action={
          <Link
            href="/organization?tab=chart"
            className="text-primary inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold hover:underline"
          >
            ดูผังองค์กร <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <div className="grid items-stretch gap-[22px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
        <Card className="gv-panel gv-panel-lift gap-0 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold">ประเภทการจ้าง</h3>
            <span className="text-muted-foreground text-[12.5px] tabular-nums">
              ทั้งหมด {headcount} คน
            </span>
          </div>
          {/* One bar split by type; every piece also has a row below with its word and number. */}
          <div
            className="mt-4 flex h-2.5 gap-1"
            role="img"
            aria-label={employmentTypes.map((t) => `${t.label} ${t.count} คน`).join(" · ")}
          >
            {employmentTypes.map((t) => (
              <span
                key={t.type}
                className="gv-grow h-full rounded-full"
                style={{
                  flexGrow: t.count,
                  background: t.type === "DAILY_WORKER" ? "#f59e0b" : "#0d9488",
                }}
              />
            ))}
          </div>
          <ul className="dark:divide-border mt-3 divide-y divide-[#eef1f3]">
            {employmentTypes.map((t) => {
              const Icon = employmentTypeIcon(t.type);
              return (
                <li key={t.type}>
                  <RowLink href={canOpenEmployees ? `/employees?status=ACTIVE&employmentType=${encodeURIComponent(t.type)}` : undefined} label={`${t.label} ${t.count} คน ดูรายชื่อ`} className="flex items-center gap-3 py-3">
                  <Icon size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: t.type === "DAILY_WORKER" ? "#f59e0b" : "#0d9488" }}
                      />
                      {t.label}
                    </span>
                  </span>
                  <span className="text-[22px] leading-none font-bold tabular-nums">{t.count}</span>
                  <span className="bg-muted text-muted-foreground w-11 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums">
                    {t.pct}%
                  </span>
                  </RowLink>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="gv-panel gv-panel-lift gap-0 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold">พนักงานแต่ละแผนก</h3>
            <span className="text-muted-foreground text-[12.5px] tabular-nums">
              {headcount} คน · {departments.length} แผนก · เฉลี่ย{" "}
              {departments.length > 0 ? (headcount / departments.length).toFixed(1) : "0"} คน/แผนก
            </span>
          </div>
          {/* Ranked, two columns on wide screens; the three biggest carry the teal bar. */}
          <ol className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {departments.map((d, i) => {
              const max = Math.max(...departments.map((r) => r.count), 1);
              const top = i < 3;
              const share = headcount > 0 ? Math.round((d.count / headcount) * 100) : 0;
              // A real department opens the employee list filtered to it; the folded "อื่นๆ" row opens the department page.
              const target = !canOpenEmployees ? undefined : d.id ? `/employees?status=ACTIVE&departmentId=${d.id}` : d.name === "อื่นๆ" ? "/organization?tab=departments" : undefined;
              return (
                <li
                  key={d.id ?? d.name}
                  className="dark:border-border border-b border-[#eef1f3] last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
                >
                  <RowLink href={target} label={`${d.name} ${d.count} คน ดูรายชื่อ`} className="block py-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className={cn(
                        "w-5 shrink-0 text-center text-xs font-bold tabular-nums",
                        top ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {d.name === "อื่นๆ" ? "–" : i + 1}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13.5px]",
                        top ? "font-semibold" : "font-medium",
                      )}
                    >
                      {d.name}
                    </span>
                    <span className="text-[15px] font-bold tabular-nums">{d.count}</span>
                    <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                      {share}%
                    </span>
                  </div>
                  <div className="dark:bg-muted mt-1.5 ml-[30px] h-1.5 overflow-hidden rounded-full bg-[#eef1f3]">
                    <span
                      className="gv-grow block h-full rounded-full"
                      style={{
                        width: `${(d.count / max) * 100}%`,
                        background: top ? "linear-gradient(90deg, #2dd4bf, #0f766e)" : "#b8c2c9",
                      }}
                    />
                  </div>
                  </RowLink>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </section>
  );
}
