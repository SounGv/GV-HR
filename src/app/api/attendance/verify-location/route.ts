import { NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api-helpers";
import { verifyWorkplace } from "@/lib/workplace-verify";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const workplaceId = Number(body?.workplaceId);
  const qrToken = typeof body?.qrToken === "string" ? body.qrToken : undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(workplaceId)) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const result = await verifyWorkplace({ workplaceId, qrToken, lat, lng });
  return NextResponse.json(result);
}
