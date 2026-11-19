import { requirePermission } from "@/lib/auth/guard";
import { BadRequest, Forbidden } from "@/lib/api/errors";
import { isValidPeriod } from "@/features/payroll/calc";
import { canManagePayroll, getPayrollPeriodStatus } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ period: string }> }) {
  try {
    const session = await requirePermission("payroll:read");
    if (!canManagePayroll(session)) throw Forbidden("ไม่มีสิทธิ์ดูสถานะงวดเงินเดือน");
    const { period } = await params;
    if (!isValidPeriod(period)) throw BadRequest("รูปแบบงวดต้องเป็น YYYY-MM เช่น 2026-11");
    const status = await getPayrollPeriodStatus(session.companyId, period);
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}
