import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { loanDecideSchema } from "@/features/company-loan/schema";
import { decideLoan } from "@/features/company-loan/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("expense:approve");
    const { id } = await params;
    const input = loanDecideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideLoan(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
