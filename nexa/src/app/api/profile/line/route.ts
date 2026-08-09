import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { unlinkMyLine } from "@/features/profile/service";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    return ok(await unlinkMyLine(session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
