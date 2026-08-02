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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useCreateCourse, useUpdateCourse } from "./hooks";
import { TRAINING_STATUSES } from "./schema";
import type { CourseFormValues } from "./types";

const FORM_ID = "course-form";
const LIST = "/training";

const STATUS_LABEL: Record<(typeof TRAINING_STATUSES)[number], string> = {
  OPEN: "เปิดรับสมัคร",
  CLOSED: "ปิดรับสมัคร",
};

export type CourseInit = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  provider: string | null;
  hours: number;
  location: string | null;
  scheduledDate: string | null;
  capacity: number | null;
  status: (typeof TRAINING_STATUSES)[number];
};

const formSchema = z.object({
  title: z.string().min(1, "กรุณาระบุชื่อหลักสูตร"),
  description: z.string().optional(),
  category: z.string().min(1, "ระบุหมวดหมู่"),
  provider: z.string().optional(),
  hours: z.string().regex(/^\d+(\.\d+)?$/, "ตัวเลขเท่านั้น"),
  location: z.string().optional(),
  scheduledDate: z.string().optional(),
  capacity: z.string().regex(/^\d*$/, "ตัวเลขเท่านั้น").optional(),
  status: z.enum(TRAINING_STATUSES),
});
type FormSchema = z.infer<typeof formSchema>;

export function CourseFormPage({ course }: { course?: CourseInit }) {
  const router = useRouter();
  const isEdit = !!course;
  const createMut = useCreateCourse();
  const updateMut = useUpdateCourse();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: course
      ? {
          title: course.title,
          description: course.description ?? "",
          category: course.category,
          provider: course.provider ?? "",
          hours: String(course.hours),
          location: course.location ?? "",
          scheduledDate: course.scheduledDate ? course.scheduledDate.slice(0, 10) : "",
          capacity: course.capacity != null ? String(course.capacity) : "",
          status: course.status,
        }
      : {
          title: "",
          description: "",
          category: "ทั่วไป",
          provider: "",
          hours: "6",
          location: "",
          scheduledDate: "",
          capacity: "",
          status: "OPEN",
        },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && course) {
        await updateMut.mutateAsync({ id: course.id, input: values as Partial<CourseFormValues> });
        toast.success("บันทึกหลักสูตรแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values as CourseFormValues);
        toast.success("สร้างหลักสูตรแล้ว");
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
    ...(isEdit ? [] : [{ label: "บันทึกและสร้างใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "สร้างหลักสูตร", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "อบรมและพัฒนา", href: LIST }, { label: isEdit ? "แก้ไข" : "สร้างใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขหลักสูตร" : "สร้างหลักสูตรอบรม"}
      description="กำหนดรายละเอียดหลักสูตรและวันอบรม"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อหลักสูตร</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น การสื่อสารในองค์กร" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รายละเอียด</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="เนื้อหาและวัตถุประสงค์" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมวดหมู่</FormLabel>
                  <FormControl>
                    <Input placeholder="ทั่วไป" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ผู้จัด / วิทยากร</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ภายในองค์กร" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชั่วโมง</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จำนวนรับ</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ไม่จำกัด" {...field} />
                  </FormControl>
                  <FormMessage />
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
                      {TRAINING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันอบรม</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานที่</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ห้องประชุม A" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </FormPageShell>
  );
}
