"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreateCourse, useUpdateCourse } from "./hooks";
import { TRAINING_STATUSES } from "./schema";
import type { CourseFormValues, TrainingCourse } from "./types";

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

const STATUS_LABEL: Record<(typeof TRAINING_STATUSES)[number], string> = {
  OPEN: "เปิดรับสมัคร",
  CLOSED: "ปิดรับสมัคร",
};

export function CourseDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: TrainingCourse | null;
}) {
  const isEdit = !!course;
  const createMut = useCreateCourse();
  const updateMut = useUpdateCourse();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

  useEffect(() => {
    if (open && course) {
      form.reset({
        title: course.title,
        description: course.description ?? "",
        category: course.category,
        provider: course.provider ?? "",
        hours: String(course.hours),
        location: course.location ?? "",
        scheduledDate: course.scheduledDate ? course.scheduledDate.slice(0, 10) : "",
        capacity: course.capacity != null ? String(course.capacity) : "",
        status: course.status,
      });
    } else if (open && !course) {
      form.reset();
    }
  }, [open, course, form]);

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && course) {
        await updateMut.mutateAsync({ id: course.id, input: values as Partial<CourseFormValues> });
        toast.success("บันทึกหลักสูตรแล้ว");
      } else {
        await createMut.mutateAsync(values as CourseFormValues);
        toast.success("สร้างหลักสูตรแล้ว");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขหลักสูตร" : "สร้างหลักสูตรอบรม"}</DialogTitle>
          <DialogDescription>กำหนดรายละเอียดหลักสูตรและวันอบรม</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="course-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="course-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้างหลักสูตร"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
