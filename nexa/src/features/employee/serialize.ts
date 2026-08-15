import type { EmployeeDetail as PrismaEmployeeDetail } from "./service";
import type { EmployeeDetail } from "./types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Convert a Prisma employee payload (Date / Decimal) into the JSON-shaped client
 * type (ISO strings / string decimals) so it can cross the RSC → client boundary
 * with matching types — mirroring what the API returns over the wire.
 */
export function serializeEmployeeDetail(e: PrismaEmployeeDetail): EmployeeDetail {
  return {
    ...e,
    dateOfBirth: iso(e.dateOfBirth),
    hireDate: iso(e.hireDate),
    probationEndDate: iso(e.probationEndDate),
    terminationDate: iso(e.terminationDate),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    baseSalary: e.baseSalary ? e.baseSalary.toString() : null,
    dailyRate: e.dailyRate ? e.dailyRate.toString() : null,
    hourlyRate: e.hourlyRate ? e.hourlyRate.toString() : null,
    taxLifeInsurance: e.taxLifeInsurance.toString(),
    taxHealthInsurance: e.taxHealthInsurance.toString(),
  };
}
