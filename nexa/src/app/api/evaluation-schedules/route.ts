import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { scheduleTemplateCreateSchema } from "@/features/evaluation-schedule/schema";
import { listScheduleTemplates, createScheduleTemplate } from "@/features/evaluation-schedule/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    const templates = await listScheduleTemplates(session.companyId);
    return ok(templates);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const body = await req.json().catch(() => ({}));
    const input = scheduleTemplateCreateSchema.parse(body);
    const template = await createScheduleTemplate(session.companyId, session, input, getRequestMeta(req));
    return created(template);
  } catch (err) {
    return handleApiError(err);
  }
}
