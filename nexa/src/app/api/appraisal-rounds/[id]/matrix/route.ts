import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRoundMatrix } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** Who still has to rate whom: every person in the round with the status of each rater. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:manage");
    const { id } = await params;
    return ok(await getRoundMatrix(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}
