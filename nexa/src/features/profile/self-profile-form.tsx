"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Save,
  Loader2,
  User as UserIcon,
  Phone,
  MapPin,
  Landmark,
  ShieldAlert,
  Lock,
  MessageCircle,
  RefreshCcw,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { getInitials, fullName } from "@/lib/format";
import { fileToSquareDataUrl } from "@/lib/image";
import { selfProfileSchema, type SelfProfileInput } from "./schema";
import { useGenerateLineLinkCode, useMyProfile, useUnlinkLine, useUpdateMyProfile } from "./hooks";
import type { MyProfile } from "./types";

type FormState = Record<string, string>;

const GENDERS = [
  { v: "", label: "— ไม่ระบุ —" },
  { v: "MALE", label: "ชาย" },
  { v: "FEMALE", label: "หญิง" },
  { v: "OTHER", label: "อื่นๆ" },
];
const MARITAL = [
  { v: "", label: "— ไม่ระบุ —" },
  { v: "SINGLE", label: "โสด" },
  { v: "MARRIED", label: "สมรส" },
  { v: "DIVORCED", label: "หย่า" },
  { v: "WIDOWED", label: "หม้าย" },
];
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ทำงานอยู่",
  PROBATION: "ทดลองงาน",
  SUSPENDED: "พักงาน",
  TERMINATED: "พ้นสภาพ",
};

function toFormState(p: MyProfile): FormState {
  const s: FormState = {};
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === "object") continue; // nested read-only objects handled separately
    s[k] = v == null ? "" : String(v);
  }
  s.dateOfBirth = p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "";
  return s;
}

