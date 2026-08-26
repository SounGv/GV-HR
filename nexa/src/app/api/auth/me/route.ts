import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { Unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Returns the current user + linked employee summary + company. */
export async function GET() {
  try {
    const session = await requireSession();

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        username: true,
        companyId: true,
        company: { select: { id: true, name: true, logoUrl: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            nickname: true,
            avatarUrl: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!user) throw Unauthorized();

    return ok({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        companyId: user.companyId,
        company: user.company,
        roles: session.roles,
        permissions: session.perms,
        employee: user.employee,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
