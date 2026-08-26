import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { reportQuerySchema } from "@/features/report/schema";
import { getReport } from "@/features/report/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

// Report types whose data is more sensitive than plain "report:read" implies
// (company-wide pay figures) — require the same permission the dedicated
// /api/payroll endpoints already enforce, so a role with report:read but no
// payroll:read (e.g. Manager) can't read everyone's payroll through Reports.
const TYPE_PERMISSION: Partial<Record<string, string>> = {
  payroll: "payroll:read",
};

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("report:read");
    const query = reportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const requiredPerm = TYPE_PERMISSION[query.type];
    if (requiredPerm && !can(session.perms, requiredPerm)) {
      throw Forbidden("ไม่มีสิทธิ์ดูรายงานนี้");
    }
    const result = await getReport(session.companyId, query);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