export function SelfProfileForm() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyProfile();
  const updateMut = useUpdateMyProfile();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const avatarRef = useRef<HTMLInputElement>(null);

  const profile = data?.data;
  useEffect(() => {
    if (profile && !form) setForm(toFormState(profile));
  }, [profile, form]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !form || !profile) return <TableLoadingState rows={8} />;

  const set = (k: string, v: string) => setForm((f) => ({ ...(f as FormState), [k]: v }));

  async function onPickAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    try {
      const dataUrl = await fileToSquareDataUrl(file, 256);
      if (dataUrl.length > 3_000_000) return toast.error("รูปใหญ่เกินไป");
      set("avatarUrl", dataUrl);
      toast.success("อัปเดตรูปแล้ว กด บันทึก เพื่อยืนยัน");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErrors({});
    const parsed = selfProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error("กรุณาตรวจสอบข้อมูลที่กรอก");
      return;
    }
    try {
      const res = await updateMut.mutateAsync(parsed.data as SelfProfileInput);
      setForm(toFormState(res.data));
      toast.success("บันทึกโปรไฟล์เรียบร้อย");
      router.refresh(); // refresh server shell so the topbar avatar updates
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const name = fullName(form.firstName, form.lastName) || profile.employeeCode;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Header + avatar */}
      <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
        <div className="pointer-events-none absolute -top-16 -right-10 size-60 rounded-full bg-primary/25 blur-[90px]" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar className="size-20 ring-2 ring-white/15">
              {form.avatarUrl && <AvatarImage src={form.avatarUrl} alt={name} />}
              <AvatarFallback className="bg-white/10 text-xl text-white">
                {getInitials(form.firstName, form.lastName)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-sidebar transition hover:opacity-90"
              aria-label="เปลี่ยนรูปโปรไฟล์"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="truncate text-xl font-semibold">{name}</p>
            <p className="text-sm text-slate-300">
              {profile.position?.title ?? "-"}
              {profile.department ? ` · ${profile.department.name}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">รหัสพนักงาน {profile.employeeCode}</p>
          </div>
        </div>
      </Card>

      {/* Basic identity */}
      <Section icon={UserIcon} title="ข้อมูลส่วนตัว" desc="ชื่อ ชื่อเล่น และข้อมูลพื้นฐาน">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อ" required error={errors.firstName}>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="นามสกุล" error={errors.lastName}>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label="ชื่อเล่น" error={errors.nickname}>
            <Input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
          </Field>
          <Field label="เพศ">
            <NativeSelect value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} />
          </Field>
          <Field label="วันเกิด" error={errors.dateOfBirth}>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="สถานภาพสมรส">
            <NativeSelect value={form.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={MARITAL} />
          </Field>
          <Field label="เลขบัตรประชาชน" error={errors.nationalId}>
            <Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} inputMode="numeric" maxLength={13} />
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section icon={Phone} title="ช่องทางติดต่อ" desc="โทรศัพท์และอีเมลส่วนตัว">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="โทรศัพท์" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="อีเมล" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section icon={MapPin} title="ที่อยู่" desc="ที่อยู่ปัจจุบัน">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="ที่อยู่ (บ้านเลขที่ ถนน)" error={errors.addressLine}>
              <Textarea rows={2} value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            </Field>
          </div>
          <Field label="แขวง/ตำบล"><Input value={form.subDistrict} onChange={(e) => set("subDistrict", e.target.value)} /></Field>
          <Field label="เขต/อำเภอ"><Input value={form.district} onChange={(e) => set("district", e.target.value)} /></Field>
          <Field label="จังหวัด"><Input value={form.province} onChange={(e) => set("province", e.target.value)} /></Field>
          <Field label="รหัสไปรษณีย์"><Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} inputMode="numeric" maxLength={5} /></Field>
        </div>
      </Section>

      {/* Bank */}
      <Section icon={Landmark} title="บัญชีรับเงินเดือน" desc="ใช้สำหรับการจ่ายเงินเดือน">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ธนาคาร"><Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
          <Field label="เลขที่บัญชี"><Input value={form.bankAccountNo} onChange={(e) => set("bankAccountNo", e.target.value)} inputMode="numeric" /></Field>
          <Field label="สาขา"><Input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} /></Field>
        </div>
      </Section>

      {/* Emergency */}
      <Section icon={ShieldAlert} title="ผู้ติดต่อกรณีฉุกเฉิน" desc="บุคคลที่ติดต่อได้เมื่อจำเป็น">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ชื่อผู้ติดต่อ"><Input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></Field>
          <Field label="เบอร์โทร"><Input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} /></Field>
          <Field label="ความสัมพันธ์"><Input value={form.emergencyContactRelation} onChange={(e) => set("emergencyContactRelation", e.target.value)} /></Field>
        </div>
      </Section>

      {/* Notification channels */}
      <Section icon={MessageCircle} title="การแจ้งเตือนทาง LINE" desc="รับแจ้งเตือนจากระบบผ่าน LINE เพิ่มเติมจากในแอป">
        <LineConnect profile={profile} onChange={() => refetch()} />
      </Section>

      {/* Read-only HR-controlled */}
      <Section icon={Lock} title="ข้อมูลการจ้างงาน" desc="ดูแลโดยฝ่ายบุคคล — แก้ไขไม่ได้">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnly label="รหัสพนักงาน" value={profile.employeeCode} />
          <ReadOnly label="ฝ่าย/แผนก" value={profile.department?.name ?? "-"} />
          <ReadOnly label="ตำแหน่ง" value={profile.position?.title ?? "-"} />
          <ReadOnly label="สาขา" value={profile.branch?.name ?? "-"} />
          <ReadOnly label="สถานะ" value={STATUS_LABEL[profile.status] ?? profile.status} />
          <ReadOnly label="วันเริ่มงาน" value={profile.hireDate ? profile.hireDate.slice(0, 10) : "-"} />
        </div>
      </Section>

      {/* md:pr-24 clears the floating AI launcher (fixed bottom-6 right-6 size-14, z-40) */}
      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4 md:pr-24">
        <div className="rounded-2xl border border-border bg-background/90 p-2 shadow-lg backdrop-blur">
          <Button type="submit" disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            บันทึกโปรไฟล์
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Icon className="size-4 text-primary-foreground" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function LineConnect({ profile, onChange }: { profile: MyProfile; onChange: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const generateMut = useGenerateLineLinkCode();
  const unlinkMut = useUnlinkLine();

  const linked = !!profile.lineUserId;

  async function generate() {
    try {
      const res = await generateMut.mutateAsync();
      setCode(res.data.code);
      setExpiresAt(res.data.expiresAt);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรหัสไม่สำเร็จ");
    }
  }

  async function unlink() {
    try {
      await unlinkMut.mutateAsync();
      setCode(null);
      toast.success("ยกเลิกการเชื่อมต่อ LINE แล้ว");
      onChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  if (linked) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-success-muted px-3 py-2.5">
        <p className="text-sm text-foreground">เชื่อมต่อ LINE แล้ว — คุณจะได้รับการแจ้งเตือนทาง LINE ด้วย</p>
        <Button type="button" variant="outline" size="sm" onClick={unlink} disabled={unlinkMut.isPending}>
          {unlinkMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
          ยกเลิกการเชื่อมต่อ
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {code ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">
            เพิ่มเพื่อน LINE OA ของบริษัท แล้วส่งรหัสนี้เป็นข้อความ:
          </p>
          <p className="text-center font-mono text-2xl font-bold tracking-widest text-accent-foreground">{code}</p>
          <p className="text-center text-xs text-muted-foreground">
            หมดอายุ {expiresAt ? new Date(expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""} น.
          </p>
          <div className="flex justify-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={generateMut.isPending}>
              <RefreshCcw className="size-3.5" /> สร้างรหัสใหม่
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={generate} disabled={generateMut.isPending}>
          {generateMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          เชื่อมต่อ LINE
        </Button>
      )}
    </div>
  );
}
