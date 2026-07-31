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
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { EVENT_TYPES } from "./schema";
import type { EventFormValues, EventType } from "./types";

const formSchema = z
  .object({
    title: z.string().min(1, "กรุณาระบุชื่อกิจกรรม"),
    description: z.string().optional(),
    type: z.enum(EVENT_TYPES),
    startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
    endDate: z.string().optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  });
type FormSchema = z.infer<typeof formSchema>;

const TYPE_LABEL: Record<EventType, string> = {
  event: "กิจกรรม",
  meeting: "ประชุม",
  deadline: "กำหนดส่ง",
};

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: { id: string; title: string; type: string; date: string } | null;
  defaultDate?: string;
}) {
  const isEdit = !!event;
  const createMut = useCreateEvent();
  const updateMut = useUpdateEvent();
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", type: "event", startDate: "", endDate: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      form.reset({
        title: event.title,
        description: "",
        type: (EVENT_TYPES as readonly string[]).includes(event.type)
          ? (event.type as EventType)
          : "event",
        startDate: event.date,
        endDate: "",
      });
    } else {
      form.reset({
        title: "",
        description: "",
        type: "event",
        startDate: defaultDate ?? "",
        endDate: "",
      });
    }
  }, [open, event, defaultDate, form]);

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && event) {
        await updateMut.mutateAsync({ id: event.id, input: values as Partial<EventFormValues> });
        toast.success("บันทึกกิจกรรมแล้ว");
      } else {
        await createMut.mutateAsync(values as EventFormValues);
        toast.success("เพิ่มกิจกรรมแล้ว");
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
          <DialogTitle>{isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</DialogTitle>
          <DialogDescription>กิจกรรมองค์กรจะปรากฏในปฏิทินรวม</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อกิจกรรม</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ประชุมประจำเดือน" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเภท</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันที่เริ่ม</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ถึงวันที่ (ไม่บังคับ)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รายละเอียด</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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
          <Button type="submit" form="event-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เพิ่มกิจกรรม"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
