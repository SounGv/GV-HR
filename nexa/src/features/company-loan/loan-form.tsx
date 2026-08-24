"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { PhotoAttachField } from "@/components/shared/photo-attach-field";
import { ApiError } from "@/lib/api/client";
import { useCreateLoan, useLoanEligibility } from "./hooks";
import type { LoanFormValues } from "./types";

const FORM_ID = "loan-form";
const LIST = "/benefits/loans";

const formSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง"),
  installmentCount: z.string().regex(/^\d+$/, "กรุณาระบุจำนวนงวด"),
  reason: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  attachmentUrl: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function LoanForm() {
  const router = useRouter();
  const createMut = useCreateLoan();
  const { data: eligData, isLoading: eligLoading } = useLoanEligibility();
  const eligibility = eligData?.data;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: "", installmentCount: "1", reason: "", bankName: "", bankAccountNo: "", attachmentUrl: "" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values as LoanFormValues);
      toast.success("ส่งคำขอกู้เงินบริษัทเรียบร้อย");
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "ส่งคำขอกู้", onClick: () => {}, primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "เบิกจ่าย", href: "/expenses" }, { label: "สวัสดิการ", href: LIST }, { label: "ยื่นกู้เงินบริษัท" }]}
      backHref={LIST}
      title="ยื่นกู้เงินบริษัท"
      description="กู้ได้ปีละ 1 ครั้ง วงเงินสูงสุดไม่เกินเงินเดือนประจำของตนเอง"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Card className="mb-6 gap-2 border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Landmark className="size-5 text-primary" /> สิทธิ์กู้เงินบริษัทของคุณ
        </p>
        {eligLoading || !eligibility ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <div className="space-y-1 text-sm">
            <Row label="ผ่านทดลองงาน" value={eligibility.passedProbation ? "ผ่านแล้ว" : "ยังไม่ผ่าน"} />
            <Row label="ทำงานครบ 1 ปี" value={eligibility.completedOneYear ? "ครบแล้ว" : "ยังไม่ครบ"} />
            <Row label="เงินเดือนประจำ" value={eligibility.currentSalary != null ? `${eligibility.currentSalary.toLocaleString()} บาท` : "ไม่มีข้อมูล"} />
            <Row label="วงเงินกู้สูงสุด" value={`${eligibility.maxLoanAmount.toLocaleString()} บาท`} highlight />
            <Row label="ใช้สิทธิ์ปีนี้แล้วหรือยัง" value={eligibility.usedThisYear ? "ใช้ไปแล้ว" : "ยังไม่ได้ใช้"} />
            {!eligibility.eligible && (
              <p className="pt-1 font-medium text-destructive">
                {!eligibility.passedProbation || !eligibility.completedOneYear
                  ? "ยังไม่มีสิทธิ์กู้เงินบริษัท — ต้องผ่านทดลองงานและทำงานครบ 1 ปี"
                  : eligibility.usedThisYear
                    ? "ใช้สิทธิ์กู้เงินบริษัทของปีนี้ไปแล้ว"
                    : "ไม่มีข้อมูลเงินเดือนประจำ ไม่สามารถยื่นกู้ได้"}
              </p>
            )}
          </div>
        )}
      </Card>

      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จำนวนเงินที่ต้องการกู้ (บาท)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="installmentCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จำนวนงวดที่ต้องการผ่อน</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" min="1" max="36" {...field} />
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
                <FormLabel>เหตุผลการกู้</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="ระบุเหตุผล" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ธนาคาร (บัญชีรับเงิน)</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น กสิกรไทย" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankAccountNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เลขที่บัญชี</FormLabel>
                  <FormControl>
                    <Input placeholder="เลขที่บัญชีรับเงิน" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="attachmentUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เอกสารประกอบ (ถ้ามี)</FormLabel>
                <FormControl>
                  <PhotoAttachField value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-primary" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
