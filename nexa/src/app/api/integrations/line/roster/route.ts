import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/auth/bearer-token";

export const runtime = "nodejs";

/**
 * Server-to-server roster feed for gv-ops-bot's LINE broadcast/multicast
 * feature. Returns active employees who've linked LINE (lineUserId set) so
 * gv-ops-bot can target a broadcast by department without keeping its own
 * copy of employee/department data — a second copy would drift the moment
 * someone joins, leaves, or changes department, and nexa's Employee table is
 * already the source of truth for this.
 *
 * Auth follows the same pattern as the Vercel Cron routes: a static bearer
 * token, since this is a fixed server-to-server caller, not a user session.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.GV_OPS_BOT_API_KEY;
  const auth = req.headers.get("authorization");
  if (!expected || !auth || !constantTimeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: {
      lineUserId: { not: null },
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: {
      companyId: true,
      employeeCode: true,
      lineUserId: true,
      departmentId: true,
      department: { select: { name: true, code: true } },
    },
  });

  return NextResponse.json({
    data: employees.map((e) => ({
      companyId: e.companyId,
      employeeCode: e.employeeCode,
      lineUserId: e.lineUserId,
      departmentId: e.departmentId,
      departmentName: e.department?.name ?? null,
      departmentCode: e.department?.code ?? null,
    })),
  });
}
