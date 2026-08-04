import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { mfaCodeSchema } from "@/features/auth/schema";
import { disableTwoFactor } from "@/lib/auth/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { code } = mfaCodeSchema.parse(await req.json().catch(() => ({})));
    await disableTwoFactor(session.sub, code);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
