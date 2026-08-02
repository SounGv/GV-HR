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
import { useCreateExpense } from "./hooks";
import { EXPENSE_CATEGORIES } from "./schema";
import { EXPENSE_CATEGORY_LABEL } from "./labels";
import type { ExpenseFormValues } from "./types";

const FORM_ID = "expense-form";
const LIST = "/expenses";

const formSchema = z.object({
  title: z.string().min(1, "กรุณาระบุรายการ"),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง"),
  expenseDate: z.string().min(1, "กรุณาเลือกวันที่"),
  description: z.string().optional(),
  receiptUrl: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function ExpenseFormPage() {
  const router = useRouter();
  const createMut = useCreateExpense();
  const againRef = useRef(false);

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
      if (againRef.current) {
        form.reset();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push(LIST);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: "ส่งและเพิ่มใหม่", onClick: () => (againRef.current = true) },
    { label: "ส่งคำขอ", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "เบิกจ่าย", href: LIST }, { label: "ขอเบิกใหม่" }]}
      backHref={LIST}
      title="ขอเบิกค่าใช้จ่าย"
      description="กรอกรายละเอียดเพื่อส่งให้หัวหน้างาน/การเงินอนุมัติ"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
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
    </FormPageShell>
  );
}
