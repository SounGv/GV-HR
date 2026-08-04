import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin, Pencil, KeyRound, RotateCcw, Sparkle, CheckCircle2 } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { getEmployee } from "@/features/employee/service";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmployeeStatusBadge } from "@/features/employee/status-badge";
import { EMPLOYMENT_LABEL, GENDER_LABEL, MARITAL_LABEL } from "@/features/employee/labels";
import { fullName, getInitials, formatDate, formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "รายละเอียดพนักงาน" };

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("employee:read");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  const canEdit = can(session.perms, "employee:update");
  const isHrLevelRecognition = session.perms.includes("*") || session.perms.includes("employee:update");
  const canGiveRecognition =
    can(session.perms, "recognition:create") &&
    (isHrLevelRecognition || employee.manager?.id === session.employeeId);
  const name = fullName(employee.firstName, employee.lastName);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "พนักงาน", href: "/employees" }, { label: name }]}
        backHref="/employees"
        title={name}
        description={`${employee.employeeCode}${employee.position?.title ? ` · ${employee.position.title}` : ""}`}
        status={<EmployeeStatusBadge status={employee.status} />}
        actions={
          canEdit || canGiveRecognition ? (
            <>
              {canGiveRecognition && (
                <Button variant="outline" size="sm" render={<Link href={`/employees/${employee.id}/recognize`} />}>
                  <Sparkle className="size-4" /> ให้กำลังใจ
                </Button>
              )}
              {canEdit && (
                <>
                  {employee.userId && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="size-4" /> มีบัญชีเข้าใช้งานแล้ว
                    </span>
                  )}
                  <Button variant="outline" size="sm" render={<Link href={`/employees/${employee.id}/account`} />}>
                    {employee.userId ? (
                      <>
                        <RotateCcw className="size-4" /> รีเซ็ตรหัสผ่าน
                      </>
                    ) : (
                      <>
                        <KeyRound className="size-4" /> สร้างบัญชีเข้าใช้งาน
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" render={<Link href={`/employees/${employee.id}/edit`} />}>
                    <Pencil className="size-4" /> แก้ไข
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      />

      {/* Profile header */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt={name} />}
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {getInitials(employee.firstName, employee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{name}</h2>
              {employee.nickname && (
                <span className="text-sm text-muted-foreground">({employee.nickname})</span>
              )}
              <EmployeeStatusBadge status={employee.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {employee.employeeCode}
              {employee.position?.title && ` · ${employee.position.title}`}
              {employee.department?.name && ` · ${employee.department.name}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoCard title="ข้อมูลติดต่อ">
          <InfoRow icon={Mail} label="อีเมล" value={employee.email} />
          <InfoRow icon={Phone} label="เบอร์โทร" value={employee.phone} />
          <InfoRow
            icon={MapPin}
            label="ที่อยู่"
            value={
              [employee.addressLine, employee.district, employee.province, employee.postalCode]
                .filter(Boolean)
                .join(" ") || null
            }
          />
        </InfoCard>

        <InfoCard title="การจ้างงาน">
          <InfoRow label="ประเภทการจ้าง" value={EMPLOYMENT_LABEL[employee.employmentType]} />
          <InfoRow label="สาขา" value={employee.branch?.name ?? null} />
          <InfoRow label="แผนก" value={employee.department?.name ?? null} />
          <InfoRow label="ตำแหน่ง" value={employee.position?.title ?? null} />
          <InfoRow
            label="หัวหน้างาน"
            value={
              employee.manager
                ? fullName(employee.manager.firstName, employee.manager.lastName)
                : null
            }
          />
          <InfoRow label="วันเริ่มงาน" value={formatDate(employee.hireDate)} />
          <InfoRow label="สิ้นสุดทดลองงาน" value={formatDate(employee.probationEndDate)} />
        </InfoCard>

        <InfoCard title="ข้อมูลส่วนตัว">
          <InfoRow label="เพศ" value={employee.gender ? GENDER_LABEL[employee.gender] : null} />
          <InfoRow label="วันเกิด" value={formatDate(employee.dateOfBirth)} />
          <InfoRow
            label="สถานภาพ"
            value={employee.maritalStatus ? MARITAL_LABEL[employee.maritalStatus] : null}
          />
          <InfoRow label="เลขบัตรประชาชน" value={employee.nationalId} />
        </InfoCard>

        <InfoCard title="เงินเดือนและบัญชีธนาคาร">
          <InfoRow
            label="เงินเดือนพื้นฐาน"
            value={employee.baseSalary ? formatCurrency(Number(employee.baseSalary)) : null}
          />
          <InfoRow label="ธนาคาร" value={employee.bankName} />
          <InfoRow label="เลขที่บัญชี" value={employee.bankAccountNo} />
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}
