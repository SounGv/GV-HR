import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { closePayrollPeriod } from "@/features/payroll/service";
import { BadRequest } from "@/lib/api/errors";
import { isValidPeriod } from "@/features/payroll/calc";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ period: string }> }) {
  try {
    const session = await requirePermission("payroll:approve");
    const { period } = await params;
    if (!isValidPeriod(period)) throw BadRequest("รูปแบบงวดต้องเป็น YYYY-MM เช่น 2026-11");
    const status = await closePayrollPeriod(session.companyId, session, period, getRequestMeta(req));
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}
