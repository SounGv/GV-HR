import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { templateCreateSchema } from "@/features/shift/schema";
import { listTemplates, createTemplate } from "@/features/shift/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("shift:read");
    const records = await listTemplates(session.companyId);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("shift:create");
    const input = templateCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createTemplate(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
