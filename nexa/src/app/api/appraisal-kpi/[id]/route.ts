import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { deleteProfile, runProfile } from "@/features/appraisal-kpi/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

const run = z.object({ from: z.string(), to: z.string() });

/** Scores people for a period with this profile (read-only; limited to the caller's team scope). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:manage");
    const { id } = await params;
    const q = run.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    return ok(await runProfile(session.companyId, session, id, q.from, q.to));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:delete");
    const { id } = await params;
    await deleteProfile(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
