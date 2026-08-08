"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  PiggyBank,
  ShieldPlus,
  Square,
  SquareCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileScreen } from "../mobile-screen";
import { MobilePrimaryButton } from "../mobile-action-footer";
import { MobileDisabledButton } from "../mobile-ui";
import { MobileFilterChip } from "../mobile-segmented-tabs";
import {
  type DemoState,
  MobileBlockedAlert,
  MobileDevNote,
  MobileFieldLabel,
  MobileModuleCard,
  MobileModuleLayout,
  MobileSelectBox,
  MobileStatusChip,
  MobileSuccessScreen,
  MobileUploadZone,
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

function MobileProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "danger";
  className?: string;
}) {
  const fill =
    tone === "success" ? "bg-success" : tone === "danger" ? "bg-destructive" : "bg-primary";
  return (
    <div className={cn("h-2 overflow-hidden rounded bg-muted", className)}>
      <div className={cn("h-full rounded", fill)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

const KPI_ITEMS = [
  {
    id: "sales",
    name: "ยอดขายรายเดือน",
    current: "420,000",
    target: "500,000",
    unit: "บาท",
    pct: 84,
    status: "below" as const,
  },
  {
    id: "ontime",
    name: "อัตราการปิดงานตรงเวลา",
    current: "95",
    target: "90",
    unit: "%",
    pct: 105,
    status: "exceed" as const,
  },
  {
    id: "csat",
    name: "ความพึงพอใจลูกค้า",
    current: "4.5",
    target: "4.5",
    unit: "คะแนน",
    pct: 100,
    status: "meet" as const,
  },
];

const KPI_STATUS = {
  below: { label: "ต่ำกว่าเป้า", tone: "danger" as const, barTone: "danger" as const },
  meet: { label: "ตรงเป้า", tone: "primary" as const, barTone: "primary" as const },
  exceed: { label: "เกินเป้า", tone: "success" as const, barTone: "success" as const },
};

const GOAL_MILESTONES = [
  "ติดต่อลูกค้าเป้าหมาย 50 ราย",
  "ปิดดีลได้ 10 ราย",
  "ปิดดีลได้ 20 ราย",
];

const PAYSLIP_MONTHS = [
  { label: "ก.ค. 2569", net: "32,400" },
  { label: "มิ.ย. 2569", net: "32,400" },
  { label: "พ.ค. 2569", net: "31,800" },
  { label: "เม.ย. 2569", net: "31,800" },
  { label: "มี.ค. 2569", net: "34,200" },
  { label: "ก.พ. 2569", net: "31,800" },
];

export function MobileKpiModule() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <MobileScreen title="KPI ส่วนตัว" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="space-y-2.5 p-3.5">
        {KPI_ITEMS.map((kpi) => {
          const meta = KPI_STATUS[kpi.status];
          const isOpen = expanded[kpi.id];
          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [kpi.id]: !prev[kpi.id] }))}
              className="w-full rounded-xl bg-card p-4 text-left active:scale-[0.99]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-foreground">{kpi.name}</span>
                <MobileStatusChip label={meta.label} tone={meta.tone} />
              </div>
              <MobileProgressBar value={Math.min(kpi.pct, 100)} tone={meta.barTone} className="mb-1.5" />
              <p className="text-xs text-muted-foreground">
                {kpi.current} / {kpi.target} {kpi.unit}
              </p>
              {isOpen && (
                <p className="mt-2.5 border-t border-border pt-2.5 text-xs leading-relaxed text-muted-foreground">
                  คำนวณจากผลงานสะสมของเดือนปัจจุบัน หารด้วยเป้าหมายที่ตกลงไว้กับหัวหน้างานตอนต้นไตรมาส
                  อัปเดตข้อมูลทุกคืน
                </p>
              )}
            </button>
          );
        })}
      </div>
    </MobileScreen>
  );
}

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

type ReviewTab = "self" | "manager" | "history";

export function MobileReviewModule() {
  const [tab, setTab] = useState<ReviewTab>("self");

  return (
    <MobileScreen title="ประเมินผล" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <div className="-mx-1 mb-3.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {(
            [
              { value: "self" as const, label: "ประเมินตนเอง" },
              { value: "manager" as const, label: "ผลจากหัวหน้า" },
              { value: "history" as const, label: "ประวัติ" },
            ] as const
          ).map((opt) => (
            <MobileFilterChip
              key={opt.value}
              label={opt.label}
              active={tab === opt.value}
              onClick={() => setTab(opt.value)}
            />
          ))}
        </div>

        {tab === "self" && (
          <MobileModuleCard className="space-y-3.5">
            <div>
              <MobileFieldLabel>คุณภาพงาน (ให้คะแนน 1-5)</MobileFieldLabel>
              <div className="flex gap-1.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
                  4
                </span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-[13px] text-muted-foreground">
                  5
                </span>
              </div>
            </div>
            <div>
              <MobileFieldLabel>ความเห็นเพิ่มเติม</MobileFieldLabel>
              <MobileSelectBox value="ทำงานตามเป้าหมายที่วางไว้ได้ครบ อยากพัฒนาเรื่องการบริหารเวลาในไตรมาสหน้า" />
            </div>
          </MobileModuleCard>
        )}

        {tab === "manager" && (
          <MobileModuleCard className="divide-y divide-border p-0">
            <div className="flex justify-between px-4 py-2.5 text-[13px]">
              <span>คุณภาพงาน</span>
              <span className="font-bold">ตนเอง 4 • หัวหน้า 4</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-[13px]">
              <span>การทำงานเป็นทีม</span>
              <span className="font-bold">ตนเอง 4 • หัวหน้า 5</span>
            </div>
          </MobileModuleCard>
        )}

        {tab === "history" && (
          <MobileModuleCard className="divide-y divide-border p-0">
            <div className="flex justify-between px-3.5 py-3 text-[13px]">
              <span>Q2 2569</span>
              <span className="font-bold text-success">4.3 / 5</span>
            </div>
            <div className="flex justify-between px-3.5 py-3 text-[13px]">
              <span>Q1 2569</span>
              <span className="font-bold text-success">4.0 / 5</span>
            </div>
          </MobileModuleCard>
        )}
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

