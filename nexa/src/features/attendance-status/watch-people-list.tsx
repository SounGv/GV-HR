"use client";

import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { EmptyState } from "@/components/shared/states";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmployeeAttendanceSheet, type SheetTarget } from "./employee-attendance-sheet";
import { WatchTags } from "./watch-tags";
import type { WatchPerson } from "./types";

/** The few people shown on the home page: each row opens the same side panel (the last 30 days of that person) without leaving the page. */
export function WatchPeopleRows({ people }: { people: WatchPerson[] }) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  return (
    <>
      <ul>
        {people.map((p) => (
          <li key={p.code}>
            <button
              type="button"
              onClick={() => setTarget({ code: p.code, name: p.name, department: p.department })}
              aria-label={`${p.name} ดูสรุปการเข้างาน 30 วัน`}
              className="gv-row group -mx-2 flex min-h-11 w-[calc(100%+1rem)] flex-wrap items-center gap-2.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-primary"
            >
              <PersonAvatar name={p.name} gender={p.gender ?? null} seed={p.employeeId ?? p.code} src={p.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-snug font-semibold break-words text-foreground">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.department}</span>
              </span>
              <WatchTags person={p} />
              <ChevronRight className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <EmployeeAttendanceSheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}

/** People who reached a threshold; each row opens the same side panel as the daily list. */
export function WatchPeopleList({ people, empty }: { people: WatchPerson[]; empty: string }) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  if (people.length === 0) return <EmptyState icon={Search} title={empty} description="ไม่มีใครเข้าเกณฑ์ในช่วง 30 วันล่าสุด" />;
  return (
    <>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {people.map((p) => (
          <li key={p.code}>
            <button
              type="button"
              onClick={() => setTarget({ code: p.code, name: p.name, department: p.department })}
              className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <PersonAvatar name={p.name} gender={p.gender ?? null} seed={p.employeeId ?? p.code} src={p.avatarUrl} className="size-9" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold break-words text-foreground">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.code} · {p.department}
                  </span>
                </span>
              </span>
              <WatchTags person={p} />
            </button>
          </li>
        ))}
      </ul>
      <EmployeeAttendanceSheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}
