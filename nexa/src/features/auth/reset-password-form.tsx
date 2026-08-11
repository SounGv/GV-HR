"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api/client";
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
import { passwordSchema } from "@/lib/auth/password-policy";

const formSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormSchema) {
    if (!token) {
      toast.error("ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { token, password: values.password });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-3 text-center lg:text-left">
        <p className="text-sm text-muted-foreground">ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว</p>
        <Link href="/forgot-password" className="text-sm font-medium text-accent-foreground hover:underline">
          ขอลิงก์รีเซ็ตรหัสผ่านใหม่
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-center lg:text-left">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success lg:mx-0">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">ตั้งรหัสผ่านใหม่เรียบร้อย กำลังพาไปหน้าเข้าสู่ระบบ…</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>รหัสผ่านใหม่</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" autoComplete="new-password" placeholder="8+ ตัวอักษร มีพิมพ์เล็ก ใหญ่ ตัวเลข" className="h-10 pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ยืนยันรหัสผ่านใหม่</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" autoComplete="new-password" placeholder="กรอกอีกครั้ง" className="h-10 pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full bg-primary text-primary-foreground hover:opacity-90"
          disabled={submitting}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          ตั้งรหัสผ่านใหม่
        </Button>
      </form>
    </Form>
  );
}
