import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { getGemini, isAiConfigured, AI_MODEL } from "@/lib/ai/client";
import { executeTool, toGeminiTools } from "@/lib/ai/tools";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

const MAX_STEPS = 6;

/** Activity surfaced to the UI so the user sees how the AI grounded its answer. */
type Step = { tool: string; detail: string };

function buildSystemPrompt(companyName: string, userName: string, today: string): string {
  return [
    "คุณคือ NEXA AI ผู้ช่วยอัจฉริยะสำหรับงาน HR และ Payroll ภายในระบบ NEXA",
    `บริษัท: ${companyName} | ผู้ใช้ปัจจุบัน: ${userName} | วันที่วันนี้: ${today}`,
    "",
    "หลักการทำงาน:",
    "1) ยึดข้อมูลจริงเสมอ — เมื่อผู้ใช้ถามเรื่องพนักงาน การขาด/ลา เงินเดือน OT ประเมินผล หรือประกาศ ให้เรียกใช้ฟังก์ชัน (function) เพื่อดึงข้อมูลจริงจากฐานข้อมูลของบริษัทก่อนตอบ ห้ามเดาหรือกุตัวเลขขึ้นเอง",
    "2) การคำนวณเงินเดือน ภาษี ประกันสังคม หรือเงินสุทธิ ให้ใช้ฟังก์ชัน calculate_payroll เท่านั้น ห้ามคำนวณเอง",
    "3) การสั่งงาน — คุณสามารถส่งการแจ้งเตือน (send_notification) และเผยแพร่ประกาศ (create_announcement) ได้ ก่อนดำเนินการที่ส่งถึงคนจำนวนมากหรือเผยแพร่สาธารณะ ให้สรุปสิ่งที่จะทำและถามยืนยันจากผู้ใช้ก่อนหนึ่งครั้ง",
    "4) สิทธิ์ — หากฟังก์ชันแจ้งว่าไม่ได้รับอนุญาต ให้บอกผู้ใช้อย่างสุภาพว่าไม่มีสิทธิ์ ไม่ต้องพยายามหลบเลี่ยง",
    "5) การประเมิน — เมื่อผู้ใช้ขอให้ตั้งแบบประเมิน ให้ใช้ get_employee_context เพื่อดึงฝ่าย/สายงาน/ตำแหน่งของบุคคลนั้น แล้วออกแบบเกณฑ์ให้ตรงกับหน้าที่จริง",
    "",
    "ตอบเป็นภาษาไทยกระชับ ชัดเจน มีตัวเลขและที่มาของข้อมูลเมื่อเกี่ยวข้อง",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("ai:read");
    const { messages: input } = bodySchema.parse(await request.json());

    if (!isAiConfigured()) {
      return ok({
        reply:
          "ขออภัย ระบบ NEXA AI ยังไม่ได้ตั้งค่า API key (GEMINI_API_KEY) จึงยังใช้งานไม่ได้ในขณะนี้ กรุณาแจ้งผู้ดูแลระบบเพื่อเปิดใช้งาน",
        steps: [] as Step[],
        configured: false,
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    });
    const today = new Date().toISOString().slice(0, 10);
    const system = buildSystemPrompt(company?.name ?? "-", session.email, today);
    const meta = getRequestMeta(request);

    const genAI = getGemini();
    const model = genAI.getGenerativeModel({
      model: AI_MODEL,
      systemInstruction: system,
      tools: [{ functionDeclarations: toGeminiTools() }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    });

    // All but the last message become chat history; the last is the new turn.
    const history = input.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({ history });

    const steps: Step[] = [];
    let result = await chat.sendMessage(input[input.length - 1].content);

    for (let i = 0; i < MAX_STEPS; i++) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;
      const parts = [];
      for (const call of calls) {
        steps.push({ tool: call.name, detail: describeTool(call.name, call.args) });
        const out = await executeTool(session, call.name, call.args as Record<string, unknown>, meta);
        parts.push({ functionResponse: { name: call.name, response: { result: out } } });
      }
      result = await chat.sendMessage(parts);
    }

    let reply = "";
    try {
      reply = result.response.text().trim();
    } catch {
      reply = "";
    }
    if (!reply) {
      reply = "ขออภัย ยังไม่สามารถประมวลผลคำขอได้ กรุณาปรับคำถามแล้วลองใหม่อีกครั้ง";
    }

    return ok({ reply, steps, configured: true });
  } catch (error) {
    return handleApiError(error);
  }
}

function describeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "get_headcount":
      return "ดึงสรุปจำนวนพนักงาน";
    case "get_hr_report":
      return `ดึงรายงาน: ${String(i.type ?? "")}${i.period ? ` (${i.period})` : ""}`;
    case "search_employees":
      return `ค้นหาพนักงาน: ${String(i.query ?? "")}`;
    case "get_employee_context":
      return `ดึงข้อมูลพนักงาน: ${String(i.query ?? "")}`;
    case "list_recent_announcements":
      return "ดึงประกาศล่าสุด";
    case "send_notification":
      return `ส่งแจ้งเตือนถึง: ${String(i.target ?? "")}`;
    case "create_announcement":
      return `สร้างประกาศ: ${String(i.title ?? "")}`;
    case "calculate_payroll":
      return `คำนวณเงินเดือน${i.employee ? `: ${String(i.employee)}` : ""}`;
    default:
      return name;
  }
}
