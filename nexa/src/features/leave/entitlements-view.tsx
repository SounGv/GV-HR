"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntitlementRow } from "./entitlement-service";
import type { PaidType } from "./year-rollover";

const TYPES: { key: PaidType; label: string }[] = [
  { key: "SICK", label: "ลาป่วย" },
  { key: "PERSONAL", label: "ลากิจ" },
  { key: "ANNUAL", label: "ลาพักร้อน" },
];
const THIS_YEAR = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));

function Cell({ row, type, year, onSaved }: { row: EntitlementRow; type: PaidType; year: number; onSaved: () => void }) {
  const cur = row.types[type];
  const [value, setValue] = useState(cur ? String(cur.total) : "");
  useEffect(() => setValue(cur ? String(cur.total) : ""), [cur]);
  const used = cur?.used ?? 0;
  const left = value === "" ? null : Math.max(0, Math.round((Number(value) - used) * 10) / 10);

  async function commit() {
    if (value === "" || Number(value) === cur?.total) return;
    try {
      await api.put<Envelope<unknown>>("/api/leave/entitlements", { employeeId: row.employeeId, year, type, totalDays: Number(value) });
      toast.success(`บันทึก ${row.name}: ${TYPES.find((t) => t.key === type)!.label} ${value} วัน`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      setValue(cur ? String(cur.total) : "");
    }
  }

  return (
    <td className="px-2 py-2">
      <div className="flex items-center justify-end gap-2">
        <Input
          type="number"
          min={0}
          max={365}
          step="0.5"
          inputMode="decimal"
          aria-label={`${TYPES.find((t) => t.key === type)!.label} สิทธิ์ของ ${row.name}`}
          className="h-11 w-20 text-right md:h-9"
          placeholder="-"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
        <span className="w-20 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          ใช้ {used} · เหลือ {left ?? "-"}
        </span>
      </div>
    </td>
  );
}

/** HR: each person's paid-leave entitlement for a year. Edit a number and leave the field (or press Enter) to save; usage is never changed. */
export function EntitlementsView() {
  const qc = useQueryClient();
  const [year, setYear] = useState(THIS_YEAR);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leave-entitlements", year, term],
    queryFn: () => api.get<Envelope<EntitlementRow[]>>(`/api/leave/entitlements?year=${year}&q=${encodeURIComponent(term)}`),
    placeholderData: (p) => p,
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          แก้สิทธิ์ลาของแต่ละคนได้ที่นี่ (เช่น พักร้อนที่เพิ่มตามอายุงาน) แก้ตัวเลขแล้วกด Enter หรือคลิกออกนอกช่องเพื่อบันทึก ระบบไม่แตะจำนวนวันที่ใช้ไปแล้ว
          และบันทึกประวัติทุกครั้ง ช่องว่าง “-” คือยังไม่มีสิทธิ์ประเภทนั้นในปีนี้ ใส่ตัวเลขเพื่อสร้าง
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm font-medium">
            ปี
            <Input type="number" className="h-11 w-28 md:h-9" value={year} onChange={(e) => setYear(Number(e.target.value) || THIS_YEAR)} />
          </label>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="ค้นหาชื่อหรือรหัส" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" className="h-11 pl-9 md:h-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </Card>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Search} title="ไม่พบพนักงาน" description="ลองเปลี่ยนคำค้น" />
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">พนักงาน</th>
                {TYPES.map((t) => (
                  <th key={t.key} scope="col" className="px-2 py-2 text-right font-medium">
                    {t.label} (วัน)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <th scope="row" className="sticky left-0 min-w-[200px] bg-card px-3 py-2 text-left font-medium">
                    {r.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.code} · {r.department}
                    </span>
                  </th>
                  {TYPES.map((t) => (
                    <Cell key={t.key} row={r} type={t.key} year={year} onSaved={() => qc.invalidateQueries({ queryKey: ["leave-entitlements"] })} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
