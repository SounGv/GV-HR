"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Crown,
  Download,
  FileText,
  Loader2,
  Network,
  Pencil,
  Search,
  Shield,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileScreen } from "../mobile-screen";
import { MobilePrimaryButton } from "../mobile-action-footer";
import { MobileFilterChip } from "../mobile-segmented-tabs";
import {
  MobileBlockedAlert,
  MobileFieldLabel,
  MobileModuleCard,
  MobileModuleLayout,
  MobileSelectBox,
  MobileStatusChip,
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

const MENU_TOGGLE_ITEMS = [
  { id: "checkin", name: "สแกนเข้า-ออกงาน", icon: Users },
  { id: "emplist", name: "รายชื่อพนักงาน", icon: Users },
  { id: "addemp", name: "เพิ่มพนักงาน", icon: UserPlus },
  { id: "orgchart", name: "โครงสร้างองค์กร", icon: Network },
  { id: "access", name: "สิทธิ์การเข้าถึง", icon: Shield },
  { id: "approvals", name: "อนุมัติเอกสาร", icon: FileText },
];

const EMP_LIST = [
  { name: "สมชาย ใจดี", dept: "ขาย", pos: "พนักงานขาย" },
  { name: "พิมพ์ชนก แสงทอง", dept: "คลังสินค้า", pos: "เจ้าหน้าที่คลัง" },
  { name: "ธนกร วงศ์สุข", dept: "ปฏิบัติการ", pos: "หัวหน้าทีม" },
  { name: "อรวรรณ ทองดี", dept: "ขาย", pos: "พนักงานขาย" },
  { name: "วีระชัย ศรีสุข", dept: "ปฏิบัติการ", pos: "พนักงานทั่วไป" },
];

const DEPT_FILTERS = ["ทั้งหมด", "ขาย", "คลังสินค้า", "ปฏิบัติการ"];

const ADDEMP_STEPS = ["ข้อมูลพื้นฐาน", "ตำแหน่ง/แผนก", "เงินเดือนเริ่มต้น", "เอกสารแนบ"];

type PermKey = "viewKpi" | "approve" | "viewSalary" | "editPayroll";

const PERM_DEFS: { key: PermKey; label: string; risky: boolean }[] = [
  { key: "viewKpi", label: "ดูรายงาน KPI ทีม", risky: false },
  { key: "approve", label: "อนุมัติคำขอ (ลา/แก้เวลา/เบิกจ่าย)", risky: true },
  { key: "viewSalary", label: "ดูเงินเดือนคนอื่น", risky: false },
  { key: "editPayroll", label: "แก้ไข/รันเงินเดือน", risky: true },
];

type ApprovalItem = {
  id: number;
  type: string;
  typeKey: string;
  name: string;
  detail: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
};

const APPROVAL_ITEMS_INIT: ApprovalItem[] = [
  { id: 1, type: "ลา", typeKey: "leave", name: "สมชาย ใจดี", detail: "ลาป่วย 12–13 ส.ค.", status: "pending" },
  { id: 2, type: "แก้เวลา", typeKey: "time", name: "พิมพ์ชนก แสงทอง", detail: "แก้เวลาเข้างาน 5 ส.ค.", status: "pending" },
  { id: 3, type: "เบิกค่าใช้จ่าย", typeKey: "expense", name: "ธนกร วงศ์สุข", detail: "ค่าเดินทาง 850 บาท", status: "pending" },
  { id: 4, type: "นอกสถานที่", typeKey: "onsite", name: "อรวรรณ ทองดี", detail: "ขอ WFH 8 ส.ค.", status: "approved" },
];

const APPROVAL_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "leave", label: "ลา" },
  { key: "time", label: "แก้เวลา" },
  { key: "expense", label: "เบิกค่าใช้จ่าย" },
  { key: "onsite", label: "นอกสถานที่" },
];

