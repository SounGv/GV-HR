"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { EmployeeAttendanceSheet, type SheetTarget } from "./employee-attendance-sheet";
import { AttendanceStatusBadge, STATUS_META, STATUS_ORDER } from "./status-meta";
import type { TodayStatus } from "./status-rules";
import type { TodayPerson } from "./types";

type SortKey = "problem" | "name" | "clockIn" | "department";

const SORT_LABEL: Record<SortKey, string> = {
  problem: "ปัญหาก่อน (ขาด → สาย → ลา)",
  name: "ชื่อ ก–ฮ",
  clockIn: "เวลาเข้างาน",
  department: "แผนก",
};

const PAGE = 50;

const byName = (a: TodayPerson, b: TodayPerson) => a.name.localeCompare(b.name, "th");

function sortPeople(list: TodayPerson[], key: SortKey): TodayPerson[] {
  const copy = [...list];
  switch (key) {
    case "name":
      return copy.sort(byName);
    case "department":
      return copy.sort((a, b) => a.department.localeCompare(b.department, "th") || byName(a, b));
    case "clockIn":
      // People who have not scanned go last.
      return copy.sort((a, b) => (a.clockIn ?? "99:99").localeCompare(b.clockIn ?? "99:99") || byName(a, b));
    default:
      return copy.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byName(a, b));
  }
}

/** Short text for the "detail" column / card line. */
function detailOf(p: TodayPerson): string {
  switch (p.status) {
    case "LATE":
      return `เข้า ${p.clockIn} น. · สาย ${p.lateMinutes ?? 0} นาที`;
    case "NORMAL":
      return p.clockIn ? `เข้า ${p.clockIn} น.${p.workMode ? ` · ${p.workMode}` : ""}` : "ลาครึ่งวัน";
    case "ABSENT":
      return `ยังไม่สแกน · กะเริ่ม ${p.shiftStart} น.`;
    case "NOT_YET":
      return `กะเริ่ม ${p.shiftStart} น.`;
    default:
      return "ลางานทั้งวัน";
  }
}

const EMPTY_TEXT: Record<TodayStatus | "all", string> = {
  all: "ยังไม่มีพนักงานในรายการนี้",
  ABSENT: "วันนี้ยังไม่มีคนขาดงาน",
  LATE: "วันนี้ยังไม่มีคนมาสาย",
  ON_LEAVE: "วันนี้ยังไม่มีคนลา",
  NOT_YET: "ทุกคนถึงเวลาเริ่มกะแล้ว",
  NORMAL: "ยังไม่มีคนที่สถานะปกติ",
};

/**
 * Today's people for one status tab (the server already narrowed the list):
 * type to filter at once, sort, show more, and open the side panel. A table on
 * wide screens and one card per person on phones, both tinted by status.
 */
export function AttendanceList({ people, status }: { people: TodayPerson[]; status: TodayStatus | "all" }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("problem");
  const [shown, setShown] = useState(PAGE);
  const [target, setTarget] = useState<SheetTarget | null>(null);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const filtered = q
      ? people.filter((p) => [p.name, p.code, p.department].some((v) => v.toLowerCase().includes(q)))
      : people;
    return sortPeople(filtered, sort);
  }, [people, q, sort]);

  const open = (p: TodayPerson) => setTarget({ code: p.code, name: p.name, department: p.department, today: p });
  const rows = visible.slice(0, shown);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="ค้นหาชื่อ รหัส หรือแผนก…"
            aria-label="ค้นหาพนักงาน"
            className="h-11 border-2 border-primary/40 pr-10 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างคำค้น"
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort((v as SortKey) ?? "problem")}>
          <SelectTrigger className="h-11 w-full sm:w-auto sm:min-w-[260px]" aria-label="เรียงลำดับ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        q ? (
          <EmptyState
            icon={Search}
            title={`ไม่พบ "${query.trim()}"`}
            description="ลองพิมพ์ชื่อหรือรหัสให้สั้นลง หรือล้างคำค้น"
            action={
              <Button variant="outline" className="h-11" onClick={() => setQuery("")}>
                ล้างคำค้น
              </Button>
            }
          />
        ) : (
          <EmptyState title={EMPTY_TEXT[status]} description="รายชื่อจะแสดงที่นี่เมื่อมีข้อมูล" />
        )
      ) : isMobile ? (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.employeeId}>
              <button
                type="button"
                onClick={() => open(p)}
                className={cn(
                  "w-full rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm active:brightness-95",
                  STATUS_META[p.status].card,
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold break-words text-foreground">{p.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {p.code} · {p.department}
                    </span>
                    <span className="mt-1 block text-sm text-foreground">{detailOf(p)}</span>
                  </span>
                  <AttendanceStatusBadge status={p.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead>พนักงาน</TableHead>
                <TableHead>แผนก</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead className="text-right">กะเริ่ม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <TableRow key={p.employeeId} className={cn("cursor-pointer", meta.row)} onClick={() => open(p)}>
                    <TableCell className={meta.bar}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(p);
                        }}
                        className="min-h-11 text-left"
                      >
                        <span className="block font-semibold text-foreground">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.code}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">{p.department}</TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm">{detailOf(p)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{p.shiftStart}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {visible.length > shown && (
        <Button variant="outline" className="h-11 w-full" onClick={() => setShown((n) => n + PAGE)}>
          แสดงเพิ่ม (เหลืออีก {visible.length - shown} คน)
        </Button>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        แสดง {Math.min(shown, visible.length)} จาก {visible.length} คน
      </p>

      <EmployeeAttendanceSheet target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
