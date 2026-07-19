import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@db/index";
import { aiDraftReviews, employees } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";
import { getAnthropicClient, extractJson, AiNotConfiguredError } from "@/lib/anthropic";

interface DraftResult {
  overall: string;
  strengths: string[];
  improvements: string[];
  development: string[];
  summary: string;
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["manager", "hr"]);
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  const employeeId = Number(body?.employeeId);
  if (!employeeId) {
    return NextResponse.json({ error: "กรุณาเลือกพนักงาน" }, { status: 400 });
  }

  const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!emp) {
    return NextResponse.json({ error: "ไม่พบพนักงานนี้" }, { status: 404 });
  }

  const scores = body?.scores || "ไม่มีข้อมูลคะแนนเพิ่มเติม";

  const prompt =
    "คุณเป็นหัวหน้างานมืออาชีพที่กำลังเขียนความเห็นประเมินผลงานประจำรอบให้พนักงาน. ข้อมูลพนักงาน: ชื่อ " +
    emp.name +
    ", แผนก " +
    emp.department +
    ", คะแนน/ผลงาน: " +
    scores +
    '. เขียนความเห็นอย่างสร้างสรรค์ เป็นกลาง ให้กำลังใจ และนำไปใช้ได้จริง. ตอบเป็น JSON ล้วนๆ ไม่มีข้อความอื่น รูปแบบ: {"overall":"ระดับผลงานโดยรวมสั้นๆ","strengths":["จุดแข็ง1","จุดแข็ง2","จุดแข็ง3"],"improvements":["สิ่งที่ควรพัฒนา1","สิ่งที่ควรพัฒนา2"],"development":["ข้อเสนอการพัฒนา/อบรม1","ข้อเสนอการพัฒนา2"],"summary":"สรุปภาพรวม 2-3 ประโยค"}. ใช้ภาษาไทยทั้งหมด.';

  try {
    const client = getAnthropicClient();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = extractJson<DraftResult>(text);
    if (!parsed || !parsed.strengths) {
      return NextResponse.json({ error: "ไม่สามารถร่างความเห็นได้ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }

    const [saved] = await db
      .insert(aiDraftReviews)
      .values({
        employeeId,
        overall: parsed.overall,
        strengths: parsed.strengths,
        improvements: parsed.improvements,
        development: parsed.development,
        summary: parsed.summary,
        createdBy: session.employeeId,
      })
      .returning();

    return NextResponse.json({ ok: true, draft: saved });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    console.error(err);
    return NextResponse.json({ error: "ไม่สามารถร่างความเห็นได้ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
