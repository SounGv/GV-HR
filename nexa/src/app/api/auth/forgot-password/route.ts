import { type NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/features/auth/schema";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = forgotPasswordSchema.parse(body);
    await requestPasswordReset(email, getRequestMeta(req));
    // Always the same response — don't reveal whether the email is registered.
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
