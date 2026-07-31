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
import { useCreateExpense } from "./hooks";
import { EXPENSE_CATEGORIES } from "./schema";
import { EXPENSE_CATEGORY_LABEL } from "./labels";
import type { ExpenseFormValues } from "./types";

const formSchema = z.object({
  title: z.string().min(1, "กรุณาระบุรายการ"),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง"),
  expenseDate: z.string().min(1, "กรุณาเลือกวันที่"),
  description: z.string().optional(),
  receiptUrl: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function ExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMut = useCreateExpense();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "other",
      amount: "",
      expenseDate: "",
      description: "",
      receiptUrl: "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values as ExpenseFormValues);
      toast.success("ส่งคำขอเบิกจ่ายเรียบร้อย");
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
          <DialogTitle>ขอเบิกค่าใช้จ่าย</DialogTitle>
          <DialogDescription>กรอกรายละเอียดเพื่อส่งให้หัวหน้างาน/การเงินอนุมัติ</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="expense-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รายการ</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ค่าแท็กซี่ไปพบลูกค้า" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
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
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {EXPENSE_CATEGORY_LABEL[c]}
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="expenseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่ใช้จ่าย</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ลิงก์ใบเสร็จ (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://…" {...field} />
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
                  <FormLabel>หมายเหตุ</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="รายละเอียดเพิ่มเติม" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="expense-form" disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="size-4 animate-spin" />}
            ส่งคำขอ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
