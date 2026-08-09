import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getPayslip, updatePayrollAdjustments } from "@/features/payroll/service";
import { payrollAdjustSchema } from "@/features/payroll/schema";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("payroll:read");
    const { id } = await params;
    const record = await getPayslip(session.companyId, session, id);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("payroll:update");
    const { id } = await params;
    const input = payrollAdjustSchema.parse(await req.json().catch(() => ({})));
    const record = await updatePayrollAdjustments(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
