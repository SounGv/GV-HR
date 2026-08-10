import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { templateUpdateSchema } from "@/features/evaluation-template/schema";
import { getTemplate, updateTemplate, deleteTemplate } from "@/features/evaluation-template/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    return ok(await getTemplate(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = templateUpdateSchema.parse(body);
    const template = await updateTemplate(session.companyId, session, id, input, getRequestMeta(req));
    return ok(template);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:delete");
    const { id } = await params;
    await deleteTemplate(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
