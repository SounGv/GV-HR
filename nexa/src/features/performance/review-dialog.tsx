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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { COMPETENCIES, computeOverall, scoreBand } from "./calc";
import { useCreateReview, useUpdateReview } from "./hooks";
import type { PerformanceReview } from "./types";

function defaultCycle() {
  const d = new Date();
  const half = d.getMonth() < 6 ? 1 : 2;
  return `H${half}/${d.getFullYear() + 543}`;
}

const formSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  cycle: z.string().min(1, "กรุณาระบุรอบการประเมิน"),
  competencies: z.array(z.object({ name: z.string(), score: z.number().min(1, "1–5").max(5, "1–5") })),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  summary: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function ReviewDialog({
  open,
  onOpenChange,
  review,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review?: PerformanceReview | null;
}) {
  const isEdit = !!review;
  const { data: orgData } = useOrgOptions();
  const createMut = useCreateReview();
  const updateMut = useUpdateReview(review?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: review
      ? {
          employeeId: review.employee.id,
          cycle: review.cycle,
          competencies: COMPETENCIES.map((name) => ({
            name,
            score: review.competencies.find((c) => c.name === name)?.score ?? 3,
          })),
          strengths: review.strengths ?? "",
          improvements: review.improvements ?? "",
          summary: review.summary ?? "",
        }
      : {
          employeeId: "",
          cycle: defaultCycle(),
          competencies: COMPETENCIES.map((name) => ({ name, score: 3 })),
          strengths: "",
          improvements: "",
          summary: "",
        },
  });

  const comps = form.watch("competencies");
  const overall = computeOverall(comps ?? []);

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        const { employeeId: _drop, ...rest } = values;
        void _drop;
        await updateMut.mutateAsync(rest);
        toast.success("บันทึกการประเมินเรียบร้อย");
      } else {
        await createMut.mutateAsync(values);
        toast.success("สร้างการประเมินเรียบร้อย");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขการประเมิน" : "สร้างการประเมินผลงาน"}</DialogTitle>
          <DialogDescription>ให้คะแนนสมรรถนะ 1–5 ระบบจะคำนวณคะแนนรวมและเกรดให้อัตโนมัติ</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="review-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>พนักงาน</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกพนักงาน">
                            {(value) => {
                              const m = (orgData?.data.managers ?? []).find((x) => x.id === value);
                              return m
                                ? `${m.firstName} ${m.lastName} (${m.employeeCode})`
                                : "เลือกพนักงาน";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(orgData?.data.managers ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.firstName} {m.lastName} ({m.employeeCode})
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
                name="cycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รอบการประเมิน</FormLabel>
                    <FormControl>
                      <Input placeholder="เช่น H1/2569" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">สมรรถนะ (1–5)</span>
                <span className="text-sm text-muted-foreground">
                  รวม <span className="font-semibold text-foreground">{overall.toFixed(1)}</span> ·{" "}
                  {scoreBand(overall)}
                </span>
              </div>
              {COMPETENCIES.map((name, i) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{name}</span>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    step={0.5}
                    className="w-20"
                    {...form.register(`competencies.${i}.score`, { valueAsNumber: true })}
                  />
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="strengths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จุดแข็ง</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="improvements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สิ่งที่ควรพัฒนา</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สรุปผลการประเมิน</FormLabel>
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
          <Button type="submit" form="review-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้างการประเมิน"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
