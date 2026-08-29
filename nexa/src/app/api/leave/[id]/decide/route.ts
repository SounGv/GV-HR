import { type NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { decideSchema } from "@/features/leave/schema";
import { decideLeave } from "@/features/leave/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission(["leave:approve", "leave:manage"]);
    const { id } = await params;
    const input = decideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideLeave(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
