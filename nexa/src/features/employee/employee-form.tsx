"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL,
} from "./schema";
import { EMPLOYMENT_LABEL, GENDER_LABEL, MARITAL_LABEL, STATUS_LABEL } from "./labels";
import type { EmployeeFormValues, OrgOptions } from "./types";

const NONE = "__none__";

const formSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณากรอกรหัสพนักงาน"),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  nickname: z.string().trim().optional(),
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
  baseSalary: z.string().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNo: z.string().trim().optional(),
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

  function submit(values: FormSchema) {
    // Strip the "none" sentinel back to undefined before sending.
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === NONE ? undefined : v]),
    ) as unknown as EmployeeFormValues;
    onSubmit(cleaned);
  }

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(submit)} className="space-y-8">
        <Section title="ข้อมูลส่วนตัว">
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
        </Section>

        <Section title="การจ้างงาน">
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
        </Section>

        <Section title="เงินเดือนและบัญชีธนาคาร">
          <TextField form={form} name="baseSalary" label="เงินเดือนพื้นฐาน (บาท)" type="number" />
          <TextField form={form} name="bankName" label="ธนาคาร" />
          <TextField form={form} name="bankAccountNo" label="เลขที่บัญชี" />
        </Section>

        <Section title="ที่อยู่">
          <TextField form={form} name="addressLine" label="ที่อยู่" className="sm:col-span-2" />
          <TextField form={form} name="district" label="อำเภอ/เขต" />
          <TextField form={form} name="province" label="จังหวัด" />
          <TextField form={form} name="postalCode" label="รหัสไปรษณีย์" />
        </Section>
      </form>
    </Form>
  );
}

/* ── Layout + field helpers ─────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
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
          <Select value={field.value || ""} onValueChange={field.onChange}>
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
