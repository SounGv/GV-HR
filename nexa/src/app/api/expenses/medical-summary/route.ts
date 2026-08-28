import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { BadRequest } from "@/lib/api/errors";
import { getMedicalBenefitSummary, getMedicalEligibility } from "@/features/expense/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("expense:create");
    if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    // Sequential, not Promise.all — this app's Prisma pool is
    // connection_limit=1, so concurrent queries from one request can silently
    // drop results (see prior fixes elsewhere in this codebase for the same
    // constraint).
    const summary = await getMedicalBenefitSummary(session.companyId, session.employeeId, year);
    const eligibility = await getMedicalEligibility(session.companyId, session.employeeId);
    return ok({ ...summary, ...eligibility });
  } catch (err) {
    return handleApiError(err);
  }
}
