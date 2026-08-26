import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/lib/api/errors";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { getGemini, isAiConfigured, getModelCandidates, isModelFallbackError, withGeminiRetry } from "@/lib/ai/client";
import { executeTool, toGeminiTools } from "@/lib/ai/tools";
import { resolveAiAccess, employeeScopeWhere } from "@/lib/ai/scope";
import { prisma } from "@/lib/prisma";
import { loginIdentifier } from "@/lib/format";

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
    "คุณคือ AI Assistant ผู้ช่วยอัจฉริยะสำหรับงาน HR และ Payroll ภายในระบบ GV One",
    `บริษัท: ${companyName} | ผู้ใช้ปัจจุบัน: ${userName} | วันที่วันนี้: ${today}`,
    "",
    "หลักการทำงาน:",
    "1) ยึดข้อมูลจริงเสมอ — เมื่อผู้ใช้ถามเรื่องพนักงาน การขาด/ลา เงินเดือน OT ประเมินผล หรือประกาศ ให้เรียกใช้ฟังก์ชัน (function) เพื่อดึงข้อมูลจริงจากฐานข้อมูลของบริษัทก่อนตอบ ห้ามเดาหรือกุตัวเลขขึ้นเอง",
    "2) การคำนวณเงินเดือน ภาษี ประกันสังคม หรือเงินสุทธิ ให้ใช้ฟังก์ชัน calculate_payroll เท่านั้น ห้ามคำนวณเอง",
    "3) การสั่งงาน — คุณสามารถส่งการแจ้งเตือน (send_notification) และเผยแพร่ประกาศ (create_announcement) ได้ ก่อนดำเนินการที่ส่งถึงคนจำนวนมากหรือเผยแพร่สาธารณะ ให้สรุปสิ่งที่จะทำและถามยืนยันจากผู้ใช้ก่อนหนึ่งครั้ง",
    "4) สิทธิ์ — หากฟังก์ชันแจ้งว่าไม่ได้รับอนุญาต ให้บอกผู้ใช้อย่างสุภาพว่าไม่มีสิทธิ์ ไม่ต้องพยายามหลบเลี่ยง",
    "5) การประเมิน — เมื่อผู้ใช้ขอให้ตั้งแบบประเมิน ให้ใช้ get_employee_context เพื่อดึงฝ่าย/สายงาน/ตำแหน่งของบุคคลนั้น แล้วออกแบบเกณฑ์ให้ตรงกับหน้าที่จริง",
    "6) ค้นเว็บ — ใช้ web_search เฉพาะเมื่อคำถามไม่เกี่ยวกับข้อมูลภายในบริษัท (เช่น กฎหมายแรงงาน, วันหยุดราชการ, ความรู้ทั่วไปด้าน HR) ห้ามใช้ถามเรื่องพนักงาน/เวลาทำงาน/เงินเดือน/ประกาศของบริษัทนี้ เมื่อใช้ผลจาก web_search ต้องบอกผู้ใช้ชัดเจนว่าข้อมูลนี้มาจากอินเทอร์เน็ต ไม่ใช่จากระบบภายในบริษัท พร้อมระบุแหล่งที่มา (ชื่อเว็บไซต์/ลิงก์)",
    "",
    "ตอบเป็นภาษาไทยกระชับ ชัดเจน มีตัวเลขและที่มาของข้อมูลเมื่อเกี่ยวข้อง",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const access = await resolveAiAccess(session);
    if (!access.allowed) throw Forbidden();
    const scopeWhere = await employeeScopeWhere(session, access.scope);
    const { messages: input } = bodySchema.parse(await request.json());

    if (!isAiConfigured()) {
      return ok({
        reply:
          "ขออภัย ระบบ AI Assistant ยังไม่ได้ตั้งค่า API key (GEMINI_API_KEY) จึงยังใช้งานไม่ได้ในขณะนี้ กรุณาแจ้งผู้ดูแลระบบเพื่อเปิดใช้งาน",
        steps: [] as Step[],
        configured: false,
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    });
    const today = new Date().toISOString().slice(0, 10);
    const system = buildSystemPrompt(company?.name ?? "-", loginIdentifier(session), today);
    const meta = getRequestMeta(request);

    const genAI = getGemini();
    // All but the last message become chat history; the last is the new turn.
    const history = input.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = input[input.length - 1].content;

    let lastErr: unknown = null;
    for (const modelName of getModelCandidates()) {
      const steps: Step[] = [];
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: system,
          tools: [{ functionDeclarations: toGeminiTools() }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
        });
        // Manage the contents array ourselves so function results are sent with
        // role "user" (newer Gemini models reject role "function").
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contents: any[] = [...history, { role: "user", parts: [{ text: lastMessage }] }];

        let reply = "";
        for (let i = 0; i < MAX_STEPS; i++) {
          const result = await withGeminiRetry(() => model.generateContent({ contents }));
          const calls = result.response.functionCalls();
          if (!calls || calls.length === 0) {
            try {
              reply = result.response.text().trim();
            } catch {
              reply = "";
            }
            break;
          }
          // Record the model's function-call turn, then answer it with a user turn.
          const modelParts = result.response.candidates?.[0]?.content?.parts ?? [];
          contents.push({ role: "model", parts: modelParts });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const respParts: any[] = [];
          for (const call of calls) {
            steps.push({ tool: call.name, detail: describeTool(call.name, call.args) });
            const out = await executeTool(session, call.name, call.args as Record<string, unknown>, meta, scopeWhere);
            respParts.push({ functionResponse: { name: call.name, response: { result: out } } });
          }
          contents.push({ role: "user", parts: respParts });
        }

        if (!reply) reply = "ขออภัย ยังไม่สามารถประมวลผลคำขอได้ กรุณาปรับคำถามแล้วลองใหม่อีกครั้ง";
        return ok({ reply, steps, configured: true });
      } catch (aiErr) {
        lastErr = aiErr;
        // Model unavailable / no quota for this key → try the next candidate.
        if (isModelFallbackError(aiErr)) continue;
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        return ok({ reply: `⚠️ เกิดข้อผิดพลาดจาก AI (Gemini):\n${msg.slice(0, 600)}`, steps, configured: true });
      }
    }

    const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    return ok({
      reply: `⚠️ ไม่พบโมเดล Gemini ที่คีย์นี้ใช้ได้ (ลองหลายรุ่นแล้ว)\n${lastMsg.slice(0, 500)}`,
      steps: [],
      configured: true,
    });
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
    case "web_search":
      return `ค้นเว็บภายนอก: "${String(i.query ?? "")}"`;
    default:
      return name;
  }
}
