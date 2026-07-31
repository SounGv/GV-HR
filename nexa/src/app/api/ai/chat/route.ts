import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { getAnthropic, isAiConfigured, AI_MODEL } from "@/lib/ai/client";
import { NEXA_TOOLS, executeTool } from "@/lib/ai/tools";
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

const MAX_STEPS = 8;

/** Activity surfaced to the UI so the user sees how the AI grounded its answer. */
type Step = { tool: string; detail: string };

function buildSystemPrompt(companyName: string, userName: string, today: string): string {
  return [
    "คุณคือ NEXA AI ผู้ช่วยอัจฉริยะสำหรับงาน HR และ Payroll ภายในระบบ NEXA",
    `บริษัท: ${companyName} | ผู้ใช้ปัจจุบัน: ${userName} | วันที่วันนี้: ${today}`,
    "",
    "หลักการทำงาน:",
    "1) ยึดข้อมูลจริงเสมอ — เมื่อผู้ใช้ถามเรื่องพนักงาน การขาด/ลา เงินเดือน OT ประเมินผล หรือประกาศ ให้เรียกใช้เครื่องมือ (tools) เพื่อดึงข้อมูลจริงจากฐานข้อมูลของบริษัทก่อนตอบ ห้ามเดาหรือกุตัวเลขขึ้นเอง",
    "2) ข้อมูลภายนอก — หากคำถามต้องใช้ข้อมูลจากอินเทอร์เน็ต เช่น กฎหมายแรงงาน อัตราประกันสังคม ข่าวสาร หรือข้อมูลอ้างอิงทั่วไป ให้ใช้ web_search",
    "3) การสั่งงาน — คุณสามารถส่งการแจ้งเตือนถึงพนักงาน (send_notification) และเผยแพร่ประกาศ (create_announcement) ได้ ก่อนดำเนินการที่ส่งถึงคนจำนวนมากหรือเผยแพร่สาธารณะ ให้สรุปสิ่งที่จะทำและถามยืนยันจากผู้ใช้ก่อนหนึ่งครั้ง",
    "4) สิทธิ์ — หากเครื่องมือแจ้งว่าไม่ได้รับอนุญาต ให้บอกผู้ใช้อย่างสุภาพว่าไม่มีสิทธิ์ ไม่ต้องพยายามหลบเลี่ยง",
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
          "ขออภัย ระบบ NEXA AI ยังไม่ได้ตั้งค่า API key (ANTHROPIC_API_KEY) จึงยังใช้งานไม่ได้ในขณะนี้ กรุณาแจ้งผู้ดูแลระบบเพื่อเปิดใช้งาน",
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

    const client = getAnthropic();
    const meta = getRequestMeta(request);

    const messages: Anthropic.MessageParam[] = input.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // web_search is an Anthropic server tool (executed on Anthropic's side); our
    // NEXA_TOOLS are executed here. Cast the mixed array to the SDK's tool union.
    const tools = [
      ...NEXA_TOOLS,
      { type: "web_search_20260209", name: "web_search", max_uses: 5 },
    ] as Anthropic.MessageCreateParamsNonStreaming["tools"];

    const steps: Step[] = [];
    let finalText = "";

    for (let i = 0; i < MAX_STEPS; i++) {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system,
        tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      // Record activity (server web searches + our tool calls) for the UI trace.
      for (const block of response.content) {
        if (block.type === "server_tool_use" && block.name === "web_search") {
          const q = (block.input as { query?: string })?.query;
          steps.push({ tool: "web_search", detail: q ? `ค้นเว็บ: ${q}` : "ค้นเว็บ" });
        }
      }

      if (response.stop_reason === "pause_turn") {
        // Server tool run paused mid-turn; resend accumulated content to continue.
        continue;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          steps.push({ tool: block.name, detail: describeTool(block.name, block.input) });
          const result = await executeTool(session, block.name, block.input, meta);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Terminal stop reason (end_turn, max_tokens, refusal, ...).
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (response.stop_reason === "refusal") {
        finalText =
          finalText || "ขออภัย ไม่สามารถดำเนินการคำขอนี้ได้ กรุณาปรับคำถามแล้วลองใหม่อีกครั้ง";
      }
      break;
    }

    if (!finalText) {
      finalText =
        "ขออภัย ระบบใช้เวลาประมวลผลนานเกินไป กรุณาลองถามใหม่ในรูปแบบที่กระชับขึ้น";
    }

    return ok({ reply: finalText, steps, configured: true });
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
    default:
      return name;
  }
}