const LATE_LIST = [
  { name: "กิตติพงษ์ มั่นคง", dept: "ขาย", minutes: 22 },
  { name: "นิภาพร แซ่ลิ้ม", dept: "คลังสินค้า", minutes: 8 },
  { name: "ประยุทธ บุญมี", dept: "ปฏิบัติการ", minutes: 15 },
];

const MONTHLY_LATE = [
  { label: "มี.ค.", pct: 4 },
  { label: "เม.ย.", pct: 6 },
  { label: "พ.ค.", pct: 5 },
  { label: "มิ.ย.", pct: 7 },
  { label: "ก.ค.", pct: 5 },
  { label: "ส.ค.", pct: 5 },
];

const ONSITE_GRANTS = [
  { name: "อรวรรณ ทองดี", type: "WFH", period: "1–31 ส.ค. 2569", used: 6, requested: 8 },
  { name: "ธนกร วงศ์สุข", type: "นอกสถานที่ลูกค้า", period: "5–7 ส.ค. 2569", used: 2, requested: 3 },
];

const PAYROLL_STEPS = [
  "ดึงข้อมูลเข้างาน",
  "คำนวณเงินเดือน",
  "ตรวจสอบความผิดปกติ",
  "อนุมัติ",
  "จ่ายเงิน",
];

const DEPT_RANK = [
  { id: "sales", name: "ขาย", pct: 108 },
  { id: "cs", name: "ลูกค้าสัมพันธ์", pct: 101 },
  { id: "ops", name: "ปฏิบัติการ", pct: 95 },
  { id: "warehouse", name: "คลังสินค้า", pct: 88 },
];

const EXPORT_TYPES = [
  { key: "attendance", label: "เข้างาน" },
  { key: "payroll", label: "เงินเดือน" },
  { key: "kpi", label: "KPI" },
  { key: "leave", label: "การลา" },
];

const SETTINGS_ROWS = [
  { key: "geofence", label: "ตำแหน่ง Geofence สาขา", value: "สำนักงานใหญ่ • รัศมี 150 ม." },
  { key: "workhours", label: "เวลาทำงานมาตรฐาน", value: "09:00 – 18:00 น." },
  { key: "leavepolicy", label: "นโยบายวันลาแต่ละประเภท", value: "ป่วย 30 / กิจ 6 / พักร้อน 6 วัน" },
  { key: "approvalsteps", label: "กฎการอนุมัติ", value: "2 ขั้น (หัวหน้างาน → HR)" },
];

function deptRankTone(pct: number): "success" | "primary" | "danger" {
  if (pct >= 100) return "success";
  if (pct >= 95) return "primary";
  return "danger";
}

