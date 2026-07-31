"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { computeHours } from "./calc";
import { useCreateOvertime } from "./hooks";

const formSchema = z
  .object({
    date: z.string().min(1, "กรุณาเลือกวันที่"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
    reason: z.string().optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endTime"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function OvertimeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMut = useCreateOvertime();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: "", startTime: "18:00", endTime: "20:00", reason: "" },
  });

  const [start, end] = form.watch(["startTime", "endTime"]);
  const hours = start && end && end > start ? computeHours(start, end) : 0;

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values);
      toast.success("ส่งคำขอ OT เรียบร้อย");
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ขอทำงานล่วงเวลา (OT)</DialogTitle>
          <DialogDescription>ระบุวันและช่วงเวลาเพื่อส่งให้หัวหน้างานอนุมัติ</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="ot-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เหตุผล</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="ระบุงานที่ต้องทำล่วงเวลา" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            {hours > 0 && (
              <p className="text-sm text-muted-foreground">
                รวม <span className="font-medium text-foreground">{hours}</span> ชั่วโมง (อัตรา 1.5×)
              </p>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="ot-form" disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="size-4 animate-spin" />}
            ส่งคำขอ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
