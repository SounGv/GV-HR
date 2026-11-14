import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/lib/api/errors";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { resolveAiAccess, employeeScopeWhere } from "@/lib/ai/scope";
import { confirmProposal } from "@/lib/ai/proposals";

export const runtime = "nodejs";

const bodySchema = z.object({ token: z.string().min(20).max(60000) });

/**
 * The press of "ยืนยัน" on a card น้องวีบอท drew. The person's own session does
 * the work, so the same permission and audience rules apply as on the normal pages.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const access = await resolveAiAccess(session);
    if (!access.allowed) throw Forbidden();
    const scopeWhere = await employeeScopeWhere(session, access.scope);
    const { token } = bodySchema.parse(await request.json());
    const outcome = await confirmProposal(session, token, scopeWhere, getRequestMeta(request));
    return ok(outcome);
  } catch (error) {
    return handleApiError(error);
  }
}
