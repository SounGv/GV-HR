import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { templateCreateSchema, templateListQuerySchema } from "@/features/evaluation-template/schema";
import { listTemplates, createTemplate } from "@/features/evaluation-template/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:read");
    const query = templateListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const templates = await listTemplates(session.companyId, query);
    return ok(templates);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const body = await req.json().catch(() => ({}));
    const input = templateCreateSchema.parse(body);
    const template = await createTemplate(session.companyId, session, input, getRequestMeta(req));
    return created(template);
  } catch (err) {
    return handleApiError(err);
  }
}
