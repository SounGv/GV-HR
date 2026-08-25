"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Upload, X, Save, Loader2, Palette, MapPin, Phone, Globe2, ClockAlert, CalendarRange, HeartPulse } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { companyProfileSchema, type CompanyProfileInput } from "./schema";
import { useCompanyProfile, useUpdateCompany } from "./hooks";
import type { CompanyProfile } from "./types";

type FormState = Record<string, string>;

const TIMEZONES = ["Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "UTC"];
const CURRENCIES = ["THB", "USD", "EUR", "JPY", "CNY", "SGD"];
const LANGUAGES = [
  { v: "th", label: "ไทย" },
  { v: "en", label: "English" },
];

/** Read an image file, downscale it, and return a compact data URL. */
function fileToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์รูปไม่ถูกต้อง"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ไม่รองรับการประมวลผลรูป"));
        ctx.drawImage(img, 0, 0, w, h);
        // PNG keeps transparency for logos.
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function toFormState(p: CompanyProfile): FormState {
  const s: FormState = {};
  for (const [k, v] of Object.entries(p)) s[k] = v == null ? "" : String(v);
  return s;
}

export function CompanyProfileForm() {
  const { can } = useAuth();
  const canEdit = can("admin:update");
  const { data, isLoading, isError, refetch } = useCompanyProfile();
  const updateMut = useUpdateCompany();

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.data && !form) setForm(toFormState(data.data));
  }, [data, form]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !form) return <TableLoadingState rows={8} />;

  const set = (k: string, v: string) => setForm((f) => ({ ...(f as FormState), [k]: v }));

  async function onPickImage(field: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    try {
      const maxSize = field === "faviconUrl" ? 128 : 512;
      const dataUrl = await fileToDataUrl(file, maxSize);
      if (dataUrl.length > 3_000_000) {
        toast.error("ไฟล์ใหญ่เกินไป กรุณาใช้รูปที่เล็กลง");
        return;
      }
      set(field, dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !form) return;
    setErrors({});
    const parsed = companyProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("กรุณาตรวจสอบข้อมูลที่กรอก");
      return;
    }
    try {
      const res = await updateMut.mutateAsync(parsed.data as CompanyProfileInput);
      setForm(toFormState(res.data));
      toast.success("บันทึกข้อมูลบริษัทเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Branding */}
      <Section icon={Palette} title="โลโก้และแบรนด์" desc="ใช้ทั่วทั้งระบบ สลิป รายงาน และอีเมล">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ImageField label="โลโก้ (พื้นสว่าง)" value={form.logoUrl} onPick={(f) => onPickImage("logoUrl", f)} onClear={() => set("logoUrl", "")} disabled={!canEdit} />
          <ImageField label="โลโก้ (พื้นมืด)" dark value={form.logoDarkUrl} onPick={(f) => onPickImage("logoDarkUrl", f)} onClear={() => set("logoDarkUrl", "")} disabled={!canEdit} />
          <ImageField label="Favicon" value={form.faviconUrl} onPick={(f) => onPickImage("faviconUrl", f)} onClear={() => set("faviconUrl", "")} disabled={!canEdit} />
          <ImageField label="ลายเซ็นผู้มีอำนาจ" value={form.signatureUrl} onPick={(f) => onPickImage("signatureUrl", f)} onClear={() => set("signatureUrl", "")} disabled={!canEdit} />
          <ImageField label="ตราประทับบริษัท" value={form.stampUrl} onPick={(f) => onPickImage("stampUrl", f)} onClear={() => set("stampUrl", "")} disabled={!canEdit} />
          <Field label="สีแบรนด์ (HEX)" error={errors.brandColor}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.brandColor) ? form.brandColor : "#2563EB"}
                onChange={(e) => set("brandColor", e.target.value.toUpperCase())}
                disabled={!canEdit}
                className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:opacity-50"
                aria-label="เลือกสีแบรนด์"
              />
              <Input value={form.brandColor} onChange={(e) => set("brandColor", e.target.value)} placeholder="#2563EB" disabled={!canEdit} />
            </div>
          </Field>
        </div>
      </Section>

      {/* Company info */}
      <Section icon={Building2} title="ข้อมูลบริษัท" desc="ชื่อและเลขทะเบียน">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อบริษัท" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="ชื่อจดทะเบียน (ตามกฎหมาย)" error={errors.legalName}>
            <Input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" error={errors.taxId}>
            <Input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} inputMode="numeric" maxLength={13} disabled={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section icon={Phone} title="ช่องทางติดต่อ" desc="โทรศัพท์ อีเมล เว็บไซต์">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="โทรศัพท์" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="อีเมล" error={errors.email}>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" disabled={!canEdit} />
          </Field>
          <Field label="เว็บไซต์" error={errors.website}>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" disabled={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section icon={MapPin} title="ที่อยู่" desc="ที่อยู่สำนักงานใหญ่และแผนที่">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="ที่อยู่ (บ้านเลขที่ ถนน)" error={errors.addressLine}>
              <Textarea value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} rows={2} disabled={!canEdit} />
            </Field>
          </div>
          <Field label="แขวง/ตำบล" error={errors.subDistrict}>
            <Input value={form.subDistrict} onChange={(e) => set("subDistrict", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="เขต/อำเภอ" error={errors.district}>
            <Input value={form.district} onChange={(e) => set("district", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="จังหวัด" error={errors.province}>
            <Input value={form.province} onChange={(e) => set("province", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="รหัสไปรษณีย์" error={errors.postalCode}>
            <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} inputMode="numeric" maxLength={5} disabled={!canEdit} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ลิงก์ Google Maps" error={errors.googleMapsUrl}>
              <Input value={form.googleMapsUrl} onChange={(e) => set("googleMapsUrl", e.target.value)} placeholder="https://maps.google.com/..." disabled={!canEdit} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Locale */}
      <Section icon={Globe2} title="ภูมิภาคและสกุลเงิน" desc="เขตเวลา สกุลเงิน ภาษา">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="เขตเวลา">
            <NativeSelect value={form.timezone} onChange={(v) => set("timezone", v)} disabled={!canEdit} options={TIMEZONES.map((t) => ({ v: t, label: t }))} />
          </Field>
          <Field label="สกุลเงิน">
            <NativeSelect value={form.currency} onChange={(v) => set("currency", v)} disabled={!canEdit} options={CURRENCIES.map((c) => ({ v: c, label: c }))} />
          </Field>
          <Field label="ภาษาหลัก">
            <NativeSelect value={form.language} onChange={(v) => set("language", v)} disabled={!canEdit} options={LANGUAGES} />
          </Field>
        </div>
      </Section>

      {/* Attendance-to-payroll deduction policy */}
      <Section
        icon={ClockAlert}
        title="หักเงินจากขาด/มาสาย"
        desc="ใช้ตอนออกรอบเงินเดือน — ปิดอยู่โดยค่าเริ่มต้น ไม่กระทบเงินเดือนใครจนกว่าจะเปิดใช้งาน"
      >
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">เปิดใช้งานการหักเงินอัตโนมัติ</p>
            <p className="text-xs text-muted-foreground">
              ขาดงาน (ไม่ลงเวลาและไม่มีใบลาอนุมัติในวันทำงาน) หักเท่าอัตราลาไม่รับค่าจ้าง — มาสายหักตามจำนวนครั้ง × อัตราด้านล่าง
              — ใช้กับพนักงานรายเดือนเท่านั้น
            </p>
          </div>
          <Switch
            checked={form.attendanceDeductionEnabled === "true"}
            onCheckedChange={(v) => set("attendanceDeductionEnabled", String(v))}
            disabled={!canEdit}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="หักเงินต่อการมาสาย 1 ครั้ง (บาท)" error={errors.lateDeductionPerOccurrence}>
            <Input
              type="number"
              min={0}
              value={form.lateDeductionPerOccurrence}
              onChange={(e) => set("lateDeductionPerOccurrence", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      {/* Leave quota policy */}
      <Section
        icon={CalendarRange}
        title="โควตาวันลาต่อปี"
        desc="ค่าเริ่มต้นที่ใช้กับพนักงานทุกคน — เปลี่ยนแล้วมีผลกับปีถัดไปหรือคนที่ยังไม่เคยลาประเภทนั้นในปีนี้ ไม่กระทบสิทธิ์ที่พนักงานใช้ไปแล้ว"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ลาพักร้อน (วัน/ปี)" error={errors.leaveQuotaAnnualDays}>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.leaveQuotaAnnualDays}
              onChange={(e) => set("leaveQuotaAnnualDays", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="ลาป่วย (วัน/ปี)" error={errors.leaveQuotaSickDays}>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.leaveQuotaSickDays}
              onChange={(e) => set("leaveQuotaSickDays", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="ลากิจ (วัน/ปี)" error={errors.leaveQuotaPersonalDays}>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.leaveQuotaPersonalDays}
              onChange={(e) => set("leaveQuotaPersonalDays", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          โควตาลาเป็นชั่วโมง (แยกจากโควตาวันด้านบน — ใส่ 0 = ไม่เปิดให้ลาเป็นชั่วโมงสำหรับประเภทนั้น)
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <Field label="ลาป่วย (ชม./ปี)" error={errors.leaveQuotaSickHours}>
            <Input
              type="number"
              min={0}
              max={999}
              value={form.leaveQuotaSickHours}
              onChange={(e) => set("leaveQuotaSickHours", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="ลากิจ (ชม./ปี)" error={errors.leaveQuotaPersonalHours}>
            <Input
              type="number"
              min={0}
              max={999}
              value={form.leaveQuotaPersonalHours}
              onChange={(e) => set("leaveQuotaPersonalHours", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      {/* Benefits — expense claims tied to a cap/eligibility rule (see expense/service.ts) */}
      <Section
        icon={HeartPulse}
        title="สวัสดิการพนักงาน"
        desc="วงเงินเบิกค่ารักษาพยาบาล — เฉพาะพนักงานที่ผ่านทดลองงานและทำงานครบ 1 ปีแล้ว นับใหม่ทุกปีตามวันที่ในรายการเบิก"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ค่ารักษาพยาบาล (บาท/ปี)" error={errors.medicalExpenseCapAmount}>
            <Input
              type="number"
              min={0}
              max={1_000_000}
              value={form.medicalExpenseCapAmount}
              onChange={(e) => set("medicalExpenseCapAmount", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      {/* Sticky save bar — md:pr-24 clears the floating AI launcher
          (FloatingAiLauncher, fixed bottom-6 right-6 size-14, z-40),
          same fix as FormFooter's. */}
      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4 md:pr-24">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/90 p-2 shadow-lg backdrop-blur">
          {!canEdit && <span className="px-2 text-xs text-muted-foreground">คุณไม่มีสิทธิ์แก้ไข</span>}
          <Button type="submit" disabled={!canEdit || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            บันทึกข้อมูลบริษัท
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
  icon: typeof Building2;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ImageField({
  label,
  value,
  onPick,
  onClear,
  disabled,
  dark,
}: {
  label: string;
  value: string;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex h-24 items-center justify-center rounded-lg border border-dashed border-border p-2",
          dark ? "bg-slate-900" : "bg-muted/40",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={cn("text-xs", dark ? "text-slate-400" : "text-muted-foreground")}>
            ยังไม่มีรูป
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" /> อัปโหลด
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
            <X className="size-3.5" /> ลบ
          </Button>
        )}
      </div>
    </div>
  );
}
