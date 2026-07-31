"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
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
import type { Job } from "./types";

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

export function JobDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job | null;
}) {
  const isEdit = !!job;
  const { data: orgData } = useOrgOptions();
  const createMut = useCreateJob();
  const updateMut = useUpdateJob(job?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: job?.title ?? "",
      departmentId: job?.departmentId ?? "",
      employmentType: (job?.employmentType as FormSchema["employmentType"]) ?? "FULL_TIME",
      openings: String(job?.openings ?? 1),
      location: job?.location ?? "",
      status: job?.status ?? "OPEN",
      description: job?.description ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    const payload = { ...values, departmentId: values.departmentId === NONE ? undefined : values.departmentId };
    try {
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
      toast.success(isEdit ? "บันทึกเรียบร้อย" : "ประกาศตำแหน่งเรียบร้อย");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขตำแหน่งงาน" : "ประกาศรับสมัคร"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="job-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
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
                  <Select value={field.value || ""} onValueChange={field.onChange}>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="job-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "ประกาศ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
