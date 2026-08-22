"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { fullName } from "@/lib/format";
import { useRevokeAiAccessGrant, useSetAiAccessGrant } from "./hooks";
import type { AdminUser, AiAccessScope } from "./types";

const FORM_ID = "ai-access-form";
const LIST_HREF = "/admin";

const SCOPE_LABEL: Record<AiAccessScope, string> = {
  TEAM: "เฉพาะทีม (ตนเอง + ลูกทีม)",
  DEPARTMENT: "ทั้งแผนก",
  COMPANY: "ทั้งองค์กร",
};

export function AiAccessFormPage({ user }: { user: AdminUser }) {
  const router = useRouter();
  const setMut = useSetAiAccessGrant();
  const revokeMut = useRevokeAiAccessGrant();
  const [scope, setScope] = useState<AiAccessScope>(user.aiAccessScope ?? "TEAM");

  const name = user.employee ? fullName(user.employee.firstName, user.employee.lastName) : user.email;
  const hasEmployee = !!user.employee;

  async function onSubmit() {
    try {
      await setMut.mutateAsync({ id: user.id, scope });
      toast.success("บันทึกสิทธิ์ AI Assistant เรียบร้อย");
      router.push(LIST_HREF);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function onRevoke() {
    try {
      await revokeMut.mutateAsync(user.id);
      toast.success("ยกเลิกสิทธิ์ AI Assistant เรียบร้อย");
      router.push(LIST_HREF);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "บันทึกสิทธิ์", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ผู้ดูแลระบบ", href: LIST_HREF }, { label: `สิทธิ์ AI Assistant ของ ${name}` }]}
      backHref={LIST_HREF}
      title="สิทธิ์การใช้งาน AI Assistant"
      description={name}
      formId={FORM_ID}
      pending={setMut.isPending}
      onCancel={() => router.push(LIST_HREF)}
      actions={actions}
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="max-w-md space-y-4"
      >
        {!hasEmployee ? (
          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงกำหนดสิทธิ์ AI Assistant รายคนให้ไม่ได้
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              เปิดสิทธิ์ให้ใช้ AI Assistant พร้อมกำหนดขอบเขตข้อมูลที่ AI จะดึงมาตอบให้คนนี้ —
              ถ้าบทบาทของผู้ใช้มีสิทธิ์ AI อยู่แล้ว (เช่น ผู้บริหาร/การเงิน) การตั้งค่านี้จะกำหนด
              แค่ขอบเขตข้อมูล ไม่ใช่การเปิด-ปิดการใช้งาน
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">ขอบเขตข้อมูลที่ AI เข้าถึงได้</label>
              <Select value={scope} onValueChange={(v) => setScope(v as AiAccessScope)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABEL) as AiAccessScope[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {user.aiAccessScope && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={onRevoke}
                disabled={revokeMut.isPending}
              >
                ยกเลิกสิทธิ์ AI Assistant
              </Button>
            )}
          </>
        )}
      </form>
    </FormPageShell>
  );
}
