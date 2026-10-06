import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { answersSchema } from "@/features/appraisal-round/schema";
import { getMyAssignment, saveMyAnswers } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** One of the signed-in person's own jobs; anyone else's id is a 404. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await params;
    return ok(await getMyAssignment(session.companyId, session, id));
  } catch (err) {
    return handleApiError(err);
  }
}

/** Saves a draft, or submits (`submit: true`) when every required question is answered. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = answersSchema.parse(await req.json().catch(() => ({})));
    return ok(await saveMyAnswers(session.companyId, session, id, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
