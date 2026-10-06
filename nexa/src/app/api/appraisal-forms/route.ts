import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { formCreateSchema } from "@/features/appraisal-form/schema";
import { createForm, listForms } from "@/features/appraisal-form/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await listForms(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const input = formCreateSchema.parse(await req.json().catch(() => ({})));
    return created(await createForm(session.companyId, session, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
