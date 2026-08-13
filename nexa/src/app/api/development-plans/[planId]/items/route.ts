import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { developmentItemCreateSchema } from "@/features/development-plan/schema";
import { addItem } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const session = await requirePermission("performance:read");
    const { planId } = await params;
    const input = developmentItemCreateSchema.parse(await req.json().catch(() => ({})));
    const plan = await addItem(session.companyId, session, planId, input);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}
