import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { getMedicalBenefitsReport, getLoanBenefitsReport } from "@/features/benefits/report-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

const querySchema = z.object({
  type: z.enum(["medical", "loan"]),
  year: z.coerce.number().int().optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("expense:approve");
    const query = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const filters = {
      year: query.year,
      employeeId: query.employeeId,
      departmentId: query.departmentId,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
    };
    const rows =
      query.type === "medical"
        ? await getMedicalBenefitsReport(session.companyId, filters)
        : await getLoanBenefitsReport(session.companyId, filters);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
