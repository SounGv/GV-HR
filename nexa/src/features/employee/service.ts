import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import { buildOrderBy, toSkipTake } from "@/lib/api/pagination";
import type { AccessClaims } from "@/lib/auth/jwt";
import {
  EMPLOYEE_SORTABLE,
  type EmployeeCreateInput,
  type EmployeeListQuery,
  type EmployeeUpdateInput,
} from "./schema";

const listSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  nickname: true,
  avatarUrl: true,
  email: true,
  phone: true,
  status: true,
  employmentType: true,
  hireDate: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;

const detailSelect = {
  ...listSelect,
  firstNameEn: true,
  lastNameEn: true,
  gender: true,
  dateOfBirth: true,
  maritalStatus: true,
  nationalId: true,
  probationEndDate: true,
  terminationDate: true,
  baseSalary: true,
  bankName: true,
  bankAccountNo: true,
  addressLine: true,
  district: true,
  province: true,
  postalCode: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeSelect;

export type EmployeeListItem = Prisma.EmployeeGetPayload<{ select: typeof listSelect }>;
export type EmployeeDetail = Prisma.EmployeeGetPayload<{ select: typeof detailSelect }>;

export async function listEmployees(companyId: string, query: EmployeeListQuery) {
  const where: Prisma.EmployeeWhereInput = {
    companyId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { nickname: { contains: query.search, mode: "insensitive" } },
            { employeeCode: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: listSelect,
      orderBy: buildOrderBy(query, EMPLOYEE_SORTABLE, "createdAt"),
      ...toSkipTake(query),
    }),
    prisma.employee.count({ where }),
  ]);

  return { items, total };
}

export async function getEmployee(companyId: string, id: string): Promise<EmployeeDetail> {
  const employee = await prisma.employee.findFirst({
    where: { id, companyId, deletedAt: null },
    select: detailSelect,
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");
  return employee;
}

/** Map a partial update payload to Prisma data (Decimal conversion for salary). */
function toUpdateData(input: EmployeeUpdateInput) {
  const { baseSalary, ...rest } = input;
  return {
    ...rest,
    ...(baseSalary !== undefined ? { baseSalary: new Prisma.Decimal(baseSalary) } : {}),
  };
}

export async function createEmployee(
  companyId: string,
  input: EmployeeCreateInput,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
): Promise<EmployeeDetail> {
  const { baseSalary, ...rest } = input;
  const created = await prisma.employee.create({
    data: {
      ...rest,
      ...(baseSalary !== undefined ? { baseSalary: new Prisma.Decimal(baseSalary) } : {}),
      companyId,
      createdById: actor.sub,
      updatedById: actor.sub,
    },
    select: detailSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "employee.create",
    entity: "Employee",
    entityId: created.id,
    after: { employeeCode: created.employeeCode, name: `${created.firstName} ${created.lastName}` },
    ...meta,
  });

  return created;
}

export async function updateEmployee(
  companyId: string,
  id: string,
  input: EmployeeUpdateInput,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
): Promise<EmployeeDetail> {
  const existing = await prisma.employee.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบพนักงาน");

  const updated = await prisma.employee.update({
    where: { id },
    data: { ...toUpdateData(input), updatedById: actor.sub },
    select: detailSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "employee.update",
    entity: "Employee",
    entityId: id,
    after: input,
    ...meta,
  });

  return updated;
}

export async function softDeleteEmployee(
  companyId: string,
  id: string,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.employee.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeCode: true },
  });
  if (!existing) throw NotFound("ไม่พบพนักงาน");

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actor.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "employee.delete",
    entity: "Employee",
    entityId: id,
    before: { employeeCode: existing.employeeCode },
    ...meta,
  });
}
