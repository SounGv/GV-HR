import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { submitExpense } from "@/features/expense/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("expense:create");
    const { id } = await params;
    const record = await submitExpense(session.companyId, session, id, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
