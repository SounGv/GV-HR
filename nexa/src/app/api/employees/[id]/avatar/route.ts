import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

/**
 * An employee's photo as an image file. Any signed-in user of the same company
 * may load it, as they can already see colleagues' photos in lists. The address
 * carries a version, so the browser may keep each photo for a week.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: session.companyId, deletedAt: null },
      select: { avatarUrl: true },
    });
    const match = employee?.avatarUrl ? DATA_URL_RE.exec(employee.avatarUrl) : null;
    if (!match) return new Response(null, { status: 404 });

    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": match[1],
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
