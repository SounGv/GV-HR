"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Circle, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { VBot } from "@/components/shared/v-bot";
import { PasswordInput } from "@/features/auth/password-input";
import { ApiError } from "@/lib/api/client";
import { passwordSchema } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";
import { useChangePassword } from "./hooks";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน",
    path: ["newPassword"],
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });
type FormSchema = z.infer<typeof formSchema>;

/** The same rules as `passwordSchema`, shown as a live checklist while typing. */
const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "อย่างน้อย 8 ตัวอักษร", test: (pw) => pw.length >= 8 },
  { label: "ตัวพิมพ์เล็ก (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "ตัวพิมพ์ใหญ่ (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "ตัวเลข (0–9)", test: (pw) => /[0-9]/.test(pw) },
];

const STRENGTH = [
  { label: "ยังไม่ได้กรอก", bar: "bg-muted" },
  { label: "อ่อนมาก", bar: "bg-[#dc2626]" },
  { label: "อ่อน", bar: "bg-[#d97706]" },
  { label: "พอใช้", bar: "bg-[#ca8a04]" },
  { label: "ผ่านเกณฑ์", bar: "bg-[#0d9488]" },
  { label: "แข็งแรงมาก", bar: "bg-[#15803d]" },
];

/** 0 = empty … 4 = meets every rule, 5 = meets them and is 12+ characters. */
function strength(pw: string): number {
  if (!pw) return 0;
  const met = RULES.filter((r) => r.test(pw)).length;
  return met === RULES.length && pw.length >= 12 ? 5 : Math.max(met, 1);
}

/**
 * Change-password card (profile → ความปลอดภัย), in the sign-in page's look:
 * a dark teal side panel with น้องวีบอท, tall fields with show/hide and a
 * Caps Lock warning, a live rule checklist with a strength bar, and a
 * "ตรงกัน" check on the confirmation. After saving, other devices are signed out.
 */
export function ChangePasswordForm() {
  const changePasswordMut = useChangePassword();
  const [done, setDone] = useState(false);
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPw = form.watch("newPassword");
  const confirmPw = form.watch("confirmPassword");
  const level = strength(newPw);
  const matches = confirmPw.length > 0 && confirmPw === newPw;

  async function onSubmit(values: FormSchema) {
    try {
      await changePasswordMut.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("เปลี่ยนรหัสผ่านเรียบร้อย — อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้จะถูกออกจากระบบ");
      form.reset();
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 md:grid md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.6fr)]">
      {/* Side panel: what this does and what happens after. */}
      {/* .gv-hero is unlayered CSS, so its corner radius is reset inline (a utility class would lose). */}
      <div className="gv-hero relative flex flex-col gap-4 p-5 sm:p-6" style={{ borderRadius: 0, boxShadow: "none" }}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-[13px] border border-white/20 bg-white/10">
            <LockKeyhole className="size-[22px]" aria-hidden="true" />
          </span>
          <VBot mood={done ? "ok" : "hi"} full className="h-[78px] w-[66px] md:h-[96px] md:w-[82px]" />
        </div>
        <div>
          <h2 className="text-[22px] leading-tight font-bold">เปลี่ยนรหัสผ่าน</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/80">ตั้งรหัสใหม่ที่เดาได้ยาก และไม่ใช้ซ้ำกับเว็บอื่น</p>
        </div>
        <p className="gv-glass mt-auto flex items-start gap-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-white/90">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#CDEB03]" aria-hidden="true" />
          หลังเปลี่ยนแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้จะถูกออกจากระบบทั้งหมด ยกเว้นเครื่องนี้
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {done && (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2.5 text-sm font-semibold text-[#15803d]" role="status">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            เปลี่ยนรหัสผ่านแล้ว ใช้รหัสใหม่ครั้งถัดไปที่เข้าสู่ระบบ
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-[460px] gap-4" onChange={() => done && setDone(false)}>
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสผ่านปัจจุบัน</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" placeholder="รหัสที่ใช้อยู่ตอนนี้" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสผ่านใหม่</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" placeholder="ตั้งรหัสผ่านใหม่" aria-describedby="pw-rules" {...field} />
                  </FormControl>
                  <FormMessage />
                  {/* Strength bar + checklist: status is a word and an icon, never colour alone. */}
                  <div id="pw-rules" className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="grid flex-1 grid-cols-5 gap-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={cn("h-1.5 rounded-full transition-colors", n <= level ? STRENGTH[level].bar : "bg-muted")} />
                        ))}
                      </div>
                      <span className="w-[76px] text-right text-xs font-semibold text-muted-foreground">{STRENGTH[level].label}</span>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {RULES.map((r) => {
                        const ok = r.test(newPw);
                        return (
                          <li key={r.label} className={cn("flex items-center gap-1.5 text-[12.5px]", ok ? "font-medium text-[#15803d]" : "text-muted-foreground")}>
                            {ok ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0" aria-hidden="true" />}
                            {r.label}
                            <span className="sr-only">{ok ? "ผ่าน" : "ยังไม่ผ่าน"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
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
                    <PasswordInput autoComplete="new-password" placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" {...field} />
                  </FormControl>
                  {matches && (
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#15803d]">
                      <Check className="size-3.5" aria-hidden="true" /> ตรงกัน
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={changePasswordMut.isPending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-6 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_10px_24px_-12px_rgba(15,118,110,.55)] transition-colors hover:bg-[#115e59] focus-visible:ring-3 focus-visible:ring-[#0d9488]/30 focus-visible:outline-none disabled:opacity-60 sm:justify-self-start"
            >
              {changePasswordMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
              {changePasswordMut.isPending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </Form>
      </div>
    </Card>
  );
}
