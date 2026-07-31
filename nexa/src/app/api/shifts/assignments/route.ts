import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { assignmentUpsertSchema, rangeQuerySchema } from "@/features/shift/schema";
import { listAssignments, upsertAssignment } from "@/features/shift/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("shift:read");
    const { from, to } = rangeQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const records = await listAssignments(session.companyId, from, to);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("shift:create");
    const input = assignmentUpsertSchema.parse(await req.json().catch(() => ({})));
    const record = await upsertAssignment(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
