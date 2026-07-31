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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreateTemplate, useUpdateTemplate } from "./hooks";
import type { ShiftTemplate, TemplateFormValues } from "./types";

const formSchema = z.object({
  name: z.string().min(1, "กรุณาระบุชื่อกะ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง"),
  breakMinutes: z.string().regex(/^\d+$/, "ตัวเลขเท่านั้น"),
});
type FormSchema = z.infer<typeof formSchema>;

export function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ShiftTemplate | null;
}) {
  const isEdit = !!template;
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", startTime: "08:00", endTime: "17:00", color: "#2563EB", breakMinutes: "60" },
  });

  useEffect(() => {
    if (open && template) {
      form.reset({
        name: template.name,
        startTime: template.startTime,
        endTime: template.endTime,
        color: template.color,
        breakMinutes: String(template.breakMinutes),
      });
    } else if (open && !template) {
      form.reset();
    }
  }, [open, template, form]);

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && template) {
        await updateMut.mutateAsync({ id: template.id, input: values as Partial<TemplateFormValues> });
        toast.success("บันทึกกะแล้ว");
      } else {
        await createMut.mutateAsync(values as TemplateFormValues);
        toast.success("สร้างกะแล้ว");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขกะ" : "สร้างกะการทำงาน"}</DialogTitle>
          <DialogDescription>กำหนดชื่อ ช่วงเวลา และสีของกะ</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="template-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อกะ</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น กะเช้า" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาเริ่ม</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาสิ้นสุด</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>สี</FormLabel>
                    <FormControl>
                      <Input type="color" className="h-9 p-1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="breakMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>พักเบรก (นาที)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
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
          <Button type="submit" form="template-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้างกะ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
