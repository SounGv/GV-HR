import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { requestCreateSchema, requestListQuerySchema } from "@/features/workflow/schema";
import { listRequests, createRequest } from "@/features/workflow/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("workflow:read");
    const query = requestListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const records = await listRequests(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("workflow:read");
    const input = requestCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createRequest(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
