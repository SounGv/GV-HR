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
import { HOLIDAY_TYPES } from "./schema";
import { useCreateHoliday, useUpdateHoliday } from "./hooks";
import type { Holiday } from "./types";

const TYPE_LABEL: Record<string, string> = { COMPANY: "วันหยุดบริษัท", NATIONAL: "วันหยุดราชการ" };

const formSchema = z.object({
  date: z.string().min(1, "กรุณาเลือกวันที่"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อวันหยุด"),
  type: z.enum(HOLIDAY_TYPES),
  notifyEnabled: z.boolean(),
});
type FormSchema = z.infer<typeof formSchema>;

export function HolidayFormDialog({
  open,
  onOpenChange,
  holiday,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday?: Holiday | null;
}) {
  const isEdit = !!holiday;
  const createMutation = useCreateHoliday();
  const updateMutation = useUpdateHoliday(holiday?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: holiday?.date ? holiday.date.slice(0, 10) : "",
      name: holiday?.name ?? "",
      type: holiday?.type ?? "COMPANY",
      notifyEnabled: holiday?.notifyEnabled ?? true,
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("เพิ่มวันหยุดเรียบร้อย");
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
          <DialogTitle>{isEdit ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}</DialogTitle>
          <DialogDescription>กำหนดวันหยุดสำหรับปฏิทินองค์กร</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="holiday-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อวันหยุด</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น วันสงกรานต์" {...field} />
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
                      {HOLIDAY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notifyEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>แจ้งเตือนล่วงหน้า</FormLabel>
                    <FormDescription>ส่งการแจ้งเตือนก่อนถึงวันหยุด</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
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
          <Button type="submit" form="holiday-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เพิ่ม"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
