"use client";

import { useState } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useSaveSettings, useSettings } from "./hooks";
import type { SettingsView } from "./types";

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { v: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn("min-h-12 rounded-xl border px-3 py-2 text-left disabled:opacity-60", value === o.v ? "border-primary bg-accent" : "border-border bg-card")}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** How scores are worked out and who sees what. Nothing is scored or shown to anyone until this is saved. */
export function SettingsPage() {
  const { data, isLoading, isError, refetch } = useSettings();
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  return <SettingsForm key={String(data.data.configured)} initial={data.data} />;
}

function SettingsForm({ initial }: { initial: SettingsView }) {
  const { can } = useAuth();
  const canEdit = can("campaign:update");
  const save = useSaveSettings();
  const [calcMode, setCalcMode] = useState(initial.calcMode);
  const [bands, setBands] = useState(initial.bands);
  const [approvalLevels, setApprovalLevels] = useState(initial.approvalLevels);
  const [employeeSees, setEmployeeSees] = useState(initial.employeeSees);
  const [ackRequired, setAckRequired] = useState(initial.ackRequired);
  const [ackDays, setAckDays] = useState<number | null>(initial.ackDays ?? 7);

  async function onSave() {
    try {
      await save.mutateAsync({
        calcMode,
        bands: bands.filter((b) => b.label.trim()).map((b) => ({ label: b.label.trim(), minPercent: b.minPercent })),
        approvalLevels,
        employeeSees,
        ackRequired,
        ackDays: ackRequired ? ackDays : null,
      });
      toast.success("บันทึกการตั้งค่าแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4 pb-6">
      {!initial.configured && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ยังไม่ได้ตั้งค่า ตอนนี้ระบบคำนวณผลโดยถ่วงน้ำหนัก ไม่มีเกรด ไม่ต้องอนุมัติ และพนักงานยังไม่เห็นผลของตัวเอง
          ค่าต่างๆ ที่นี่กระทบคะแนนจริงของพนักงาน ควรให้ HR ยืนยันก่อนบันทึก
        </p>
      )}

      <Card className="gap-5 p-4">
        <Choice
          label="วิธีคิดคะแนน"
          value={calcMode}
          disabled={!canEdit}
          onChange={setCalcMode}
          options={[
            { v: "WEIGHTED", label: "ถ่วงน้ำหนัก", hint: "ตามน้ำหนักรายข้อในแบบ แล้วตามน้ำหนักของแต่ละมุมมองผู้ประเมิน" },
            { v: "SIMPLE", label: "เฉลี่ยธรรมดา", hint: "ทุกข้อให้คะแนนมีค่าเท่ากัน" },
          ]}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">เกณฑ์เกรด (ไม่บังคับ)</h2>
          <p className="text-sm text-muted-foreground">คะแนนรวมเป็นเปอร์เซ็นต์ของคะแนนเต็ม ระดับที่ได้คือระดับสูงสุดที่คะแนนถึงเกณฑ์ ไม่ใส่ = ไม่มีเกรด</p>
          {bands.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input aria-label={`ชื่อระดับที่ ${i + 1}`} placeholder="ชื่อระดับ เช่น ดีเยี่ยม" className="h-11 min-w-0 flex-1 md:h-9" maxLength={60} value={b.label} disabled={!canEdit} onChange={(e) => setBands((cur) => cur.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <label className="flex items-center gap-1.5 text-sm">
                ตั้งแต่
                <Input aria-label={`เปอร์เซ็นต์ขั้นต่ำของระดับที่ ${i + 1}`} type="number" min={0} max={100} className="h-11 w-20 md:h-9" value={b.minPercent} disabled={!canEdit} onChange={(e) => setBands((cur) => cur.map((x, k) => (k === i ? { ...x, minPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} />
                %
              </label>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`ลบระดับที่ ${i + 1}`} onClick={() => setBands((cur) => cur.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {canEdit && bands.length < 10 && (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setBands((cur) => [...cur, { label: "", minPercent: 0 }])}>
              <Plus className="size-4" /> เพิ่มระดับ
            </Button>
          )}
        </div>

        <Choice
          label="การอนุมัติผลก่อนประกาศ"
          value={approvalLevels}
          disabled={!canEdit}
          onChange={setApprovalLevels}
          options={[
            { v: 0, label: "ไม่ต้องอนุมัติ", hint: "HR ประกาศผลได้เลยหลังปิดรอบและคำนวณ" },
            { v: 1, label: "ต้องอนุมัติ 1 ชั้น", hint: "ผู้มีสิทธิ์อนุมัติผลประเมินต้องอนุมัติก่อนประกาศ" },
          ]}
        />

        <Choice
          label="พนักงานเห็นผลของตัวเองไหม"
          value={employeeSees}
          disabled={!canEdit}
          onChange={setEmployeeSees}
          options={[
            { v: "NEVER", label: "ไม่เห็น", hint: "ผลดูได้เฉพาะ HR" },
            { v: "AFTER_PUBLISH", label: "เห็นหลังประกาศผล", hint: "ส่งข้อความแจ้งเมื่อประกาศ ความเห็นเพื่อน/ลูกน้องไม่ระบุชื่อ และแสดงเมื่อมีผู้ประเมินกลุ่มนั้นอย่างน้อย 3 คน" },
          ]}
        />

        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold md:min-h-9">
            <Checkbox checked={ackRequired} disabled={!canEdit} onCheckedChange={(c) => setAckRequired(c === true)} />
            ให้พนักงานกด “รับทราบผล”
          </label>
          {ackRequired && (
            <label className="flex items-center gap-2 text-sm">
              ภายใน
              <Input type="number" min={1} max={90} className="h-11 w-20 md:h-9" aria-label="จำนวนวันที่ต้องรับทราบ" disabled={!canEdit} value={ackDays ?? ""} onChange={(e) => setAckDays(Number(e.target.value) || null)} />
              วัน
            </label>
          )}
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button className="h-11 md:h-9" onClick={onSave} disabled={save.isPending}>
              บันทึกการตั้งค่า
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">คุณดูได้อย่างเดียว การแก้ไขต้องมีสิทธิ์แก้ไขรอบประเมิน</p>
        )}
      </Card>
    </div>
  );
}
