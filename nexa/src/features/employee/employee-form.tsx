"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/format";
import { fileToSquareDataUrl } from "@/lib/image";
import {
  COMPENSATION_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL,
} from "./schema";
import { COMPENSATION_LABEL, EMPLOYMENT_LABEL, GENDER_LABEL, MARITAL_LABEL, STATUS_LABEL } from "./labels";
import type { EmployeeFormValues, OrgOptions } from "./types";

const NONE = "__none__";

const formSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณากรอกรหัสพนักงาน"),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  nickname: z.string().trim().optional(),
  avatarUrl: z.string().optional(),
  email: z.union([z.string().email("อีเมลไม่ถูกต้อง"), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().trim().optional(),
  maritalStatus: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(EMPLOYEE_STATUSES),
  hireDate: z.string().optional(),
  probationEndDate: z.string().optional(),
  terminationDate: z.string().optional(),
  compensationType: z.enum(COMPENSATION_TYPES),
  baseSalary: z.string().optional(),
  dailyRate: z.string().optional(),
  hourlyRate: z.string().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNo: z.string().trim().optional(),
  taxSpouseNoIncome: z.boolean().optional(),
  taxChildrenStandard: z.string().optional(),
  taxChildrenEnhanced: z.string().optional(),
  taxParentCareCount: z.string().optional(),
  taxLifeInsurance: z.string().optional(),
  taxHealthInsurance: z.string().optional(),
  addressLine: z.string().trim().optional(),
  district: z.string().trim().optional(),
  province: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

const EMPTY: FormSchema = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  compensationType: "MONTHLY",
};

export function EmployeeForm({
  formId,
  defaultValues,
  orgOptions,
  onSubmit,
}: {
  formId: string;
  defaultValues?: Partial<EmployeeFormValues>;
  orgOptions?: OrgOptions;
  onSubmit: (values: EmployeeFormValues) => void;
}) {
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });
  const avatarRef = useRef<HTMLInputElement>(null);
  const avatarUrl = form.watch("avatarUrl");
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const compensationType = form.watch("compensationType");

  // New employee: prefill the suggested next "EMP0001"-style code once it
  // loads — editing an existing employee never overwrites their real code.
  useEffect(() => {
    if (!defaultValues?.employeeCode && orgOptions?.nextEmployeeCode && !form.getValues("employeeCode")) {
      form.setValue("employeeCode", orgOptions.nextEmployeeCode);
    }
  }, [defaultValues?.employeeCode, orgOptions?.nextEmployeeCode, form]);

  async function onPickAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    try {
      const dataUrl = await fileToSquareDataUrl(file, 256);
      if (dataUrl.length > 3_000_000) return toast.error("รูปใหญ่เกินไป");
      form.setValue("avatarUrl", dataUrl, { shouldDirty: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    }
  }

  function submit(values: FormSchema) {
    // Strip the "none" sentinel back to undefined before sending.
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === NONE ? undefined : v]),
    ) as unknown as EmployeeFormValues;
    onSubmit(cleaned);
  }

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(submit)}>
        <Tabs defaultValue="personal" className="gap-6">
          <div className="overflow-x-auto">
            <TabsList variant="line" className="h-auto flex-nowrap">
              <TabsTrigger value="personal">ข้อมูลส่วนตัว</TabsTrigger>
              <TabsTrigger value="employment">การจ้างงาน</TabsTrigger>
              <TabsTrigger value="payroll">เงินเดือน &amp; บัญชี</TabsTrigger>
              <TabsTrigger value="tax">ลดหย่อนภาษี</TabsTrigger>
              <TabsTrigger value="address">ที่อยู่</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="personal" keepMounted>
            <div className="mb-4 flex items-center gap-4">
              <div className="relative">
                <Avatar className="size-16">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-primary/10 text-base text-primary">
                    {getInitials(firstName, lastName)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-card transition hover:opacity-90"
                  aria-label="เปลี่ยนรูปพนักงาน"
                >
                  <Camera className="size-3.5" />
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
              <p className="text-sm text-muted-foreground">รูปพนักงาน — คลิกไอคอนกล้องเพื่อเปลี่ยน</p>
            </div>
            <FieldGrid>
              <TextField form={form} name="employeeCode" label="รหัสพนักงาน *" />
              <TextField form={form} name="nickname" label="ชื่อเล่น" />
              <TextField form={form} name="firstName" label="ชื่อ *" />
              <TextField form={form} name="lastName" label="นามสกุล *" />
              <TextField form={form} name="firstNameEn" label="ชื่อ (EN)" />
              <TextField form={form} name="lastNameEn" label="นามสกุล (EN)" />
              <SelectField form={form} name="gender" label="เพศ" placeholder="เลือกเพศ"
                options={GENDERS.map((g) => ({ value: g, label: GENDER_LABEL[g] }))} clearable />
              <SelectField form={form} name="maritalStatus" label="สถานภาพ" placeholder="เลือกสถานภาพ"
                options={MARITAL.map((m) => ({ value: m, label: MARITAL_LABEL[m] }))} clearable />
              <DateField form={form} name="dateOfBirth" label="วันเกิด" />
              <TextField form={form} name="nationalId" label="เลขบัตรประชาชน" />
              <TextField form={form} name="email" label="อีเมล" type="email" />
              <TextField form={form} name="phone" label="เบอร์โทร" />
            </FieldGrid>
          </TabsContent>

          <TabsContent value="employment" keepMounted>
            <FieldGrid>
              <SelectField form={form} name="branchId" label="สาขา" placeholder="เลือกสาขา" clearable
                options={(orgOptions?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
              <SelectField form={form} name="departmentId" label="แผนก" placeholder="เลือกแผนก" clearable
                options={(orgOptions?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
              <SelectField form={form} name="positionId" label="ตำแหน่ง" placeholder="เลือกตำแหน่ง" clearable
                options={(orgOptions?.positions ?? []).map((p) => ({ value: p.id, label: p.title }))} />
              <SelectField form={form} name="managerId" label="หัวหน้างาน" placeholder="เลือกหัวหน้างาน" clearable
                options={(orgOptions?.managers ?? []).map((m) => ({
                  value: m.id,
                  label: `${m.firstName} ${m.lastName} (${m.employeeCode})`,
                }))} />
              <SelectField form={form} name="employmentType" label="ประเภทการจ้าง"
                options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_LABEL[t] }))} />
              <SelectField form={form} name="status" label="สถานะ"
                options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
              <DateField form={form} name="hireDate" label="วันเริ่มงาน" />
              <DateField form={form} name="probationEndDate" label="สิ้นสุดทดลองงาน" />
            </FieldGrid>
          </TabsContent>

          <TabsContent value="payroll" keepMounted>
            <FieldGrid>
              <SelectField form={form} name="compensationType" label="ประเภทค่าจ้าง"
                options={COMPENSATION_TYPES.map((t) => ({ value: t, label: COMPENSATION_LABEL[t] }))} />
              {compensationType === "DAILY" ? (
                <TextField form={form} name="dailyRate" label="ค่าจ้างต่อวัน (บาท)" type="number" />
              ) : compensationType === "HOURLY" ? (
                <TextField form={form} name="hourlyRate" label="ค่าจ้างต่อชั่วโมง (บาท)" type="number" />
              ) : (
                <TextField form={form} name="baseSalary" label="เงินเดือนพื้นฐาน (บาท)" type="number" />
              )}
              <TextField form={form} name="bankName" label="ธนาคาร" />
              <TextField form={form} name="bankAccountNo" label="เลขที่บัญชี" />
            </FieldGrid>
          </TabsContent>

          <TabsContent value="tax" keepMounted>
            <p className="mb-4 text-sm text-muted-foreground">
              ใช้คำนวณภาษีหัก ณ ที่จ่ายรายเดือนให้ตรงกับสถานการณ์จริงของพนักงานแต่ละคน — ไม่กรอกจะถือว่าไม่มีค่าลดหย่อนส่วนนี้
            </p>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">คู่สมรสไม่มีเงินได้</p>
                <p className="text-xs text-muted-foreground">ลดหย่อน 60,000 บาท/ปี</p>
              </div>
              <FormField
                control={form.control}
                name="taxSpouseNoIncome"
                render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <FieldGrid>
              <TextField form={form} name="taxChildrenStandard" label="จำนวนบุตร (ลดหย่อนคนละ 30,000)" type="number" />
              <TextField form={form} name="taxChildrenEnhanced" label="บุตรคนที่ 2+ เกิดปี 2561 ขึ้นไป (คนละ 60,000)" type="number" />
              <TextField form={form} name="taxParentCareCount" label="อุปการะบิดามารดา (คนละ 30,000, สูงสุด 4 คน)" type="number" />
              <TextField form={form} name="taxLifeInsurance" label="เบี้ยประกันชีวิต/ปี (บาท)" type="number" />
              <TextField form={form} name="taxHealthInsurance" label="เบี้ยประกันสุขภาพ/ปี (บาท)" type="number" />
            </FieldGrid>
          </TabsContent>

          <TabsContent value="address" keepMounted>
            <FieldGrid>
              <TextField form={form} name="addressLine" label="ที่อยู่" className="sm:col-span-2" />
              <TextField form={form} name="district" label="อำเภอ/เขต" />
              <TextField form={form} name="province" label="จังหวัด" />
              <TextField form={form} name="postalCode" label="รหัสไปรษณีย์" />
            </FieldGrid>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}

/* ── Layout + field helpers ─────────────────────────────────── */

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = ReturnType<typeof useForm<any>>;

function TextField({
  form,
  name,
  label,
  type = "text",
  className,
}: {
  form: AnyForm;
  name: keyof FormSchema;
  label: string;
  type?: string;
  className?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DateField({
  form,
  name,
  label,
}: {
  form: AnyForm;
  name: keyof FormSchema;
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField({
  form,
  name,
  label,
  options,
  placeholder,
  clearable,
}: {
  form: AnyForm;
  name: keyof FormSchema;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value || ""}
            onValueChange={field.onChange}
            items={[
              ...(clearable ? [{ value: NONE, label: "— ไม่ระบุ —" }] : []),
              ...options,
            ]}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder ?? "เลือก"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {clearable && <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
