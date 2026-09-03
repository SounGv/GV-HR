import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { BadRequest, NotFound } from "@/lib/api/errors";
import { getAnthropic, isAiConfigured, AI_MODEL } from "@/lib/ai/client";
import { prisma } from "@/lib/prisma";
import { aiTemplateDesignerRequestSchema } from "@/features/evaluation-template/schema";

export const runtime = "nodejs";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "ชื่อแบบประเมิน" },
    description: { type: "string", description: "คำอธิบายสั้น ๆ ของแบบประเมินนี้" },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "ชื่อหมวด" },
          questions: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "ข้อคำถาม" },
                helpText: { type: "string", description: "คำอธิบาย/ตัวอย่างพฤติกรรม" },
                answerType: {
                  type: "string",
                  enum: ["NUMERIC", "LETTER", "CHOICE", "YES_NO", "LONG_TEXT"],
                },
                options: {
                  type: "array",
                  description: "ใช้เมื่อ answerType เป็น LETTER หรือ CHOICE เท่านั้น — แต่ละตัวเลือกมีความหมาย (label) และคะแนน (score)",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      score: { type: "number" },
                    },
                    required: ["label", "score"],
                    additionalProperties: false,
                  },
                },
                weight: { type: "number", description: "น้ำหนักความสำคัญ 1-5" },
                required: { type: "boolean" },
              },
              required: ["text", "answerType", "weight", "required"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "questions"],
        additionalProperties: false,
      },
    },
    rationale: { type: "string", description: "เหตุผลสั้น ๆ ว่าทำไมจึงออกแบบแบบประเมินนี้" },
  },
  required: ["name", "description", "sections", "rationale"],
  additionalProperties: false,
} as const;

const CRITIQUE_OUTPUT_SCHEMA = {
  ...OUTPUT_SCHEMA,
  properties: {
    findings: {
      type: "array",
      description: "ข้อสังเกต/คำแนะนำสั้น ๆ ทีละข้อ เกี่ยวกับแบบประเมินที่ HR ร่างไว้ (เช่น คำถามคลุมเครือ, ขาดหมวดสำคัญ, น้ำหนักไม่สมดุล)",
      items: { type: "string" },
      minItems: 1,
      maxItems: 8,
    },
    ...OUTPUT_SCHEMA.properties,
  },
  required: ["findings", ...OUTPUT_SCHEMA.required],
} as const;

type DesignerDraft = {
  name: string;
  description: string;
  sections: {
    name: string;
    questions: {
      text: string;
      helpText?: string;
      answerType: "NUMERIC" | "LETTER" | "CHOICE" | "YES_NO" | "LONG_TEXT";
      options?: { label: string; score: number }[];
      weight: number;
      required: boolean;
    }[];
  }[];
  rationale: string;
};

type CritiqueDraft = DesignerDraft & { findings: string[] };

async function buildContext(companyId: string, scope: "department" | "company", targetId?: string) {
  if (scope === "department") {
    if (!targetId) throw BadRequest("กรุณาเลือกแผนก");
    const dept = await prisma.department.findFirst({
      where: { id: targetId, companyId, deletedAt: null },
      select: { name: true },
    });
    if (!dept) throw NotFound("ไม่พบแผนก");
    const headcount = await prisma.employee.count({ where: { companyId, deletedAt: null, departmentId: targetId } });
    return {
      label: dept.name,
      context: [`ขอบเขต: แผนก`, `แผนก: ${dept.name}`, `จำนวนพนักงานในแผนก: ${headcount}`].join("\n"),
    };
  }

  // Sequential, not Promise.all — connection_limit=1.
  const headcount = await prisma.employee.count({ where: { companyId, deletedAt: null } });
  const departments = await prisma.department.findMany({ where: { companyId, deletedAt: null }, select: { name: true }, take: 30 });
  return {
    label: "ทั้งบริษัท",
    context: [
      `ขอบเขต: ทั้งบริษัท`,
      `จำนวนพนักงานทั้งหมด: ${headcount}`,
      `แผนกทั้งหมด: ${departments.map((d) => d.name).join(", ") || "-"}`,
    ].join("\n"),
  };
}

