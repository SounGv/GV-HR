import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { positionCreateSchema } from "@/features/organization/schema";
import { listPositions, createPosition } from "@/features/organization/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("employee:read");
    const records = await listPositions(session.companyId);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("employee:create");
    const input = positionCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createPosition(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
