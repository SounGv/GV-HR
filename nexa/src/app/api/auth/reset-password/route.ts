import { type NextRequest } from "next/server";
import { resetPasswordSchema } from "@/features/auth/schema";
import { resetPassword } from "@/lib/auth/password-reset";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, password } = resetPasswordSchema.parse(body);
    await resetPassword(token, password);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
