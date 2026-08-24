import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getLoan } from "@/features/company-loan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("expense:read");
    const { id } = await params;
    const record = await getLoan(session.companyId, session, id);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
