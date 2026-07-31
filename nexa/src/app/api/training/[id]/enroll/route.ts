import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { enrollSelf } from "@/features/training/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("training:read");
    const { id } = await params;
    const record = await enrollSelf(session.companyId, session, id, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
