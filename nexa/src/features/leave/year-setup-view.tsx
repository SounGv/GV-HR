"use client";

import { useState } from "react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { LEAVE_TYPE_LABEL } from "./labels";
import type { RolloverPlan } from "./year-service";

const THIS_YEAR = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());

/**
 * HR tool: set up the next year's leave entitlements from this year's. Always shows a preview first
 * (what would be created, what is skipped); nothing is written until HR confirms, and existing rows are never changed.
 */
export function YearSetupView() {
  const [fromYear, setFromYear] = useState(Number(THIS_YEAR));
  const [toYear, setToYear] = useState(Number(THIS_YEAR) + 1);
  const [cap, setCap] = useState(0);
  const [plan, setPlan] = useState<RolloverPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  // A preview only counts while the inputs still match what was previewed.
  const fresh = plan && plan.fromYear === fromYear && plan.toYear === toYear && plan.carryAnnualCap === cap;

  async function runPreview() {
    setLoading(true);
    try {
      const res = await api.get<Envelope<RolloverPlan>>(
        `/api/leave/year-rollover?fromYear=${fromYear}&toYear=${toYear}&carryAnnualCap=${cap}`,
      );
      setPlan(res.data);
    } catch (err) {
      setPlan(null);
      toast.error(err instanceof ApiError ? err.message : "ดูตัวอย่างไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setApplying(true);
    try {
      const res = await api.post<Envelope<{ inserted: number }>>("/api/leave/year-rollover", {
        fromYear,
        toYear,
        carryAnnualCap: cap,
        expectedInsert: plan.to_insert,
      });
      toast.success(`สร้างสิทธิ์ลาปี ${toYear} แล้ว ${res.data.inserted} แถว`);
      setConfirm(false);
      await runPreview();
    } catch (err) {
      setConfirm(false);
      toast.error(err instanceof ApiError ? err.message : "สร้างสิทธิ์ไม่สำเร็จ");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          สร้างสิทธิ์ลาของปีใหม่จากสิทธิ์ของปีเดิม ทุกคนเริ่มด้วยสิทธิ์เท่าเดิมและใช้ไป 0 วัน ลาพักร้อนที่เหลือยกยอดได้ไม่เกินจำนวนที่กำหนด
          ระบบ <b>ไม่แก้แถวที่มีอยู่แล้ว</b> และไม่ปรับสิทธิ์ตามอายุงานให้ (ปรับรายคนได้หลังสร้าง)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium">
            จากปี
            <Input type="number" className="h-11 md:h-9" value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            เป็นปี
            <Input type="number" className="h-11 md:h-9" value={toYear} onChange={(e) => setToYear(Number(e.target.value))} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            ยกยอดลาพักร้อนได้ไม่เกิน (วัน)
            <Input type="number" min={0} max={60} className="h-11 md:h-9" value={cap} onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        </div>
        <div>
          <Button className="h-11 md:h-9" onClick={runPreview} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} ดูตัวอย่างก่อนสร้าง
          </Button>
        </div>
      </Card>

      {plan && (
        <Card className="gap-4 p-4" aria-label="ตัวอย่างสิ่งที่จะสร้าง">
          <h2 className="text-base font-semibold">
            ตัวอย่าง: ปี {plan.fromYear} → ปี {plan.toYear}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">แถวสิทธิ์ปีเดิม</dt>
              <dd className="font-semibold tabular-nums">{plan.rows_in} แถว ({plan.matched} คนที่ยังทำงานอยู่)</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">จะสร้างใหม่</dt>
              <dd className="font-semibold tabular-nums">
                {plan.to_insert} แถว (
                {Object.entries(plan.byType)
                  .map(([t, n]) => `${LEAVE_TYPE_LABEL[t as keyof typeof LEAVE_TYPE_LABEL] ?? t} ${n}`)
                  .join(" · ") || "-"}
                )
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">วันลาพักร้อนที่ยกยอดรวม</dt>
              <dd className="font-semibold tabular-nums">{plan.carriedDays} วัน</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ข้าม (มีแถวปีใหม่อยู่แล้ว)</dt>
              <dd className="tabular-nums">{plan.skipped.already_exists} แถว</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ข้าม (พนักงานที่ไม่ได้ทำงานแล้ว)</dt>
              <dd className="tabular-nums">{plan.skipped.inactive_employee} แถว</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">แก้ไขแถวเดิม</dt>
              <dd className="tabular-nums">{plan.to_update} แถว</dd>
            </div>
          </dl>

          {plan.sample_diff.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">รหัส · ชื่อ</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">ประเภท</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">ปีเดิม (สิทธิ์/ใช้)</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">ยกยอด</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">ปีใหม่ (สิทธิ์)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.sample_diff.map((s, i) => (
                    <tr key={`${s.code}-${s.type}-${i}`}>
                      <td className="px-3 py-2">
                        {s.code} · {s.name}
                      </td>
                      <td className="px-2 py-2">{LEAVE_TYPE_LABEL[s.type as keyof typeof LEAVE_TYPE_LABEL] ?? s.type}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {s.fromTotal}/{s.fromUsed}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{s.carried || "-"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{s.toTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`flex items-center gap-2 text-sm ${fresh ? "text-success" : "text-warning"}`}>
              {fresh ? <CircleCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
              {fresh ? "ตัวอย่างตรงกับค่าที่ตั้งไว้" : "เปลี่ยนค่าแล้ว กรุณากด “ดูตัวอย่าง” ใหม่"}
            </p>
            <Button className="h-11 md:h-9" disabled={!fresh || plan.to_insert === 0} onClick={() => setConfirm(true)}>
              สร้างสิทธิ์ลาปี {plan.toYear}
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`สร้างสิทธิ์ลาปี ${toYear}?`}
        description={plan ? `จะสร้างแถวใหม่ ${plan.to_insert} แถว ไม่แก้ไขหรือลบแถวเดิม` : undefined}
        confirmLabel="สร้างสิทธิ์"
        onConfirm={apply}
        loading={applying}
      />
    </div>
  );
}
