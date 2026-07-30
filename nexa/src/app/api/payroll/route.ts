import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { Forbidden } from "@/lib/api/errors";
import { generatePayrollSchema, payrollListQuerySchema } from "@/features/payroll/schema";
import { generatePayroll, listPayroll, canManagePayroll } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("payroll:read");
    const query = payrollListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope === "all" && !canManagePayroll(session)) {
      throw Forbidden("ไม่มีสิทธิ์ดูเงินเดือนของผู้อื่น");
    }
    const records = await listPayroll(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("payroll:create");
    const { period } = generatePayrollSchema.parse(await req.json().catch(() => ({})));
    const result = await generatePayroll(session.companyId, session, period, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
