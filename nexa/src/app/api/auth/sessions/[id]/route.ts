import { requireSession } from "@/lib/auth/guard";
import { revokeSessionById } from "@/lib/auth/token-store";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await revokeSessionById(session.sub, id);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
