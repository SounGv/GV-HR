import type { NextRequest } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth/guard";
import { Forbidden } from "@/lib/api/errors";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { getAnthropic, isAiConfigured, AI_MODEL } from "@/lib/ai/client";
import { executeTool, NEXA_TOOLS } from "@/lib/ai/tools";
import { resolveAiAccess, employeeScopeWhere } from "@/lib/ai/scope";
import { prisma } from "@/lib/prisma";
import { loginIdentifier } from "@/lib/format";
import { REPORT_LABELS, type ReportType } from "@/features/report/schema";

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
const MAX_TOKENS = 2048;

/** Activity surfaced to the UI so the user sees how the AI grounded its answer. */
type Step = { tool: string; detail: string; report?: { type: string; period?: string } };

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
    "",
    "รูปแบบคำตอบ — ผู้ใช้คือ HR และหัวหน้างานที่ต้องอ่านแล้วใช้ต่อได้ทันที ตอบตามโครงนี้เสมอ:",
    "1) ย่อหน้าแรก: ตอบคำถามตรงๆ 1-2 ประโยค พร้อมตัวเลขสำคัญ (ใคร กี่ครั้ง กี่วัน) เป็นข้อความธรรมดา แล้วเว้นบรรทัดว่าง 1 บรรทัด",
    "2) ## หัวข้อสั้นๆ ของเรื่อง แล้วตามด้วย ### สรุป เป็นรายการ 3-5 ข้อ แต่ละข้อขึ้นต้นด้วยคำสำคัญตัวหนา เช่น '- **มาสายบ่อยสุด:** สมชาย (ฮอท) 3 ครั้ง'",
    "3) ถ้ามีรายชื่อหลายคน ใส่ ### ตาราง เป็นตาราง Markdown ไม่เกิน 4 คอลัมน์ ไม่เกิน 10 แถว (ถ้าตัดออกให้บอกว่ามีทั้งหมดกี่คน) ใช้ชื่อเล่นหรือชื่อสั้น ไม่ใส่รหัสพนักงานถ้าไม่ได้ถาม",
    "4) ### ควรทำต่อ เป็นรายการ 1-3 ข้อ บอกสิ่งที่ทำได้จริงในระบบ เช่น 'คุยกับสมชายเรื่องมาสาย' 'ตรวจคำขอแก้ไขเวลาที่ค้าง' 'เปิดรายงานการลงเวลาเพื่อดูรายวัน'",
    "5) ข้อควรระวัง (ถ้ามี) 1 ประโยค ขึ้นต้นด้วย ⚠️ ไว้ท้ายสุด",
    "- ห้ามเขียนย่อหน้ายาว ห้ามใช้ศัพท์ระบบหรือชื่อฟิลด์ภาษาอังกฤษ (เช่น present, absent, status) ห้ามอธิบายวิธีคำนวณ เว้นแต่ผู้ใช้ถาม",
    "- คำถามสั้นที่ตอบได้ในประโยคเดียว ตอบแค่ข้อ 1 ไม่ต้องมีหัวข้อหรือตาราง",
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
          "น้องวีบอทยังไม่พร้อมใช้งาน แจ้ง HR ให้เปิดใช้ก่อน",
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

    const anthropic = getAnthropic();
    const messages: Anthropic.MessageParam[] = input.map((m) => ({ role: m.role, content: m.content }));

    const steps: Step[] = [];
    let reply = "";
    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const response = await anthropic.messages.create({
          model: AI_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools: NEXA_TOOLS,
          messages,
        });

        if (response.stop_reason !== "tool_use") {
          reply = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          break;
        }

        messages.push({ role: "assistant", content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const input = (block.input ?? {}) as Record<string, unknown>;
          steps.push({
            tool: block.name,
            detail: describeTool(block.name, block.input),
            // Lets the UI offer "เปิดรายงานเต็ม" straight into the same report.
            ...(block.name === "get_hr_report" && typeof input.type === "string"
              ? { report: { type: input.type, ...(typeof input.period === "string" ? { period: input.period } : {}) } }
              : {}),
          });
          const out = await executeTool(session, block.name, block.input as Record<string, unknown>, meta, scopeWhere);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
        messages.push({ role: "user", content: toolResults });
      }

      if (!reply) reply = "น้องวีบอทตอบคำถามนี้ไม่ได้ ลองถามให้สั้นลง หรือเปลี่ยนคำถาม";
      return ok({ reply, steps, configured: true });
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      // The technical message goes to the server log; staff get a plain next step.
      console.error("[ai/chat] model call failed:", msg.slice(0, 600));
      return ok({ reply: "น้องวีบอทตอบไม่ได้ตอนนี้ ลองถามใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้ง HR", steps, configured: true });
    }
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
      return `ดึงรายงาน: ${REPORT_LABELS[i.type as ReportType] ?? String(i.type ?? "")}${i.period ? ` · ${String(i.period)}` : ""}`;
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
