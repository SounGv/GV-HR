import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Forbidden, NotFound } from "@/lib/api/errors";
import { buildOrderBy, toSkipTake } from "@/lib/api/pagination";
import { revokeAllForUser } from "@/lib/auth/token-store";
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
  userId: true,
  firstNameEn: true,
  lastNameEn: true,
  gender: true,
  dateOfBirth: true,
  maritalStatus: true,
  nationalId: true,
  probationEndDate: true,
  terminationDate: true,
  compensationType: true,
  baseSalary: true,
  dailyRate: true,
  hourlyRate: true,
  bankName: true,
  bankAccountNo: true,
  taxSpouseNoIncome: true,
  taxChildrenStandard: true,
  taxChildrenEnhanced: true,
  taxParentCareCount: true,
  taxLifeInsurance: true,
  taxHealthInsurance: true,
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

/**
 * HR-level roles (Super Admin, HR Manager — anyone actually granted
 * `employee:update`) and Finance (needs company-wide visibility for
 * payroll/expense processing) see the full directory. Note: wildcard grants
 * like "employee:*" are expanded into concrete keys at seed time (see
 * `expandPermissions`), so `session.perms` never literally contains
 * "employee:*" — checking for the real `employee:update` permission is what
 * actually distinguishes HR from a plain `employee:read`-only Manager.
 */
function isCompanyWideEmployeeViewer(session: AccessClaims): boolean {
  return (
    session.perms.includes("*") ||
    session.perms.includes("employee:update") ||
    session.roles.includes("Finance")
  );
}

function teamScopeFilter(session: AccessClaims): Prisma.EmployeeWhereInput | null {
  if (isCompanyWideEmployeeViewer(session)) return null;
  const employeeId = session.employeeId ?? "__none__";
  return { OR: [{ id: employeeId }, { managerId: employeeId }] };
}

export async function listEmployees(companyId: string, query: EmployeeListQuery, session?: AccessClaims) {
  const scope = session ? teamScopeFilter(session) : null;
  const where: Prisma.EmployeeWhereInput = {
    companyId,
    deletedAt: null,
    ...(scope ?? {}),
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

export async function getEmployee(companyId: string, id: string, session?: AccessClaims): Promise<EmployeeDetail> {
  const employee = await prisma.employee.findFirst({
    where: { id, companyId, deletedAt: null },
    select: detailSelect,
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  if (session && !isCompanyWideEmployeeViewer(session)) {
    const own = employee.id === session.employeeId;
    const managesTarget = employee.manager?.id === session.employeeId;
    if (!own && !managesTarget) throw Forbidden("ดูข้อมูลได้เฉพาะทีมของคุณ");
  }

  return employee;
}

/** Prisma requires Decimal instances, not plain numbers, for @db.Decimal fields. */
function toDecimalFields<
  T extends {
    baseSalary?: number;
    dailyRate?: number;
    hourlyRate?: number;
    taxLifeInsurance?: number;
    taxHealthInsurance?: number;
  },
>(input: T) {
  const { baseSalary, dailyRate, hourlyRate, taxLifeInsurance, taxHealthInsurance, ...rest } = input;
  return {
    ...rest,
    ...(baseSalary !== undefined ? { baseSalary: new Prisma.Decimal(baseSalary) } : {}),
    ...(dailyRate !== undefined ? { dailyRate: new Prisma.Decimal(dailyRate) } : {}),
    ...(hourlyRate !== undefined ? { hourlyRate: new Prisma.Decimal(hourlyRate) } : {}),
    ...(taxLifeInsurance !== undefined ? { taxLifeInsurance: new Prisma.Decimal(taxLifeInsurance) } : {}),
    ...(taxHealthInsurance !== undefined ? { taxHealthInsurance: new Prisma.Decimal(taxHealthInsurance) } : {}),
  };
}

/** Map a partial update payload to Prisma data (Decimal conversion for salary/rate fields). */
function toUpdateData(input: EmployeeUpdateInput) {
  return toDecimalFields(input);
}

/**
 * Suggests the next sequential "EMP0001"-style code for the "add employee"
 * form. Existing employees keep whatever code scheme the company already
 * uses (e.g. legacy numeric codes from a prior system, or codes brought in
 * via CSV import) — this only proposes a default for brand-new manual
 * entries, continuing the EMP-prefixed sequence if one exists, starting at
 * EMP0001 otherwise. The field stays editable, so HR can still override it.
 */
export async function suggestNextEmployeeCode(companyId: string): Promise<string> {
  const codes = await prisma.employee.findMany({
    where: { companyId, employeeCode: { startsWith: "EMP" } },
    select: { employeeCode: true },
  });
  const maxN = codes.reduce((max, { employeeCode }) => {
    const m = /^EMP(\d+)$/.exec(employeeCode);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `EMP${String(maxN + 1).padStart(4, "0")}`;
}

export async function createEmployee(
  companyId: string,
  input: EmployeeCreateInput,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
): Promise<EmployeeDetail> {
  const created = await prisma.employee.create({
    data: {
      ...toDecimalFields(input),
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
    select: { id: true, status: true, userId: true },
  });
  if (!existing) throw NotFound("ไม่พบพนักงาน");

  const updated = await prisma.employee.update({
    where: { id },
    data: { ...toUpdateData(input), updatedById: actor.sub },
    select: detailSelect,
  });

  // Employment status drives system access: leaving employment must revoke
  // login immediately, and reinstating it must restore access — not leave
  // the account silently disabled or, worse, silently still active.
  const INACTIVE_STATUSES = new Set(["TERMINATED", "RESIGNED", "SUSPENDED"]);
  if (existing.userId && input.status && input.status !== existing.status) {
    if (INACTIVE_STATUSES.has(input.status)) {
      await prisma.user.update({ where: { id: existing.userId }, data: { status: "DISABLED" } });
      await revokeAllForUser(existing.userId);
    } else if (INACTIVE_STATUSES.has(existing.status)) {
      await prisma.user.update({ where: { id: existing.userId }, data: { status: "ACTIVE" } });
    }
  }

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
    select: { id: true, employeeCode: true, userId: true },
  });
  if (!existing) throw NotFound("ไม่พบพนักงาน");

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actor.sub },
  });

  // A terminated/removed employee must lose system access immediately —
  // disable the linked login account and kill any active sessions, don't
  // just leave the Employee row soft-deleted while the User stays live.
  if (existing.userId) {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { status: "DISABLED" },
    });
    await revokeAllForUser(existing.userId);
  }

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
