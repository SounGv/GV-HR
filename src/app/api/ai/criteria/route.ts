import { NextResponse } from "next/server";
import { db } from "@db/index";
import { aiCriteriaTemplates } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";
import { getAnthropicClient, extractJson, AiNotConfiguredError } from "@/lib/anthropic";

interface CriteriaResult {
  summary: string;
  competencies: { name: string; weight: number; indicators: string[] }[];
  kpis: { name: string; weight: number; target: string }[];
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["manager", "hr"]);
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  const department = body?.department as string;
  const role = (body?.role as string) || "";
  if (!department) {
    return NextResponse.json({ error: "กรุณาเลือกแผนก" }, { status: 400 });
  }

  const prompt =
    'คุณเป็นผู้เชี่ยวชาญด้านการบริหารทรัพยากรบุคคล ออกแบบเกณฑ์ประเมินผลงานพนักงานสำหรับแผนก "' +
    department +
    '"' +
    (role ? ' ตำแหน่ง "' + role + '"' : "") +
    " ของบริษัทค้าปลีกอุปกรณ์ไอที Gadget Villa. ตอบกลับเป็น JSON ล้วนๆ ไม่มีข้อความอื่น รูปแบบ: " +
    '{"summary":"สรุปแนวทางประเมินสั้นๆ 1 ประโยค","competencies":[{"name":"ชื่อสมรรถนะ","weight":ตัวเลข,"indicators":["พฤติกรรมชี้วัด1","พฤติกรรมชี้วัด2"]}],"kpis":[{"name":"ชื่อ KPI","weight":ตัวเลข,"target":"เป้าหมายที่วัดได้"}]}. ' +
    "ให้มี competencies 3 รายการ และ kpis 3-4 รายการ ที่เหมาะกับแผนกนี้โดยเฉพาะ. น้ำหนัก (weight) ของทุกรายการรวมกันต้องเท่ากับ 100 พอดี. ใช้ภาษาไทยทั้งหมด.";

  try {
    const client = getAnthropicClient();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = extractJson<CriteriaResult>(text);
    if (!parsed || !parsed.competencies || !parsed.kpis) {
      return NextResponse.json({ error: "ไม่สามารถสร้างเกณฑ์ได้ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
    }

    const [saved] = await db
      .insert(aiCriteriaTemplates)
      .values({
        department,
        role: role || null,
        summary: parsed.summary,
        competencies: parsed.competencies,
        kpis: parsed.kpis,
        createdBy: session.employeeId,
      })
      .returning();

    return NextResponse.json({ ok: true, criteria: saved });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    console.error(err);
    return NextResponse.json({ error: "ไม่สามารถสร้างเกณฑ์ได้ กรุณาลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
