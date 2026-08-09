"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ApiError } from "@/lib/api/client";
import { passwordSchema } from "@/lib/auth/password-policy";
import { useChangePassword } from "./hooks";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function ChangePasswordForm() {
  const changePasswordMut = useChangePassword();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await changePasswordMut.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("เปลี่ยนรหัสผ่านเรียบร้อย — อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้จะถูกออกจากระบบ");
      form.reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">เปลี่ยนรหัสผ่าน</p>
        <p className="text-xs text-muted-foreground">
          หลังเปลี่ยนแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้จะถูกออกจากระบบทั้งหมด ยกเว้นเครื่องนี้
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-sm space-y-3">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสผ่านปัจจุบัน</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
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
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="8+ ตัวอักษร มีพิมพ์เล็ก ใหญ่ ตัวเลข"
                    {...field}
                  />
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" disabled={changePasswordMut.isPending}>
            {changePasswordMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            เปลี่ยนรหัสผ่าน
          </Button>
        </form>
      </Form>
    </Card>
  );
}
