"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { employeeAccountSchema, employeePasswordResetSchema } from "./schema";

export function EmployeeAccountButton({
  employeeId,
  hasAccount,
  defaultEmail,
}: {
  employeeId: string;
  hasAccount: boolean;
  defaultEmail: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = employeeAccountSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!fe[String(i.path[0])]) fe[String(i.path[0])] = i.message;
      setErrors(fe);
      return;
    }
    setPending(true);
    try {
      await api.post<Envelope<{ email: string }>>(`/api/employees/${employeeId}/account`, parsed.data);
      toast.success("สร้างบัญชีเรียบร้อย — พนักงานเข้าใช้งานได้แล้ว");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างบัญชีไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = employeePasswordResetSchema.safeParse({ password });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!fe[String(i.path[0])]) fe[String(i.path[0])] = i.message;
      setErrors(fe);
      return;
    }
    setPending(true);
    try {
      await api.patch<Envelope<{ ok: true }>>(`/api/employees/${employeeId}/account`, parsed.data);
      toast.success("ตั้งรหัสผ่านใหม่เรียบร้อย — พนักงานต้องเข้าสู่ระบบใหม่ทุกอุปกรณ์");
      setOpen(false);
      setPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  if (hasAccount) {
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="size-4" /> มีบัญชีเข้าใช้งานแล้ว
          </span>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <RotateCcw className="size-4" /> รีเซ็ตรหัสผ่าน
          </Button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>รีเซ็ตรหัสผ่านพนักงาน</DialogTitle>
              <DialogDescription>
                ตั้งรหัสผ่านใหม่ให้พนักงานคนนี้ — ระบบจะออกจากระบบทุกอุปกรณ์ที่ล็อกอินอยู่ทันที
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitReset} className="space-y-3">
              <Field label="รหัสผ่านใหม่" error={errors.password}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  autoFocus
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />} ตั้งรหัสผ่านใหม่
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" /> สร้างบัญชีเข้าใช้งาน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>สร้างบัญชีเข้าใช้งาน</DialogTitle>
            <DialogDescription>
              ตั้งอีเมลและรหัสผ่านให้พนักงานเข้าใช้งานแอพ (สิทธิ์เริ่มต้น: พนักงานทั่วไป)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <Field label="อีเมล (ใช้เข้าสู่ระบบ)" error={errors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="รหัสผ่านเริ่มต้น" error={errors.password}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" />
            </Field>
            <p className="text-xs text-muted-foreground">
              แนะนำให้พนักงานเปลี่ยนรหัสผ่านหลังเข้าใช้งานครั้งแรก
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} สร้างบัญชี
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
