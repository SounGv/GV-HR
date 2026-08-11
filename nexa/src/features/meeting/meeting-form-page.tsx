"use client";

import { useRef, useState } from "react";
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
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useCreateMeeting } from "./hooks";

const FORM_ID = "meeting-form";
const LIST = "/meetings";

const formSchema = z
  .object({
    title: z.string().min(1, "กรุณาระบุหัวข้อการประชุม"),
    description: z.string().optional(),
    location: z.string().optional(),
    startAt: z.string().min(1, "กรุณาเลือกวันและเวลาเริ่ม"),
    endAt: z.string().min(1, "กรุณาเลือกวันและเวลาสิ้นสุด"),
    attendeeEmployeeIds: z.array(z.string()).min(1, "กรุณาเลือกผู้เข้าร่วมอย่างน้อย 1 คน"),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endAt"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function MeetingFormPage() {
  const router = useRouter();
  const createMutation = useCreateMeeting();
  const { data: orgData } = useOrgOptions();
  const againRef = useRef(false);
  const [search, setSearch] = useState("");

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startAt: "",
      endAt: "",
      attendeeEmployeeIds: [],
    },
  });

  const selected = form.watch("attendeeEmployeeIds");
  const candidates = (orgData?.data.managers ?? []).filter(
    (e) =>
      !search ||
      `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    form.setValue("attendeeEmployeeIds", next, { shouldValidate: true });
  }

  async function onSubmit(values: FormSchema) {
    try {
      await createMutation.mutateAsync(values);
      toast.success("นัดประชุมเรียบร้อย");
      if (againRef.current) {
        form.reset();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push(LIST);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นัดประชุมไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: "บันทึกและนัดใหม่", onClick: () => (againRef.current = true) },
    { label: "นัดประชุม", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "นัดประชุม", href: LIST }, { label: "นัดประชุมใหม่" }]}
      backHref={LIST}
      title="นัดประชุมใหม่"
      description="กำหนดหัวข้อ เวลา และผู้เข้าร่วม — ระบบจะแจ้งเตือนผู้เข้าร่วมทุกคนให้ตอบรับ/ปฏิเสธ"
      formId={FORM_ID}
      pending={createMutation.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หัวข้อการประชุม</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น ประชุมทีมขายประจำเดือน" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เริ่ม</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สิ้นสุด</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สถานที่ / ลิงก์ประชุมออนไลน์</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น ห้องประชุม A หรือ Google Meet link" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รายละเอียด / วาระการประชุม</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="หัวข้อที่จะพูดคุย (ถ้ามี)" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attendeeEmployeeIds"
            render={() => (
              <FormItem>
                <FormLabel>ผู้เข้าร่วม ({selected.length} คน)</FormLabel>
                <Input
                  placeholder="ค้นหาชื่อพนักงาน..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {candidates.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">ไม่พบพนักงาน</p>
                  ) : (
                    candidates.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(e.id)}
                          onChange={() => toggle(e.id)}
                          className="size-4 accent-primary"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {e.firstName} {e.lastName} ({e.employeeCode})
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
