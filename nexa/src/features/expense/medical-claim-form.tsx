"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Card } from "@/components/ui/card";
import { PhotoAttachField } from "@/components/shared/photo-attach-field";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useCreateExpense, useMedicalSummary, useSickLeaves } from "./hooks";
import type { ExpenseFormValues } from "./types";

const FORM_ID = "medical-claim-form";
const LIST = "/benefits/medical";
const NONE = "__none";

const formSchema = z.object({
  expenseDate: z.string().min(1, "กรุณาเลือกวันที่"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง"),
  hospitalName: z.string().min(1, "กรุณาระบุโรงพยาบาล/คลินิก"),
  description: z.string().optional(),
  sickLeaveRequestId: z.string().optional(),
  receiptUrl: z.string().optional(),
  note: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function MedicalClaimForm() {
  const router = useRouter();
  const createMut = useCreateExpense();
  const { data: summaryData, isLoading: summaryLoading } = useMedicalSummary();
  const { data: sickLeavesData } = useSickLeaves();
  const summary = summaryData?.data;
  const sickLeaves = sickLeavesData?.data ?? [];

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseDate: "",
      amount: "",
      hospitalName: "",
      description: "",
      sickLeaveRequestId: "",
      receiptUrl: "",
      note: "",
    },
  });

  async function submit(status: "DRAFT" | "PENDING") {
    const values = form.getValues();
    if (status === "PENDING") {
      const valid = await form.trigger();
      if (!valid) return;
    }
    try {
      const description = [values.description, values.note ? `หมายเหตุ: ${values.note}` : ""]
        .filter(Boolean)
        .join("\n");
      const input: ExpenseFormValues = {
        title: values.hospitalName || "ค่ารักษาพยาบาล",
        category: "medical",
        amount: values.amount,
        expenseDate: values.expenseDate,
        description: description || undefined,
        hospitalName: values.hospitalName,
        sickLeaveRequestId: values.sickLeaveRequestId === NONE ? undefined : values.sickLeaveRequestId,
        receiptUrl: values.receiptUrl,
        status,
      };
      await createMut.mutateAsync(input);
      toast.success(status === "DRAFT" ? "บันทึกแบบร่างแล้ว" : "ส่งคำขอเบิกค่ารักษาพยาบาลเรียบร้อย");
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: "บันทึกแบบร่าง", onClick: () => submit("DRAFT") },
    { label: "ส่งคำขอ", onClick: () => submit("PENDING"), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "เบิกจ่าย", href: "/expenses" }, { label: "สวัสดิการ", href: LIST }, { label: "ยื่นเบิกค่ารักษาพยาบาล" }]}
      backHref={LIST}
      title="ยื่นเบิกค่ารักษาพยาบาล"
      description="วงเงินคงเหลือคำนวณจากยอดที่อนุมัติ/รออนุมัติแล้วในปีนี้"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Card className="mb-6 gap-3 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Stethoscope className="size-5 text-primary" /> วงเงินค่ารักษาพยาบาล
        </div>
        {summaryLoading || !summary ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat label="วงเงินทั้งหมด" value={`${summary.cap.toLocaleString()} บาท`} />
              <SummaryStat label="อนุมัติแล้ว" value={`${summary.approved.toLocaleString()} บาท`} />
              <SummaryStat label="รออนุมัติ" value={`${summary.pending.toLocaleString()} บาท`} />
              <SummaryStat label="คงเหลือยื่นได้" value={`${summary.remaining.toLocaleString()} บาท`} highlight />
            </div>
            {!summary.eligible && (
              <p className="text-sm font-medium text-destructive">
                {!summary.passedProbation
                  ? "คุณยังไม่ผ่านทดลองงาน — ยังไม่มีสิทธิ์เบิกค่ารักษาพยาบาล"
                  : "คุณทำงานยังไม่ครบ 1 ปี — ยังไม่มีสิทธิ์เบิกค่ารักษาพยาบาล"}
              </p>
            )}
          </>
        )}
      </Card>

      <Form {...form}>
        <form id={FORM_ID} className="max-w-xl space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="expenseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่เบิก</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
            name="hospitalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>โรงพยาบาล / คลินิก</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น โรงพยาบาลกรุงเทพ" {...field} />
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
                <FormLabel>รายละเอียดการรักษา</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="เช่น ตรวจสุขภาพประจำปี, รักษาไข้หวัด" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sickLeaveRequestId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>อ้างอิงใบลาป่วย (ไม่บังคับ)</FormLabel>
                <Select value={field.value || NONE} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>ไม่อ้างอิงใบลา</SelectItem>
                    {sickLeaves.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        ลาป่วย {formatDate(l.startDate)}
                        {l.startDate !== l.endDate ? ` – ${formatDate(l.endDate)}` : ""} ({l.days} วัน)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>เลือกใบลาป่วยที่เกี่ยวข้อง ระบบจะดึงวันที่และเอกสารแนบมาอ้างอิงให้ในรายงาน</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receiptUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>แนบใบเสร็จ / ใบรับรองแพทย์</FormLabel>
                <FormControl>
                  <PhotoAttachField value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormDescription>เอกสารเดียวกันนี้ใช้เบิกซ้ำไม่ได้</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมายเหตุ</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="ระบุเพิ่มเติม (ถ้ามี)" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
