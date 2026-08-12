import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { closePayrollPeriod } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ period: string }> }) {
  try {
    const session = await requirePermission("payroll:approve");
    const { period } = await params;
    const status = await closePayrollPeriod(session.companyId, session, period, getRequestMeta(req));
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}
