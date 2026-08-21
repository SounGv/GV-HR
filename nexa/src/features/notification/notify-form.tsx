"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { sendNotificationSchema, type SendNotificationInput } from "./schema";
import { useSendBroadcastNotification } from "./hooks";

const FORM_ID = "notify-form";
const LIST = "/notifications";

export function NotifyForm() {
  const router = useRouter();
  const sendMutation = useSendBroadcastNotification();
  const { data: orgData } = useOrgOptions();

  const form = useForm<SendNotificationInput>({
    resolver: zodResolver(sendNotificationSchema),
    defaultValues: { employeeIds: [], title: "", body: "" },
  });

  const roster = orgData?.data.managers ?? [];
  const departments = orgData?.data.departments ?? [];
  const selected = form.watch("employeeIds");

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    form.setValue("employeeIds", next, { shouldValidate: true });
  }

  function selectDepartment(departmentId: string) {
    const ids = roster.filter((e) => e.departmentId === departmentId).map((e) => e.id);
    const merged = Array.from(new Set([...selected, ...ids]));
    form.setValue("employeeIds", merged, { shouldValidate: true });
  }

  function selectAll() {
    form.setValue("employeeIds", roster.map((e) => e.id), { shouldValidate: true });
  }

  function clearAll() {
    form.setValue("employeeIds", [], { shouldValidate: true });
  }

  async function onSubmit(values: SendNotificationInput) {
    try {
      const res = await sendMutation.mutateAsync(values);
      toast.success(`ส่งแจ้งเตือนถึง ${res.data.sent} คนเรียบร้อย`);
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งแจ้งเตือนไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: "ส่งแจ้งเตือน", onClick: () => {}, primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "การแจ้งเตือน", href: LIST }, { label: "ส่งแจ้งเตือน" }]}
      backHref={LIST}
      title="ส่งแจ้งเตือนถึงพนักงาน"
      description="เลือกผู้รับแล้วส่งได้ทีเดียว — พนักงานจะเห็นเป็นแจ้งเตือน (กระดิ่ง) ในแอปของตัวเอง"
      formId={FORM_ID}
      pending={sendMutation.isPending}
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
                <FormLabel>หัวข้อ</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น เชิญทำแบบประเมิน H2/2569" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ข้อความ</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="รายละเอียดที่อยากแจ้ง" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employeeIds"
            render={() => (
              <FormItem>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FormLabel>ผู้รับ ({selected.length} คน)</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                      เลือกทั้งบริษัท
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                      ล้างที่เลือก
                    </Button>
                  </div>
                </div>

                {departments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {departments.map((d) => (
                      <Button
                        key={d.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => selectDepartment(d.id)}
                      >
                        + {d.name}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {roster.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">ไม่พบพนักงาน</p>
                  ) : (
                    roster.map((e) => (
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
