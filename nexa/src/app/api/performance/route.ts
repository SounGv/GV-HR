import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { reviewCreateSchema, reviewListQuerySchema } from "@/features/performance/schema";
import { createReview, listReviews } from "@/features/performance/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("performance:read");
    const query = reviewListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !can(session.perms, "performance:create")) {
      throw Forbidden("ไม่มีสิทธิ์ดูผลการประเมินของผู้อื่น");
    }
    const records = await listReviews(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("performance:create");
    const input = reviewCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createReview(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
