import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { PAID_TYPES, type PaidType } from "./year-rollover";

type Meta = { ip?: string; userAgent?: string };

export interface EntitlementRow {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  types: Record<PaidType, { total: number; used: number } | null>;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Everyone still working, with their paid-leave entitlement and usage for one year (null = no row yet for that type). */
export async function listEntitlements(companyId: string, year: number, search?: string): Promise<EntitlementRow[]> {
  const term = search?.trim();
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE",
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { employeeCode: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      leaveBalances: { where: { year, type: { in: [...PAID_TYPES] } }, select: { type: true, totalDays: true, usedDays: true } },
    },
    orderBy: { employeeCode: "asc" },
    take: 500,
  });
  return employees.map((e) => {
    const types = { SICK: null, PERSONAL: null, ANNUAL: null } as EntitlementRow["types"];
    for (const b of e.leaveBalances) types[b.type as PaidType] = { total: r1(b.totalDays), used: r1(b.usedDays) };
    return {
      employeeId: e.id,
      code: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: e.department?.name ?? "ไม่ระบุแผนก",
      types,
    };
  });
}

/** Sets one person's entitlement for one paid type and year (creates the row if it does not exist). Usage is never touched. */
export async function setEntitlement(
  companyId: string,
  session: AccessClaims,
  input: { employeeId: string; year: number; type: PaidType; totalDays: number },
  meta?: Meta,
) {
  if (!(PAID_TYPES as readonly string[]).includes(input.type)) throw BadRequest("ประเภทการลาไม่ถูกต้อง");
  if (!(input.totalDays >= 0 && input.totalDays <= 365)) throw BadRequest("จำนวนวันต้องอยู่ระหว่าง 0–365");
  const emp = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId, deletedAt: null }, select: { id: true } });
  if (!emp) throw NotFound("ไม่พบพนักงาน");

  const before = await prisma.leaveBalance.findUnique({
    where: { employeeId_year_type: { employeeId: input.employeeId, year: input.year, type: input.type } },
    select: { totalDays: true, usedDays: true },
  });
  const totalDays = r1(input.totalDays);
  await prisma.leaveBalance.upsert({
    where: { employeeId_year_type: { employeeId: input.employeeId, year: input.year, type: input.type } },
    create: { companyId, employeeId: input.employeeId, year: input.year, type: input.type, totalDays, usedDays: 0 },
    update: { totalDays },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "leave.entitlement_set",
    entity: "LeaveBalance",
    entityId: `${input.employeeId}:${input.year}:${input.type}`,
    before: before ? { totalDays: before.totalDays } : null,
    after: { totalDays },
    ...meta,
  });
  return { totalDays, usedDays: before?.usedDays ?? 0 };
}