export function MobilePayslipModule() {
  const maxNet = useMemo(() => Math.max(...PAYSLIP_MONTHS.map((m) => parseInt(m.net.replace(/,/g, "")))), []);
  const [selected, setSelected] = useState(0);
  const month = PAYSLIP_MONTHS[selected];

  return (
    <MobileScreen title="สลิปเงินเดือน" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="space-y-3.5 p-3.5">
        <MobileModuleCard>
          <p className="mb-2.5 text-xs font-semibold text-muted-foreground">เงินเดือนสุทธิ 6 เดือนล่าสุด</p>
          <div className="flex h-[90px] items-end gap-2">
            {PAYSLIP_MONTHS.map((m, i) => {
              const net = parseInt(m.net.replace(/,/g, ""));
              const height = Math.round((net / maxNet) * 100);
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setSelected(i)}
                  className="flex h-full flex-1 flex-col items-center justify-end active:opacity-80"
                >
                  <div
                    className={cn(
                      "w-full rounded-t bg-primary transition-opacity",
                      selected === i ? "opacity-100" : "opacity-60",
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="mt-1 text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              );
            })}
          </div>
        </MobileModuleCard>

        <MobileModuleCard>
          <div className="mb-3.5 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">{month.label}</p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Download className="size-3.5" />
              PDF
            </button>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">เงินเดือนพื้นฐาน</span>
              <span>35,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ค่าคอมมิชชั่น</span>
              <span>2,200</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>ประกันสังคม</span>
              <span>-750</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>ภาษีหัก ณ ที่จ่าย</span>
              <span>-4,050</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2.5 font-bold">
              <span>เงินเดือนสุทธิ</span>
              <span className="text-success">{month.net}</span>
            </div>
          </div>
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

const EXPENSE_TYPES = ["เดินทาง", "อาหาร", "อื่นๆ"];

export function MobileExpenseModule() {
  const [demo, setDemo] = useState<DemoState>("normal");
  const [expenseType, setExpenseType] = useState(0);

  return (
    <MobileScreen title="เบิกค่าใช้จ่าย" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        demo={demo}
        onDemoChange={setDemo}
        success={
          <div className="rounded-xl bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-success-muted">
              <Check className="size-7 text-success" />
            </div>
            <p className="text-base font-bold text-foreground">ส่งคำขอเบิกสำเร็จ</p>
            <p className="mt-1 text-sm text-muted-foreground">850 บาท • ค่าเดินทาง</p>
            <div className="mt-4 space-y-2 rounded-[10px] bg-surface-muted p-3 text-left">
              <p className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 text-success" />
                ส่งคำขอแล้ว
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Circle className="size-4" />
                รออนุมัติ
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Circle className="size-4" />
                รอโอนเงิน
              </p>
            </div>
          </div>
        }
        blocked={
          <MobileBlockedAlert>
            ยังไม่ได้แนบรูปใบเสร็จ — ต้องแนบหลักฐานก่อนส่งคำขอทุกครั้ง
          </MobileBlockedAlert>
        }
        devNote="ต้องต่อกล้อง/อัปโหลดไฟล์จริงและระบบอนุมัติ-โอนเงินฝั่ง backend"
        footer={
          demo === "blocked" ? (
            <MobileDisabledButton>แนบใบเสร็จก่อนส่ง</MobileDisabledButton>
          ) : (
            <MobilePrimaryButton onClick={() => setDemo("success")}>ส่งคำขอเบิก</MobilePrimaryButton>
          )
        }
      >
        <MobileModuleCard>
          <MobileFieldLabel>ประเภทค่าใช้จ่าย</MobileFieldLabel>
          <div className="mb-4 flex gap-2">
            {EXPENSE_TYPES.map((type, i) => (
              <button
                key={type}
                type="button"
                onClick={() => setExpenseType(i)}
                className={cn(
                  "flex-1 rounded-[10px] border py-2.5 text-center text-xs font-semibold transition active:scale-[0.99]",
                  expenseType === i
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-card text-foreground",
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <MobileFieldLabel>ใบเสร็จ</MobileFieldLabel>
          {demo === "blocked" ? (
            <div className="mb-4 rounded-[10px] border border-dashed border-destructive px-3 py-4 text-center text-destructive">
              <p className="text-xs">ยังไม่ได้แนบใบเสร็จ</p>
            </div>
          ) : (
            <MobileUploadZone label="แตะเพื่อแนบใบเสร็จ" />
          )}

          <div className="mt-4">
            <MobileFieldLabel>จำนวนเงิน (บาท)</MobileFieldLabel>
            <MobileSelectBox value="850" />
          </div>
        </MobileModuleCard>
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
