import { NextResponse } from "next/server";
import { db } from "@db/index";
import { workplaces } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const rows = await db.select().from(workplaces);
  const includeToken = session.role === "hr";

  return NextResponse.json({
    workplaces: rows.map((w) => ({
      id: w.id,
      name: w.name,
      radiusMeters: w.radiusMeters,
      qrToken: includeToken ? w.qrToken : undefined,
    })),
  });
}
