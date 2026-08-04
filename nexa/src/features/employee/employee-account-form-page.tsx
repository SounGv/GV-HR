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

  const formSchema = z.object({
    email: hasAccount
      ? z.string().optional()
      : z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
    password: passwordSchema,
  });
  type FormSchema = z.infer<typeof formSchema>;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: defaultEmail ?? "", password: "" },
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
        await api.post<Envelope<{ email: string }>>(`/api/employees/${employeeId}/account`, values);
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
          : `ตั้งอีเมลและรหัสผ่านให้ ${employeeName} เข้าใช้งานแอพ (สิทธิ์เริ่มต้น: พนักงานทั่วไป)`
      }
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(backHref)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          {!hasAccount && (
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
