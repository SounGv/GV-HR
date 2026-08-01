import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { SelfProfileInput } from "./schema";

const profileSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  nickname: true,
  email: true,
  phone: true,
  avatarUrl: true,
  gender: true,
  dateOfBirth: true,
  nationalId: true,
  maritalStatus: true,
  addressLine: true,
  subDistrict: true,
  district: true,
  province: true,
  postalCode: true,
  country: true,
  bankName: true,
  bankAccountNo: true,
  bankBranch: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelation: true,
  status: true,
  hireDate: true,
  department: { select: { name: true } },
  position: { select: { title: true } },
  branch: { select: { name: true } },
  updatedAt: true,
} satisfies Prisma.EmployeeSelect;

type Meta = { ip?: string; userAgent?: string };

function requireEmployeeId(session: SessionUser): string {
  if (!session.employeeId) {
    throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงแก้ไขโปรไฟล์ไม่ได้");
  }
  return session.employeeId;
}

export async function getMyProfile(session: SessionUser) {
  const employeeId = requireEmployeeId(session);
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: session.companyId, deletedAt: null },
    select: profileSelect,
  });
  if (!emp) throw NotFound("ไม่พบข้อมูลพนักงานของคุณ");
  return emp;
}

export async function updateMyProfile(
  session: SessionUser,
  input: SelfProfileInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const { dateOfBirth, ...rest } = input;

  // Scope the write to the caller's own record + company (defense in depth).
  const result = await prisma.employee.updateMany({
    where: { id: employeeId, companyId: session.companyId, deletedAt: null },
    data: {
      ...rest,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      updatedById: session.sub,
    },
  });
  if (result.count === 0) throw NotFound("ไม่พบข้อมูลพนักงานของคุณ");

  await writeAudit({
    companyId: session.companyId,
    actorUserId: session.sub,
    action: "profile.update_self",
    entity: "Employee",
    entityId: employeeId,
    ...meta,
  });

  return prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: profileSelect });
}
