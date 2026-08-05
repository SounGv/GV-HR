"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

import { forgotPasswordSchema, type ForgotPasswordInput } from "./schema";
import { api } from "@/lib/api/client";
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

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", values);
    } finally {
      // Always show the same success state — don't reveal whether the email exists.
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center lg:text-left">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success lg:mx-0">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">
          หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ
        </p>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>อีเมล</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.co.th"
                    className="h-10 pl-9"
                    {...field}
                  />
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
          ส่งลิงก์รีเซ็ตรหัสผ่าน
        </Button>
        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:justify-start">
          <ArrowLeft className="size-4" /> กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </form>
    </Form>
  );
}
