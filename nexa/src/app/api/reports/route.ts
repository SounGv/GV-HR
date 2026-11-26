import { type NextRequest } from "next/server";
import { attachFaces } from "@/features/report/faces";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { reportQuerySchema } from "@/features/report/schema";
import { getReport } from "@/features/report/service";
import { REPORT_TYPE_PERMISSION } from "@/features/report/permissions";
import { teamScopeFilter } from "@/features/employee/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("report:read");
    const params = req.nextUrl.searchParams;
    // employeeId/branchId/costCenterId are multi-select on the client, sent
    // as repeated keys (?employeeId=a&employeeId=b) — getAll, not .entries()
    // (which keeps only the last value for a repeated key), and only set the
    // field at all when at least one value came through, so the schema's
    // .optional() still means "no filter" rather than an empty-array filter.
    const multi = (key: string) => {
      const values = params.getAll(key);
      return values.length ? values : undefined;
    };
    const query = reportQuerySchema.parse({
      ...Object.fromEntries(params.entries()),
      departmentId: multi("departmentId"),
      employmentType: multi("employmentType"),
      employeeId: multi("employeeId"),
      branchId: multi("branchId"),
      costCenterId: multi("costCenterId"),
    });
    const requiredPerm = REPORT_TYPE_PERMISSION[query.type];
    if (requiredPerm && !can(session.perms, requiredPerm)) {
      throw Forbidden("ไม่มีสิทธิ์ดูรายงานนี้");
    }
    // Manager holds report:read but must only ever see their own team's data
    // (same boundary enforced everywhere else in the app) — a non-company-wide
    // caller gets team-scoped regardless of what departmentId/employeeId they
    // pass in the query, so they can't widen their own report access by hand.
    const result = await getReport(session.companyId, {
      ...query,
      employeeWhere: teamScopeFilter(session) ?? undefined,
      maskNoScan: true,
    });
    return ok(await attachFaces(session.companyId, result));
  } catch (err) {
    return handleApiError(err);
  }
}
