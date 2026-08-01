"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { employeeAccountSchema } from "./schema";

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

  if (hasAccount) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="size-4" /> มีบัญชีเข้าใช้งานแล้ว
      </span>
    );
  }

  async function submit(e: FormEvent) {
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
          <form onSubmit={submit} className="space-y-3">
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
