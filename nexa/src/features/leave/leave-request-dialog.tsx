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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { LEAVE_TYPES } from "./schema";
import { computeLeaveDays } from "./days";
import { LEAVE_TYPE_LABEL } from "./labels";
import { useCreateLeave } from "./hooks";

const formSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().min(1, "กรุณาเลือกวันเริ่ม"),
    endDate: z.string().min(1, "กรุณาเลือกวันสิ้นสุด"),
    halfDay: z.boolean(),
    reason: z.string().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  })
  .refine((d) => !d.halfDay || d.startDate === d.endDate, {
    message: "ลาครึ่งวันต้องเป็นวันเดียว",
    path: ["halfDay"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function LeaveRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMutation = useCreateLeave();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "ANNUAL", startDate: "", endDate: "", halfDay: false, reason: "" },
  });

  const [start, end, half] = form.watch(["startDate", "endDate", "halfDay"]);
  const preview =
    start && end && end >= start
      ? computeLeaveDays(new Date(start), new Date(end), half)
      : null;

  async function onSubmit(values: FormSchema) {
    try {
      await createMutation.mutateAsync(values);
      toast.success("ส่งคำขอลาเรียบร้อย");
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
          <DialogTitle>ขอลา</DialogTitle>
          <DialogDescription>กรอกรายละเอียดการลาเพื่อส่งให้หัวหน้างานอนุมัติ</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="leave-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเภทการลา</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LEAVE_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันเริ่ม</FormLabel>
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
                    <FormLabel>วันสิ้นสุด</FormLabel>
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
              name="halfDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>ลาครึ่งวัน</FormLabel>
                    <FormDescription>นับเป็น 0.5 วัน (เฉพาะวันเดียว)</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เหตุผล</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="ระบุเหตุผลการลา (ถ้ามี)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {preview !== null && (
              <p className="text-sm text-muted-foreground">
                รวมทั้งหมด <span className="font-medium text-foreground">{preview}</span> วัน
              </p>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="leave-form" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            ส่งคำขอ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