function draftToPromptText(draft: { name: string; description?: string; sections: { name: string; questions: { text: string; helpText?: string; answerType: string; weight: number; required: boolean }[] }[] }) {
  const lines = [`ชื่อ: ${draft.name}`, draft.description ? `รายละเอียด: ${draft.description}` : ""];
  for (const s of draft.sections) {
    lines.push(`- หมวด "${s.name}"`);
    for (const q of s.questions) {
      lines.push(`  - [${q.answerType}${q.required ? ", บังคับตอบ" : ""}, น้ำหนัก ${q.weight}] ${q.text}${q.helpText ? ` (${q.helpText})` : ""}`);
    }
  }
  return lines.filter(Boolean).join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const { mode, scope, targetId, instruction, draft: existingDraft } = aiTemplateDesignerRequestSchema.parse(await request.json());
    const isCritique = mode === "critique";
    if (isCritique && !existingDraft) throw BadRequest("ต้องมีแบบร่างเพื่อให้ AI ช่วยตรวจสอบ");

    const { label, context } = await buildContext(session.companyId, scope, targetId);

    if (!isAiConfigured()) {
      return ok({ target: { scope, label }, draft: null, findings: null, configured: false });
    }

    const system = isCritique
      ? "คุณคือผู้เชี่ยวชาญด้าน HR ที่ตรวจสอบแบบประเมินผลการปฏิบัติงานที่ HR ร่างไว้แล้ว ให้ข้อสังเกต/คำแนะนำสั้น ๆ ทีละข้อ (findings) " +
        "เช่น คำถามคลุมเครือ ขาดหมวดสำคัญ น้ำหนักไม่สมดุล ตัวเลือกซ้ำซ้อนหรือความหมายไม่ชัดเจน จากนั้นปรับปรุงแบบประเมินตามข้อเสนอแนะของคุณเองแล้วส่งกลับเป็นชุดข้อมูลที่ปรับปรุงแล้วทั้งหมด " +
        "(คงโครงสร้างเดิมไว้ให้มากที่สุดเท่าที่สมเหตุสมผล แก้เฉพาะจุดที่มีปัญหาจริง ไม่ต้องรื้อใหม่ทั้งหมดถ้าของเดิมใช้ได้ดีอยู่แล้ว) " +
        "แต่ละคำถามต้องเลือกรูปแบบคำตอบที่เหมาะสม (NUMERIC=คะแนนตัวเลข 1-5, LETTER=ตัวอักษร A-D, CHOICE=ตัวเลือกความหมาย, YES_NO=ใช่/ไม่ใช่, LONG_TEXT=ข้อความเปิด) ตอบเป็นภาษาไทย"
      : "คุณคือผู้เชี่ยวชาญด้าน HR ที่ออกแบบแบบประเมินผลการปฏิบัติงาน (evaluation form) แบบมีหมวดและข้อคำถาม " +
        "แต่ละคำถามต้องเลือกรูปแบบคำตอบที่เหมาะสม (NUMERIC=คะแนนตัวเลข 1-5, LETTER=ตัวอักษร A-D, " +
        "CHOICE=ตัวเลือกความหมาย เช่น ดี/พอใช้/ต้องปรับปรุง, YES_NO=ใช่/ไม่ใช่, LONG_TEXT=ข้อความเปิดสำหรับข้อเสนอแนะ) " +
        "ระบุตัวเลือกและคะแนนของแต่ละตัวเลือกเมื่อ answerType เป็น LETTER หรือ CHOICE เท่านั้น " +
        "เจาะจงกับขอบเขตที่ระบุ ตอบเป็นภาษาไทย";

    const userPrompt = isCritique
      ? [
          "ช่วยตรวจสอบแบบประเมินผลการปฏิบัติงานฉบับร่างนี้ สำหรับขอบเขตนี้:",
          "",
          context,
          "",
          "แบบร่างปัจจุบันจาก HR:",
          draftToPromptText(existingDraft!),
          "",
          instruction ? `คำสั่งเพิ่มเติมจาก HR: ${instruction}` : "ไม่มีคำสั่งเพิ่มเติม",
        ].join("\n")
      : [
          "ออกแบบแบบประเมินผลการปฏิบัติงานสำหรับขอบเขตนี้:",
          "",
          context,
          "",
          instruction ? `คำสั่งเพิ่มเติมจาก HR: ${instruction}` : "ไม่มีคำสั่งเพิ่มเติม ให้ออกแบบตามมาตรฐานทั่วไปที่เหมาะสม เช่น พฤติกรรมการทำงาน การขาดลามาสาย ความรับผิดชอบ คุณภาพงาน และข้อเสนอแนะเพื่อพัฒนา",
        ].join("\n");

    const outputSchema = isCritique ? CRITIQUE_OUTPUT_SCHEMA : OUTPUT_SCHEMA;
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system,
      tools: [{ name: "submit_template", description: "Submit the designed evaluation template.", input_schema: outputSchema as unknown as Anthropic.Tool.InputSchema }],
      tool_choice: { type: "tool", name: "submit_template" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    const draft = (toolUse?.type === "tool_use" ? (toolUse.input as DesignerDraft | CritiqueDraft) : null);

    const findings = isCritique && draft ? (draft as CritiqueDraft).findings : null;

    return ok({ target: { scope, label }, draft, findings, configured: true });
  } catch (error) {
    return handleApiError(error);
  }
}
