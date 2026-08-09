import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { generateMyLineLinkCode } from "@/features/profile/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    return ok(await generateMyLineLinkCode(session));
  } catch (err) {
    return handleApiError(err);
  }
}
