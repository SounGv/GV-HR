import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { auditLogQuerySchema } from "@/features/audit/schema";
import { listAuditLogs } from "@/features/audit/service";
import { okPaginated, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("admin:read");
    const query = auditLogQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const { items, total } = await listAuditLogs(session.companyId, query);
    return okPaginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
