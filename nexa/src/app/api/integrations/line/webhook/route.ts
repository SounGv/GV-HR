import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, replyLineMessage } from "@/lib/integrations/line";

export const runtime = "nodejs";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string };
  message?: { type: string; text?: string };
}

/**
 * LINE Messaging API webhook — authenticates itself via the `x-line-signature`
 * HMAC header (checked against LINE_CHANNEL_SECRET), not a session cookie,
 * since LINE's servers call this directly. Allowlisted as public in
 * middleware.ts for that reason, same as the CRON_SECRET-gated routes.
 *
 * Handles two things:
 * 1. "Link this LINE account to my employee record" — the employee generates
 *    a short code on their Profile page, then sends it as a plain text
 *    message to the company's LINE OA here.
 * 2. Group membership tracking — records a group's id when the bot is
 *    invited (`join`) and marks it inactive when kicked (`leave`), so
 *    lib/integrations/line-group-broadcast.ts has somewhere to push to.
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
    // เดิม: link-account flow (ข้อความ 6 หลัก) — ไม่แก้ logic ภายใน
    if (event.type === "message" && event.message?.type === "text") {
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
      continue;
    }

    // ใหม่: บอทถูกเชิญเข้ากลุ่ม — เก็บ groupId ไว้ใช้ broadcast
    // หมายเหตุ: ไม่รู้ companyId จาก event ตรงๆ (LINE ไม่ส่งมาให้) — ระบบนี้
    // เป็น single-company deployment จึงดึงบริษัทแรก/บริษัทเดียวที่มีอยู่มาผูกไปก่อน
    // ถ้าต้องรองรับ multi-tenant จริงในอนาคตต้องออกแบบวิธีระบุ company ใหม่
    // (เช่น ให้ HR ยืนยันจากหน้า Settings แทน auto-save)
    if (event.type === "join" && event.source?.type === "group") {
      const groupId = event.source.groupId;
      if (groupId) {
        const company = await prisma.company.findFirst({ select: { id: true } });
        if (company) {
          await prisma.lineGroupTarget.upsert({
            where: { groupId },
            create: { companyId: company.id, groupId, purpose: "hr-alerts", active: true },
            update: { active: true },
          });
        }
      }
      continue;
    }

    // ใหม่: บอทถูกไล่ออกจากกลุ่ม — ปิดการส่งไปกลุ่มนั้น (soft, ไม่ลบ record)
    if (event.type === "leave" && event.source?.type === "group") {
      const groupId = event.source.groupId;
      if (groupId) {
        await prisma.lineGroupTarget.updateMany({
          where: { groupId },
          data: { active: false },
        });
      }
      continue;
    }
  }

  return NextResponse.json({ ok: true });
}
