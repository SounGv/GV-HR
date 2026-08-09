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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileAttachField } from "@/components/shared/file-attach-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { CANDIDATE_STAGES } from "./schema";
import { CANDIDATE_STAGE_LABEL } from "./labels";
import { useCreateCandidate, useUpdateCandidate, useJobs } from "./hooks";

const FORM_ID = "cand-form";
const LIST = "/recruitment";

const formSchema = z.object({
  jobPostingId: z.string().uuid("กรุณาเลือกตำแหน่ง"),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  email: z.union([z.string().email("อีเมลไม่ถูกต้อง"), z.literal("")]).optional(),
  phone: z.string().optional(),
  stage: z.enum(CANDIDATE_STAGES),
  note: z.string().optional(),
  resumeUrl: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export type CandidateInit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  resumeUrl: string | null;
  stage: FormSchema["stage"];
  jobPosting: { id: string; title: string };
};

export function CandidateFormPage({
  defaultJobId,
  candidate,
}: {
  defaultJobId?: string;
  candidate?: CandidateInit;
}) {
  const router = useRouter();
  const isEdit = !!candidate;
  const { data: jobsData } = useJobs();
  const createMut = useCreateCandidate();
  const updateMut = useUpdateCandidate();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobPostingId: candidate?.jobPosting.id ?? defaultJobId ?? "",
      name: candidate?.name ?? "",
      email: candidate?.email ?? "",
      phone: candidate?.phone ?? "",
      stage: candidate?.stage ?? "APPLIED",
      note: candidate?.note ?? "",
      resumeUrl: candidate?.resumeUrl ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && candidate) {
        await updateMut.mutateAsync({ id: candidate.id, input: values });
        toast.success("บันทึกเรียบร้อย");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values);
        toast.success("เพิ่มผู้สมัครเรียบร้อย");
        if (againRef.current) {
          form.reset({ ...form.getValues(), name: "", email: "", phone: "", note: "", resumeUrl: "", stage: "APPLIED" });
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push(LIST);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    ...(isEdit ? [] : [{ label: "บันทึกและเพิ่มใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "เพิ่มผู้สมัคร", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "สรรหาพนักงาน", href: LIST }, { label: isEdit ? "แก้ไขผู้สมัคร" : "เพิ่มผู้สมัคร" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขผู้สมัคร" : "เพิ่มผู้สมัคร"}
      description="บันทึกผู้สมัครเข้าสู่ขั้นตอนการคัดเลือก"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-3">
          <FormField
            control={form.control}
            name="jobPostingId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ตำแหน่งที่สมัคร</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="เลือกตำแหน่ง" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(jobsData?.data ?? []).map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อผู้สมัคร</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>อีเมล</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เบอร์โทร</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สถานะ</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CANDIDATE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CANDIDATE_STAGE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="resumeUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เรซูเม่ (ไม่บังคับ)</FormLabel>
                <FormControl>
                  <FileAttachField value={field.value} onChange={field.onChange} label="แนบเรซูเม่" />
                </FormControl>
                <FormMessage />
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
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
