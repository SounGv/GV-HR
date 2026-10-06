"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/shared/states";
import { EmployeeAttendanceSheet, type SheetTarget } from "./employee-attendance-sheet";
import { WatchTags } from "./attendance-watch-sections";
import type { WatchPerson } from "./types";

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
              <span className="min-w-0">
                <span className="block text-sm font-semibold break-words text-foreground">{p.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {p.code} · {p.department}
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
