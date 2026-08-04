import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { mfaCodeSchema } from "@/features/auth/schema";
import { confirmTwoFactor } from "@/lib/auth/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { code } = mfaCodeSchema.parse(await req.json().catch(() => ({})));
    const result = await confirmTwoFactor(session.sub, code);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
