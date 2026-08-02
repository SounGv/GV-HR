"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import { EMPLOYMENT_TYPES } from "@/features/employee/schema";
import { JOB_STATUSES } from "./schema";
import { JOB_STATUS_LABEL } from "./labels";
import { useCreateJob, useUpdateJob } from "./hooks";

const FORM_ID = "job-form";
const LIST = "/recruitment";
const NONE = "__none__";

const formSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุตำแหน่ง"),
  departmentId: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  openings: z.string().regex(/^\d+$/, "ระบุจำนวน").refine((v) => Number(v) >= 1, "อย่างน้อย 1"),
  location: z.string().optional(),
  status: z.enum(JOB_STATUSES),
  description: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export type JobInit = {
  id: string;
  title: string;
  departmentId: string | null;
  employmentType: FormSchema["employmentType"];
  openings: number;
  location: string | null;
  status: FormSchema["status"];
  description: string | null;
};

export function JobFormPage({ job }: { job?: JobInit }) {
  const router = useRouter();
  const isEdit = !!job;
  const { data: orgData } = useOrgOptions();
  const createMut = useCreateJob();
  const updateMut = useUpdateJob(job?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: job?.title ?? "",
      departmentId: job?.departmentId ?? NONE,
      employmentType: job?.employmentType ?? "FULL_TIME",
      openings: String(job?.openings ?? 1),
      location: job?.location ?? "",
      status: job?.status ?? "OPEN",
      description: job?.description ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    const payload = { ...values, departmentId: values.departmentId === NONE ? undefined : values.departmentId };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(payload);
        toast.success("บันทึกเรียบร้อย");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(payload);
        toast.success("ประกาศตำแหน่งเรียบร้อย");
        if (againRef.current) {
          form.reset();
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push(LIST);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    ...(isEdit ? [] : [{ label: "บันทึกและประกาศใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "ประกาศ", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "สรรหาพนักงาน", href: LIST }, { label: isEdit ? "แก้ไขตำแหน่งงาน" : "ประกาศรับสมัคร" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขตำแหน่งงาน" : "ประกาศรับสมัคร"}
      description="รายละเอียดตำแหน่งงานที่เปิดรับสมัคร"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-2xl grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>ตำแหน่ง</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น พนักงานขาย" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>แผนก</FormLabel>
                <Select value={field.value || NONE} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="เลือกแผนก" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                    {(orgData?.data.departments ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ประเภทการจ้าง</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EMPLOYMENT_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="openings"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จำนวนที่รับ</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สถานะ</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {JOB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {JOB_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>สถานที่ปฏิบัติงาน</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น สำนักงานใหญ่ กรุงเทพ" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>รายละเอียดงาน</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
