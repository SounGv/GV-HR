import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { twoFactorEnabled: true },
    });
    return ok({ enabled: user?.twoFactorEnabled ?? false });
  } catch (err) {
    return handleApiError(err);
  }
}
