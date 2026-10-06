import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { formUpdateSchema } from "@/features/appraisal-form/schema";
import { deleteForm, getForm, updateForm } from "@/features/appraisal-form/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:manage");
    const { id } = await params;
    return ok(await getForm(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const input = formUpdateSchema.parse(await req.json().catch(() => ({})));
    return ok(await updateForm(session.companyId, session, id, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:delete");
    const { id } = await params;
    await deleteForm(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
