import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getPayslip } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";

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
