import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, replyLineMessage } from "@/lib/integrations/line";

export const runtime = "nodejs";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

/**
 * LINE Messaging API webhook — authenticates itself via the `x-line-signature`
 * HMAC header (checked against LINE_CHANNEL_SECRET), not a session cookie,
 * since LINE's servers call this directly. Allowlisted as public in
 * middleware.ts for that reason, same as the CRON_SECRET-gated routes.
 *
 * Only handles the "link this LINE account to my employee record" flow: the
 * employee generates a short code on their Profile page, then sends it as a
 * plain text message to the company's LINE OA here.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(rawBody) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ ok: true }); // malformed body — ack anyway, nothing to do
  }

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;
    const code = event.message.text?.trim().toUpperCase();
    if (!lineUserId || !code) continue;

    const employee = await prisma.employee.findFirst({
      where: { lineLinkCode: code, lineLinkCodeExpiresAt: { gt: new Date() }, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      if (replyToken) {
        await replyLineMessage(replyToken, "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาสร้างรหัสใหม่จากหน้าโปรไฟล์ในระบบ GV One แล้วส่งมาอีกครั้ง");
      }
      continue;
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { lineUserId, lineLinkCode: null, lineLinkCodeExpiresAt: null },
    });
    if (replyToken) {
      await replyLineMessage(replyToken, "เชื่อมต่อบัญชี LINE สำเร็จ! ต่อจากนี้คุณจะได้รับการแจ้งเตือนจากระบบ GV One ทาง LINE ด้วย");
    }
  }

  return NextResponse.json({ ok: true });
}
