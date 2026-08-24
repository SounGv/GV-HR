import { requirePermission } from "@/lib/auth/guard";
import { BadRequest } from "@/lib/api/errors";
import { getLoanEligibility } from "@/features/company-loan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("expense:create");
    if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
    const eligibility = await getLoanEligibility(session.companyId, session.employeeId);
    return ok(eligibility);
  } catch (err) {
    return handleApiError(err);
  }
}
