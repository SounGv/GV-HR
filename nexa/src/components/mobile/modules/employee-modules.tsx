"use client";

import { useState } from "react";
import { Check, PiggyBank, ShieldPlus, Square, SquareCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileScreen } from "../mobile-screen";
import { MobilePrimaryButton } from "../mobile-action-footer";
import {
  type DemoState,
  MobileBlockedAlert,
  MobileFieldLabel,
  MobileModuleCard,
  MobileModuleLayout,
  MobileSelectBox,
} from "../mobile-ui";

function MobileToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-[18px] rounded-full bg-card transition-[left]",
          checked ? "left-5" : "left-0.5",
        )}
      />
    </button>
  );
}

function MobileProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded bg-muted", className)}>
      <div className="h-full rounded bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

const GOAL_MILESTONES = [
  "ติดต่อลูกค้าเป้าหมาย 50 ราย",
  "ปิดดีลได้ 10 ราย",
  "ปิดดีลได้ 20 ราย",
];

/**
 * Goals, feedback (peer recognition), and group benefits have no backend
 * feature yet — these render as honest "coming soon" screens via the
 * /coming-soon route rather than pretending to submit anything real.
 * Real modules (attendance, leave, employees, payroll, etc.) render the
 * actual desktop page through the auto-shell instead of a bespoke mockup —
 * see mobile-module-registry.ts.
 */
export function MobileGoalsModule() {
  const [milestones, setMilestones] = useState([true, true, false]);
  const goalPct = Math.round((milestones.filter(Boolean).length / milestones.length) * 100);

  return (
    <MobileScreen title="เป้าหมาย" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <MobileModuleCard>
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">ขยายฐานลูกค้าใหม่ 20 ราย</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Q3 2569 • เชื่อมโยงกับ KPI: ยอดขายรายเดือน
              </p>
            </div>
            <span className="text-base font-bold text-primary">{goalPct}%</span>
          </div>
          <MobileProgressBar value={goalPct} className="mb-4" />
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Milestone</p>
          {GOAL_MILESTONES.map((label, i) => {
            const done = milestones[i];
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setMilestones((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                }
                className="flex w-full items-center gap-2.5 border-b border-border py-2.5 last:border-b-0 active:opacity-80"
              >
                {done ? (
                  <SquareCheck className="size-[19px] shrink-0 text-success" />
                ) : (
                  <Square className="size-[19px] shrink-0 text-muted-foreground/60" />
                )}
                <span className="text-[13px] text-foreground">{label}</span>
              </button>
            );
          })}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

type FeedbackTab = "send" | "received";

export function MobileFeedbackModule() {
  const [tab, setTab] = useState<FeedbackTab>("send");
  const [anon, setAnon] = useState(false);

  return (
    <MobileScreen title="ฟีดแบ็ก" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        footer={
          tab === "send" ? (
            <MobilePrimaryButton>ส่งฟีดแบ็ก</MobilePrimaryButton>
          ) : undefined
        }
      >
        <div className="mb-3.5 flex gap-1.5">
          {(
            [
              { value: "send" as const, label: "ส่งฟีดแบ็ก" },
              { value: "received" as const, label: "ที่ได้รับ" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTab(opt.value)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-[13px] font-semibold transition active:scale-[0.99]",
                tab === opt.value
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {tab === "send" && (
          <MobileModuleCard>
            <MobileFieldLabel>ส่งถึง</MobileFieldLabel>
            <MobileSelectBox value="ธนกร วงศ์สุข (หัวหน้าทีม)" className="mb-3.5" />
            <MobileFieldLabel>ข้อความ</MobileFieldLabel>
            <MobileSelectBox
              value="ขอบคุณที่ช่วยสอนงานลูกค้ารายใหม่ ทำให้ปิดดีลได้เร็วขึ้นมาก"
              className="mb-3.5"
            />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-foreground">ไม่ระบุชื่อผู้ส่ง</span>
              <MobileToggle checked={anon} onChange={() => setAnon((v) => !v)} />
            </div>
          </MobileModuleCard>
        )}

        {tab === "received" && (
          <MobileModuleCard className="divide-y divide-border p-0">
            <div className="px-3.5 py-3">
              <p className="mb-1 text-xs text-muted-foreground">ไม่ระบุชื่อ • 3 วันที่แล้ว</p>
              <p className="text-[13px] text-foreground">
                งานนำเสนอลูกค้าสัปดาห์นี้เตรียมข้อมูลดีมาก ทำให้ทีมตอบคำถามได้ครบ
              </p>
            </div>
            <div className="px-3.5 py-3">
              <p className="mb-1 text-xs text-muted-foreground">ธนกร วงศ์สุข • 1 สัปดาห์ที่แล้ว</p>
              <p className="text-[13px] text-foreground">
                ช่วยทีมได้ดีตอนลูกค้าเร่งด่วน ขอบคุณที่รับผิดชอบเต็มที่
              </p>
            </div>
          </MobileModuleCard>
        )}
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileBenefitModule() {
  const [demo, setDemo] = useState<DemoState>("normal");

  return (
    <MobileScreen title="สวัสดิการ" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout demo={demo} onDemoChange={setDemo}>
        <div className="mb-4 space-y-2.5">
          <MobileModuleCard className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-[13px] font-semibold text-foreground">ประกันสุขภาพกลุ่ม</p>
              <p className="text-[11px] text-muted-foreground">วงเงินคงเหลือ 18,000 / 25,000</p>
            </div>
            <ShieldPlus className="size-[22px] text-primary" />
          </MobileModuleCard>
          <MobileModuleCard className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-[13px] font-semibold text-foreground">กองทุนสำรองเลี้ยงชีพ</p>
              <p className="text-[11px] text-muted-foreground">สะสม 5% ของเงินเดือน</p>
            </div>
            <PiggyBank className="size-[22px] text-primary" />
          </MobileModuleCard>
        </div>

        <p className="mb-2 px-1 text-[13px] font-semibold text-foreground">ตรวจสุขภาพประจำปี</p>

        {demo === "success" && (
          <MobileModuleCard className="py-5 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success-muted">
              <Check className="size-6 text-success" />
            </div>
            <p className="text-sm font-bold text-foreground">ยื่นขอใช้สิทธิ์สำเร็จ</p>
            <p className="mt-1 text-xs text-muted-foreground">นัดหมายตรวจสุขภาพวันที่ 20 ส.ค. 2569</p>
          </MobileModuleCard>
        )}

        {demo === "blocked" && (
          <MobileBlockedAlert>
            คุณใช้สิทธิ์ตรวจสุขภาพประจำปีของปีนี้ครบแล้ว สิทธิ์ใหม่จะเริ่มต้นปีถัดไป
          </MobileBlockedAlert>
        )}

        {demo === "normal" && (
          <MobileModuleCard className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground">สิทธิ์คงเหลือปีนี้</p>
              <p className="text-[11px] font-semibold text-success">1 / 1 ครั้ง — ใช้ได้</p>
            </div>
            <button
              type="button"
              onClick={() => setDemo("success")}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground active:scale-[0.99]"
            >
              ยื่นขอใช้สิทธิ์
            </button>
          </MobileModuleCard>
        )}
      </MobileModuleLayout>
    </MobileScreen>
  );
}
