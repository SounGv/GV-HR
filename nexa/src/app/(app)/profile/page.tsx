import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail, IdCard, Building2, Briefcase, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fullName, getInitials } from "@/lib/format";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const emp = user.employee;
  const name = emp ? fullName(emp.firstName, emp.lastName) : user.email;

  const rows: { icon: typeof Mail; label: string; value: string }[] = [
    { icon: Mail, label: "อีเมล", value: user.email },
    ...(emp ? [{ icon: IdCard, label: "รหัสพนักงาน", value: emp.employeeCode }] : []),
    ...(emp?.department ? [{ icon: Building2, label: "ฝ่าย/แผนก", value: emp.department.name }] : []),
    ...(emp?.position ? [{ icon: Briefcase, label: "ตำแหน่ง", value: emp.position.title }] : []),
    { icon: ShieldCheck, label: "สิทธิ์การใช้งาน", value: user.roles.join(", ") || "ผู้ใช้งาน" },
    ...(user.company ? [{ icon: Building2, label: "องค์กร", value: user.company.name }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="โปรไฟล์ของฉัน" description="ข้อมูลบัญชีและพนักงานของคุณ" />

      <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
        <div className="pointer-events-none absolute -top-16 -right-10 size-60 rounded-full bg-primary/25 blur-[90px]" />
        <div className="relative flex items-center gap-4">
          <Avatar className="size-16 ring-2 ring-white/15">
            {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={name} />}
            <AvatarFallback className="bg-white/10 text-lg text-white">
              {getInitials(emp?.firstName, emp?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{name}</p>
            {emp?.nickname && <p className="text-sm text-slate-300">({emp.nickname})</p>}
            <p className="mt-0.5 truncate text-sm text-slate-300">
              {emp?.position?.title ?? user.roles[0] ?? "ผู้ใช้งาน"}
              {emp?.department ? ` · ${emp.department.name}` : ""}
            </p>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border p-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <r.icon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="truncate text-sm font-medium text-foreground">{r.value}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