export function MobileMenuSettingsModule() {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  const isVisible = (id: string) => visibility[id] !== false;

  return (
    <MobileScreen title="ตั้งค่าเมนูของฉัน" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <p className="mb-2.5 px-1 text-xs text-muted-foreground">
          เลือกเมนูที่จะแสดงในหน้าหลัก HR ของบัญชีนี้ ปิดเมนูที่ไม่ได้ใช้เพื่อให้หน้าหลักดูง่ายขึ้น
        </p>
        <MobileModuleCard className="divide-y divide-border p-0">
          {MENU_TOGGLE_ITEMS.map((item) => {
            const Icon = item.icon;
            const on = isVisible(item.id);
            return (
              <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
                <Icon className="size-[18px] shrink-0 text-primary" />
                <span className="flex-1 text-[13px] font-medium text-foreground">{item.name}</span>
                <MobileToggle
                  checked={on}
                  onChange={() =>
                    setVisibility((prev) => ({ ...prev, [item.id]: !isVisible(item.id) }))
                  }
                />
              </div>
            );
          })}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

export function MobileEmpListModule() {
  const [deptFilter, setDeptFilter] = useState("ทั้งหมด");

  const filtered = useMemo(() => {
    if (deptFilter === "ทั้งหมด") return EMP_LIST;
    return EMP_LIST.filter((e) => e.dept === deptFilter);
  }, [deptFilter]);

  return (
    <MobileScreen title="รายชื่อพนักงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">ค้นหาชื่อพนักงาน</span>
        </div>

        <div className="-mx-1 mb-3.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {DEPT_FILTERS.map((label) => (
            <MobileFilterChip
              key={label}
              label={label}
              active={deptFilter === label}
              onClick={() => setDeptFilter(label)}
            />
          ))}
        </div>

        <MobileModuleCard className="divide-y divide-border p-0">
          {filtered.map((emp) => (
            <div key={emp.name} className="flex items-center gap-3 px-3.5 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <User className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">{emp.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {emp.pos} • {emp.dept}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </div>
          ))}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

export function MobileAddEmpModule() {
  const [step, setStep] = useState(0);
  const isLast = step === ADDEMP_STEPS.length - 1;

  return (
    <MobileScreen title="เพิ่มพนักงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        footer={
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="flex h-[50px] flex-1 items-center justify-center rounded-[10px] border border-border bg-card text-sm font-bold text-muted-foreground active:scale-[0.99]"
              >
                ย้อนกลับ
              </button>
            )}
            <MobilePrimaryButton
              className={step > 0 ? "flex-[2]" : "w-full"}
              onClick={() => (isLast ? undefined : setStep((s) => Math.min(ADDEMP_STEPS.length - 1, s + 1)))}
            >
              {isLast ? "ยืนยันและบันทึก" : "ถัดไป"}
            </MobilePrimaryButton>
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-1.5">
          {ADDEMP_STEPS.map((_, i) => (
            <div
              key={i}
              className={cn("h-[5px] flex-1 rounded-sm", i <= step ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>

        {step === 0 && (
          <MobileModuleCard>
            <p className="mb-3 text-[13px] font-bold text-foreground">ข้อมูลพื้นฐาน</p>
            <div className="space-y-2.5">
              <MobileSelectBox value="ชื่อ-นามสกุล" className="text-muted-foreground" />
              <MobileSelectBox value="เบอร์โทรศัพท์" className="text-muted-foreground" />
              <MobileSelectBox value="เลขบัตรประชาชน" className="text-muted-foreground" />
            </div>
          </MobileModuleCard>
        )}

        {step === 1 && (
          <MobileModuleCard>
            <p className="mb-3 text-[13px] font-bold text-foreground">ตำแหน่ง / แผนก</p>
            <div className="space-y-2.5">
              <MobileSelectBox value="ตำแหน่งงาน" className="text-muted-foreground" />
              <MobileSelectBox value="แผนก" className="text-muted-foreground" />
              <MobileSelectBox value="หัวหน้างาน" className="text-muted-foreground" />
            </div>
          </MobileModuleCard>
        )}

        {step === 2 && (
          <MobileModuleCard>
            <p className="mb-3 text-[13px] font-bold text-foreground">เงินเดือนเริ่มต้น</p>
            <MobileSelectBox value="จำนวนเงิน (บาท/เดือน)" className="text-muted-foreground" />
          </MobileModuleCard>
        )}

        {step === 3 && (
          <MobileModuleCard>
            <p className="mb-3 text-[13px] font-bold text-foreground">เอกสารแนบ</p>
            <MobileUploadZone label="แนบสำเนาบัตรประชาชน" />
            <div className="mt-2.5">
              <MobileUploadZone label="แนบสัญญาจ้าง" />
            </div>
          </MobileModuleCard>
        )}
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileOrgChartModule() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <MobileScreen title="โครงสร้างองค์กร" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <MobileModuleCard className="divide-y divide-border p-0">
          <div className="flex items-center gap-2.5 px-3.5 py-3.5">
            <div className="flex size-[34px] items-center justify-center rounded-full bg-accent">
              <Crown className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-foreground">กรรมการผู้จัดการ</p>
              <p className="text-[11px] text-muted-foreground">วิชัย พัฒนกิจ</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((p) => ({ ...p, org1: !p.org1 }))}
            className="flex w-full items-center gap-2.5 py-3.5 pl-8 pr-3.5 text-left active:bg-muted/50"
          >
            <ChevronRight
              className={cn("size-4 text-muted-foreground transition-transform", expanded.org1 && "rotate-90")}
            />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-foreground">ผู้จัดการฝ่ายขาย</p>
              <p className="text-[11px] text-muted-foreground">ธนกร วงศ์สุข • ลูกทีม 8 คน</p>
            </div>
          </button>
          {expanded.org1 && (
            <p className="border-b border-border py-2.5 pl-14 pr-3.5 text-xs text-muted-foreground">
              สมชาย ใจดี, อรวรรณ ทองดี และอีก 6 คน
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded((p) => ({ ...p, org2: !p.org2 }))}
            className="flex w-full items-center gap-2.5 py-3.5 pl-8 pr-3.5 text-left active:bg-muted/50"
          >
            <ChevronRight
              className={cn("size-4 text-muted-foreground transition-transform", expanded.org2 && "rotate-90")}
            />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-foreground">ผู้จัดการฝ่ายปฏิบัติการ</p>
              <p className="text-[11px] text-muted-foreground">พิมพ์ชนก แสงทอง • ลูกทีม 12 คน</p>
            </div>
          </button>
          {expanded.org2 && (
            <p className="py-2.5 pl-14 pr-3.5 text-xs text-muted-foreground">
              วีระชัย ศรีสุข และอีก 11 คน
            </p>
          )}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

type RoleTab = "employee" | "manager" | "hr";

export function MobileAccessModule() {
  const [role, setRole] = useState<RoleTab>("manager");
  const [toggles, setToggles] = useState<Record<PermKey, boolean>>({
    approve: true,
    viewSalary: false,
    editPayroll: false,
    viewKpi: true,
  });
  const [confirming, setConfirming] = useState<PermKey | null>(null);

  const requestToggle = (key: PermKey) => {
    const def = PERM_DEFS.find((p) => p.key === key);
    if (def?.risky) setConfirming(key);
    else setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const confirmToggle = () => {
    if (confirming) {
      setToggles((prev) => ({ ...prev, [confirming]: !prev[confirming] }));
      setConfirming(null);
    }
  };

  const confirmLabel = PERM_DEFS.find((p) => p.key === confirming)?.label;

  return (
    <MobileScreen title="สิทธิ์การเข้าถึง" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <div className="mb-3.5 flex gap-1.5">
          {(
            [
              { value: "employee" as const, label: "พนักงาน" },
              { value: "manager" as const, label: "หัวหน้างาน" },
              { value: "hr" as const, label: "HR" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition active:scale-[0.99]",
                role === opt.value
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {confirming && (
          <div className="mb-3.5 rounded-[10px] border border-dev-note-border bg-dev-note p-3">
            <p className="mb-2.5 text-xs text-dev-note-foreground">
              ยืนยันเปลี่ยนสิทธิ์ &quot;{confirmLabel}&quot; — มีผลทันทีต่อสิทธิ์เข้าถึงข้อมูลของพนักงานคนนี้
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmToggle}
                className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        )}

        <MobileModuleCard className="divide-y divide-border p-0">
          {PERM_DEFS.map((perm) => (
            <div key={perm.key} className="flex items-center justify-between px-3.5 py-3.5">
              <span className="text-[13px] font-semibold text-foreground">{perm.label}</span>
              <MobileToggle checked={toggles[perm.key]} onChange={() => requestToggle(perm.key)} />
            </div>
          ))}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}

export function MobileApprovalsModule() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(APPROVAL_ITEMS_INIT);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = items.filter((i) => filter === "all" || i.typeKey === filter);

  const statusMeta = {
    pending: { label: "รออนุมัติ", tone: "primary" as const },
    approved: { label: "อนุมัติแล้ว", tone: "success" as const },
    rejected: { label: "ไม่อนุมัติ", tone: "danger" as const },
  };

  return (
    <MobileScreen title="อนุมัติเอกสาร" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <div className="-mx-1 mb-3.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {APPROVAL_FILTERS.map((f) => (
            <MobileFilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>

        {filtered.map((item) => {
          const meta = statusMeta[item.status];
          const isRejecting = rejectingId === item.id;
          return (
            <MobileModuleCard key={item.id} className="mb-2.5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-bold text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.type} • {item.detail}
                  </p>
                </div>
                <MobileStatusChip label={meta.label} tone={meta.tone} />
              </div>

              {item.status === "pending" && !isRejecting && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectingId(item.id)}
                    className="flex-1 rounded-lg border border-destructive/20 bg-destructive-muted py-2 text-xs font-bold text-destructive"
                  >
                    ไม่อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, status: "approved" } : i)),
                      )
                    }
                    className="flex-1 rounded-lg bg-success py-2 text-xs font-bold text-success-foreground"
                  >
                    อนุมัติ
                  </button>
                </div>
              )}

              {item.status === "pending" && isRejecting && (
                <div className="mt-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
                    className="mb-2 w-full rounded-lg border border-border px-2.5 py-2 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? {
                                  ...i,
                                  status: "rejected",
                                  reason: rejectReason || "ไม่ระบุเหตุผล",
                                }
                              : i,
                          ),
                        );
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className="flex-1 rounded-lg bg-destructive py-2 text-xs font-semibold text-destructive-foreground"
                    >
                      ยืนยันไม่อนุมัติ
                    </button>
                  </div>
                </div>
              )}

              {item.reason && (
                <p className="mt-1.5 text-[11px] text-destructive">เหตุผล: {item.reason}</p>
              )}
            </MobileModuleCard>
          );
        })}
      </div>
    </MobileScreen>
  );
}

type AttendanceTab = "today" | "monthly";

export function MobileAttendanceAllModule() {
  const [tab, setTab] = useState<AttendanceTab>("today");
  const [dept, setDept] = useState("ทั้งหมด");
  const maxLate = Math.max(...MONTHLY_LATE.map((m) => m.pct));

  return (
    <MobileScreen title="เข้างานทั้งบริษัท" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <div className="mb-3.5 flex gap-1.5">
          {(
            [
              { value: "today" as const, label: "วันนี้" },
              { value: "monthly" as const, label: "รายเดือน" },
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

        {tab === "today" && (
          <>
            <div className="mb-3.5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-success-muted p-3">
                <p className="text-xl font-bold text-success">142</p>
                <p className="text-[11px] text-muted-foreground">มาแล้ว</p>
              </div>
              <div className="rounded-xl bg-destructive-muted p-3">
                <p className="text-xl font-bold text-destructive">5</p>
                <p className="text-[11px] text-muted-foreground">ขาดงาน</p>
              </div>
              <div className="rounded-xl bg-accent p-3">
                <p className="text-xl font-bold text-primary">8</p>
                <p className="text-[11px] text-muted-foreground">มาสาย</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xl font-bold text-muted-foreground">3</p>
                <p className="text-[11px] text-muted-foreground">ลา</p>
              </div>
            </div>

            <div className="-mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {DEPT_FILTERS.map((label) => (
                <MobileFilterChip
                  key={label}
                  label={label}
                  active={dept === label}
                  onClick={() => setDept(label)}
                />
              ))}
            </div>

            <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">มาสายวันนี้</p>
            <MobileModuleCard className="divide-y divide-border p-0">
              {LATE_LIST.map((person) => (
                <div key={person.name} className="flex justify-between px-3.5 py-3 text-[13px]">
                  <div>
                    <p className="font-semibold text-foreground">{person.name}</p>
                    <p className="text-[11px] text-muted-foreground">{person.dept}</p>
                  </div>
                  <span className="font-bold text-destructive">สาย {person.minutes} นาที</span>
                </div>
              ))}
            </MobileModuleCard>
          </>
        )}

        {tab === "monthly" && (
          <MobileModuleCard>
            <p className="mb-3 text-xs font-semibold text-muted-foreground">อัตรามาสายรายเดือน (%)</p>
            <div className="flex h-20 items-end gap-2.5">
              {MONTHLY_LATE.map((m) => (
                <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${Math.round((m.pct / maxLate) * 100)}%` }}
                  />
                  <span className="mt-1 text-[10px] text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          </MobileModuleCard>
        )}
      </div>
    </MobileScreen>
  );
}

export function MobileOnsiteModule() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <MobileScreen title="สิทธิ์นอกสถานที่" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="mb-3.5 w-full rounded-[10px] bg-primary py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.99]"
        >
          + ให้สิทธิ์ใหม่
        </button>

        {formOpen && (
          <MobileModuleCard className="mb-3.5 space-y-2.5">
            <MobileSelectBox value="เลือกพนักงาน" className="text-muted-foreground" />
            <div className="grid grid-cols-2 gap-2">
              <MobileSelectBox value="วันเริ่ม" className="text-muted-foreground" />
              <MobileSelectBox value="วันสิ้นสุด" className="text-muted-foreground" />
            </div>
            <MobilePrimaryButton className="h-11">บันทึกสิทธิ์</MobilePrimaryButton>
          </MobileModuleCard>
        )}

        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">สิทธิ์ที่ให้ไว้</p>
        {ONSITE_GRANTS.map((grant) => (
          <MobileModuleCard key={grant.name} className="mb-2.5">
            <div className="mb-2 flex justify-between gap-2">
              <p className="text-[13px] font-bold text-foreground">{grant.name}</p>
              <MobileStatusChip label={grant.type} tone="primary" />
            </div>
            <p className="mb-2 text-xs text-muted-foreground">มีผล {grant.period}</p>
            <p className="text-xs text-foreground">
              เช็คอินไปแล้ว <b>{grant.used}</b> / {grant.requested} ครั้งที่ขอไว้
            </p>
          </MobileModuleCard>
        ))}
      </div>
    </MobileScreen>
  );
}

export function MobileLeaveAllModule() {
  return (
    <MobileScreen title="วันลาพนักงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">ลาสัปดาห์นี้ (4–10 ส.ค.)</p>
        <MobileModuleCard className="mb-3.5 divide-y divide-border p-0">
          <div className="flex justify-between px-3.5 py-3 text-[13px]">
            <span>สมชาย ใจดี (ขาย)</span>
            <span className="text-muted-foreground">พฤ–ศุกร์</span>
          </div>
          <div className="flex justify-between px-3.5 py-3 text-[13px]">
            <span>วีระชัย ศรีสุข (ปฏิบัติการ)</span>
            <span className="text-muted-foreground">จันทร์</span>
          </div>
        </MobileModuleCard>

        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">สรุปวันลาคงเหลือทั้งหมด</p>
        <MobileModuleCard className="overflow-hidden p-0">
          <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
            <span>พนักงาน</span>
            <span>ใช้ไป</span>
            <span>คงเหลือ</span>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-border px-3.5 py-3 text-[13px]">
            <span>สมชาย ใจดี</span>
            <span>5</span>
            <span className="font-semibold text-success">5</span>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr] px-3.5 py-3 text-[13px]">
            <span>อรวรรณ ทองดี</span>
            <span>2</span>
            <span className="font-semibold text-success">8</span>
          </div>
        </MobileModuleCard>

        <button
          type="button"
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card py-3 text-[13px] font-bold text-foreground active:scale-[0.99]"
        >
          <Download className="size-4" />
          ส่งออกตาราง
        </button>
      </div>
    </MobileScreen>
  );
}

export function MobilePayrollRunModule() {
  const [step, setStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const done = step >= PAYROLL_STEPS.length;
  const isLast = step === PAYROLL_STEPS.length - 1;

  const advance = () => {
    if (isLast) setConfirmOpen(true);
    else setStep((s) => s + 1);
  };

  const confirmPay = () => {
    setStep(PAYROLL_STEPS.length);
    setConfirmOpen(false);
  };

  return (
    <MobileScreen title="ประมวลผลเงินเดือน" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        devNote="ต้องเชื่อมระบบคำนวณเงินเดือนและ payment gateway จริงฝั่ง backend"
        footer={
          !done ? (
            <MobilePrimaryButton
              onClick={advance}
              className={isLast ? "bg-destructive shadow-destructive/20" : undefined}
            >
              {isLast ? "ยืนยันจ่ายเงินเดือน" : "ดำเนินการขั้นต่อไป"}
            </MobilePrimaryButton>
          ) : undefined
        }
      >
        {confirmOpen && (
          <MobileBlockedAlert>
            <b>ยืนยันจ่ายเงินเดือนจริง</b> — ขั้นตอนนี้ย้อนกลับไม่ได้ เงินจะถูกโอนเข้าบัญชีพนักงานทั้งหมด 158
            คน ยอดรวม 4,820,000 บาท
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmPay}
                className="flex-1 rounded-lg bg-destructive py-2 text-xs font-bold text-destructive-foreground"
              >
                ยืนยันจ่ายเงิน
              </button>
            </div>
          </MobileBlockedAlert>
        )}

        {done ? (
          <div className="rounded-xl bg-card p-6 text-center">
            <div className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-full bg-success-muted">
              <Check className="size-7 text-success" />
            </div>
            <p className="text-base font-bold text-foreground">จ่ายเงินเดือนสำเร็จ</p>
            <p className="mt-1 text-sm text-muted-foreground">รอบเดือนสิงหาคม 2569 • 158 คน</p>
          </div>
        ) : (
          <MobileModuleCard className="divide-y divide-border p-0">
            {PAYROLL_STEPS.map((label, i) => {
              const completed = i < step;
              const current = i === step;
              return (
                <div key={label} className="flex items-center gap-2.5 px-3.5 py-3.5">
                  {completed ? (
                    <Check className="size-5 text-success" />
                  ) : current ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <span className="size-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className="text-[13px] font-semibold text-foreground">{label}</span>
                </div>
              );
            })}
          </MobileModuleCard>
        )}
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileKpiOrgModule() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <MobileScreen title="KPI องค์กร" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="space-y-2.5 p-3.5">
        {DEPT_RANK.map((dept) => {
          const tone = deptRankTone(dept.pct);
          const isOpen = expanded[dept.id];
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => setExpanded((p) => ({ ...p, [dept.id]: !p[dept.id] }))}
              className="w-full rounded-xl bg-card p-4 text-left active:scale-[0.99]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">{dept.name}</span>
                <span
                  className={cn(
                    "text-sm font-bold",
                    tone === "success" && "text-success",
                    tone === "primary" && "text-primary",
                    tone === "danger" && "text-destructive",
                  )}
                >
                  {dept.pct}%
                </span>
              </div>
              <MobileProgressBar value={dept.pct} tone={tone} />
              {isOpen && (
                <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
                  เฉลี่ยจากพนักงาน 4 ตัวชี้วัดหลักของแผนก อัปเดตทุกสิ้นเดือน
                </p>
              )}
            </button>
          );
        })}
      </div>
    </MobileScreen>
  );
}

type ExportStep = "form" | "preview" | "done";

export function MobileExportModule() {
  const [step, setStep] = useState<ExportStep>("form");
  const [exportType, setExportType] = useState("attendance");
  const [format, setFormat] = useState("excel");

  return (
    <MobileScreen title="ส่งออกรายงาน" backHref="/services" contentClassName="flex flex-col p-0">
      <MobileModuleLayout
        footer={
          step === "form" ? (
            <MobilePrimaryButton onClick={() => setStep("preview")}>ดูตัวอย่าง</MobilePrimaryButton>
          ) : step === "preview" ? (
            <MobilePrimaryButton onClick={() => setStep("done")}>ส่งออกไฟล์</MobilePrimaryButton>
          ) : undefined
        }
      >
        {step === "done" && (
          <div className="rounded-xl bg-card p-6 text-center">
            <div className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-full bg-success-muted">
              <Check className="size-7 text-success" />
            </div>
            <p className="text-base font-bold text-foreground">ส่งออกไฟล์สำเร็จ</p>
            <p className="my-1 text-sm text-muted-foreground">attendance_report_ส.ค.2569.xlsx</p>
            <MobilePrimaryButton className="mt-4" onClick={() => setStep("form")}>
              สร้างรายงานใหม่
            </MobilePrimaryButton>
          </div>
        )}

        {step === "preview" && (
          <MobileModuleCard>
            <p className="mb-2.5 text-xs font-semibold text-muted-foreground">ตัวอย่างข้อมูล</p>
            <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-border py-2 text-[11px] text-muted-foreground">
              <span>พนักงาน</span>
              <span>มา</span>
              <span>สาย</span>
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-border py-2.5 text-xs">
              <span>สมชาย ใจดี</span>
              <span>22</span>
              <span>1</span>
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr] py-2.5 text-xs">
              <span>อรวรรณ ทองดี</span>
              <span>23</span>
              <span>0</span>
            </div>
          </MobileModuleCard>
        )}

        {step === "form" && (
          <MobileModuleCard>
            <MobileFieldLabel>ประเภทรายงาน</MobileFieldLabel>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {EXPORT_TYPES.map((t) => (
                <MobileFilterChip
                  key={t.key}
                  label={t.label}
                  active={exportType === t.key}
                  onClick={() => setExportType(t.key)}
                />
              ))}
            </div>

            <MobileFieldLabel>ช่วงเวลา</MobileFieldLabel>
            <MobileSelectBox value="1 – 31 ส.ค. 2569" className="mb-4" />

            <MobileFieldLabel>ฟอร์แมต</MobileFieldLabel>
            <div className="flex gap-1.5">
              {[
                { key: "excel", label: "Excel" },
                { key: "pdf", label: "PDF" },
              ].map((f) => (
                <MobileFilterChip
                  key={f.key}
                  label={f.label}
                  active={format === f.key}
                  onClick={() => setFormat(f.key)}
                />
              ))}
            </div>
          </MobileModuleCard>
        )}
      </MobileModuleLayout>
    </MobileScreen>
  );
}

export function MobileOrgSettingsModule() {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <MobileScreen title="ตั้งค่าองค์กร" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="space-y-2.5 p-3.5">
        {SETTINGS_ROWS.map((row) => {
          const isEditing = editing === row.key;
          const isConfirming = confirming === row.key;
          return (
            <MobileModuleCard key={row.key}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{row.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.value}</p>
                </div>
                <button type="button" onClick={() => setEditing(row.key)} aria-label="แก้ไข">
                  <Pencil className="size-[18px] text-primary" />
                </button>
              </div>

              {isEditing && (
                <div className="mt-3 border-t border-border pt-3">
                  <MobileSelectBox value={row.value} className="mb-2.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(row.key);
                      setEditing(null);
                    }}
                    className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              )}

              {isConfirming && (
                <div className="mt-2.5 rounded-[10px] border border-dev-note-border bg-dev-note p-3">
                  <p className="mb-2.5 text-xs text-dev-note-foreground">
                    การเปลี่ยนแปลงนี้มีผลทันทีกับพนักงานทั้งบริษัท ยืนยันหรือไม่?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground"
                    >
                      ยืนยัน
                    </button>
                  </div>
                </div>
              )}
            </MobileModuleCard>
          );
        })}
      </div>
    </MobileScreen>
  );
}
