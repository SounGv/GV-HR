"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dices, Eye, EyeOff, KeyRound } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { passwordSchema, generateStrongPassword } from "@/lib/auth/password-policy";

const FORM_ID = "employee-account-form";
const USERNAME_RE = /^[a-z][a-z0-9_.]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmployeeAccountFormPage({
  employeeId,
  employeeName,
  hasAccount,
  defaultEmail,
}: {
  employeeId: string;
  employeeName: string;
  hasAccount: boolean;
  defaultEmail: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const backHref = `/employees/${employeeId}`;

  // Single fixed shape regardless of hasAccount (a ternary between two
  // differently-shaped zod schemas breaks react-hook-form's generic
  // inference) — the "at least one identifier" rule only applies when
  // creating a brand-new account, not when just resetting a password.
  const formSchema = z
    .object({
      email: z.string().trim().toLowerCase().max(200),
      username: z.string().trim().toLowerCase().max(32),
      password: passwordSchema,
    })
    .refine((d) => hasAccount || !!d.email || !!d.username, {
      message: "กรุณากรอกอีเมลหรือชื่อผู้ใช้อย่างน้อย 1 อย่าง",
      path: ["email"],
    })
    .refine((d) => !d.email || EMAIL_RE.test(d.email), { message: "อีเมลไม่ถูกต้อง", path: ["email"] })
    .refine((d) => !d.username || USERNAME_RE.test(d.username), {
      message: "ต้องขึ้นต้นด้วยตัวอักษร ใช้ได้เฉพาะตัวพิมพ์เล็ก ตัวเลข _ . ความยาว 3-32 ตัวอักษร",
      path: ["username"],
    });
  type FormSchema = z.infer<typeof formSchema>;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: defaultEmail ?? "", username: "", password: "" },
  });

  function fillGeneratedPassword() {
    form.setValue("password", generateStrongPassword(), { shouldValidate: true });
    setShowPassword(true);
  }

  async function onSubmit(values: FormSchema) {
    setPending(true);
    try {
      if (hasAccount) {
        await api.patch<Envelope<{ ok: true }>>(`/api/employees/${employeeId}/account`, {
          password: values.password,
        });
        toast.success("ตั้งรหัสผ่านใหม่เรียบร้อย — พนักงานต้องเข้าสู่ระบบใหม่ทุกอุปกรณ์");
      } else {
        await api.post<Envelope<{ email: string | null; username: string | null }>>(
          `/api/employees/${employeeId}/account`,
          { email: values.email || undefined, username: values.username || undefined, password: values.password },
        );
        toast.success("สร้างบัญชีเรียบร้อย — พนักงานเข้าใช้งานได้แล้ว");
      }
      router.push(backHref);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  const actions: FormFooterAction[] = [
    { label: hasAccount ? "ตั้งรหัสผ่านใหม่" : "สร้างบัญชี", primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "พนักงาน", href: "/employees" },
        { label: employeeName, href: backHref },
        { label: hasAccount ? "รีเซ็ตรหัสผ่าน" : "สร้างบัญชีเข้าใช้งาน" },
      ]}
      backHref={backHref}
      title={hasAccount ? "รีเซ็ตรหัสผ่านพนักงาน" : "สร้างบัญชีเข้าใช้งาน"}
      description={
        hasAccount
          ? `ตั้งรหัสผ่านใหม่ให้ ${employeeName} — ระบบจะออกจากระบบทุกอุปกรณ์ที่ล็อกอินอยู่ทันที`
          : `ตั้งอีเมลหรือชื่อผู้ใช้ (อย่างน้อย 1 อย่าง) และรหัสผ่านให้ ${employeeName} เข้าใช้งานแอพ (สิทธิ์เริ่มต้น: พนักงานทั่วไป)`
      }
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(backHref)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          {!hasAccount && (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล (ใช้เข้าสู่ระบบ)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                หรือ
                <div className="h-px flex-1 bg-border" />
              </div>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อผู้ใช้ (สำหรับพนักงานที่ไม่มีอีเมล)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="เช่น somchai.j" autoCapitalize="none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{hasAccount ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"}</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="8+ ตัวอักษร มีพิมพ์เล็ก ใหญ่ ตัวเลข"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" onClick={fillGeneratedPassword}>
                      <Dices className="size-4" /> สุ่มให้
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Card className="flex items-start gap-2.5 bg-muted/40 p-3 text-xs text-muted-foreground">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            <span>
              แนะนำให้พนักงานเปลี่ยนรหัสผ่านหลังเข้าใช้งานครั้งแรก
              {hasAccount && " ระบบจะบังคับออกจากระบบทุกอุปกรณ์ที่ล็อกอินอยู่ทันทีหลังตั้งรหัสผ่านใหม่"}
            </span>
          </Card>
        </form>
      </Form>
    </FormPageShell>
  );
}
