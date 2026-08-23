import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { progressNoteSchema } from "@/features/development-plan/schema";
import { addProgressNote } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const session = await requirePermission("performance:read");
    const { itemId } = await params;
    const input = progressNoteSchema.parse(await req.json().catch(() => ({})));
    const plan = await addProgressNote(session.companyId, session, itemId, input.note, getRequestMeta(req));
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}
