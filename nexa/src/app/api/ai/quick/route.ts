import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/lib/api/errors";
import { ok, handleApiError } from "@/lib/api/response";
import { resolveAiAccess, employeeScopeWhere } from "@/lib/ai/scope";
import { runQuickAction } from "@/lib/ai/quick";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["late_today", "absent_today", "pending_approvals", "leave_quota", "shifts_week", "eval_progress", "announce", "notify"]),
  name: z.string().trim().max(100).optional(),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().max(5000).optional(),
  target: z.string().trim().max(100).optional(),
});

/**
 * The quick actions of น้องวีบอท: answers from our own data with no AI, so they work when the AI service is down or
 * out of credit. Same access rule and same scope as the chat; writes still come back as a confirmation card.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const access = await resolveAiAccess(session);
    if (!access.allowed) throw Forbidden();
    const scopeWhere = await employeeScopeWhere(session, access.scope);
    const input = bodySchema.parse(await request.json());
    return ok(await runQuickAction(session, scopeWhere, input));
  } catch (error) {
    return handleApiError(error);
  }
}
