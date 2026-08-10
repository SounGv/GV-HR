import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { BadRequest, NotFound } from "@/lib/api/errors";
import { getGemini, isAiConfigured, getModelCandidates, isModelFallbackError } from "@/lib/ai/client";
import { jsonSchemaToGemini } from "@/lib/ai/tools";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  scope: z.enum(["department", "company"]),
  targetId: z.string().uuid().optional(),
  instruction: z.string().trim().max(2000).optional(),
});

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

  const [headcount, departments] = await Promise.all([
    prisma.employee.count({ where: { companyId, deletedAt: null } }),
    prisma.department.findMany({ where: { companyId, deletedAt: null }, select: { name: true }, take: 30 }),
  ]);
  return {
    label: "ทั้งบริษัท",
    context: [
      `ขอบเขต: ทั้งบริษัท`,
      `จำนวนพนักงานทั้งหมด: ${headcount}`,
      `แผนกทั้งหมด: ${departments.map((d) => d.name).join(", ") || "-"}`,
    ].join("\n"),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const { scope, targetId, instruction } = bodySchema.parse(await request.json());

    const { label, context } = await buildContext(session.companyId, scope, targetId);

    if (!isAiConfigured()) {
      return ok({ target: { scope, label }, draft: null, configured: false });
    }

    const system =
      "คุณคือผู้เชี่ยวชาญด้าน HR ที่ออกแบบแบบประเมินผลการปฏิบัติงาน (evaluation form) แบบมีหมวดและข้อคำถาม " +
      "แต่ละคำถามต้องเลือกรูปแบบคำตอบที่เหมาะสม (NUMERIC=คะแนนตัวเลข 1-5, LETTER=ตัวอักษร A-D, " +
      "CHOICE=ตัวเลือกความหมาย เช่น ดี/พอใช้/ต้องปรับปรุง, YES_NO=ใช่/ไม่ใช่, LONG_TEXT=ข้อความเปิดสำหรับข้อเสนอแนะ) " +
      "ระบุตัวเลือกและคะแนนของแต่ละตัวเลือกเมื่อ answerType เป็น LETTER หรือ CHOICE เท่านั้น " +
      "เจาะจงกับขอบเขตที่ระบุ ตอบเป็นภาษาไทย";

    const userPrompt = [
      "ออกแบบแบบประเมินผลการปฏิบัติงานสำหรับขอบเขตนี้:",
      "",
      context,
      "",
      instruction ? `คำสั่งเพิ่มเติมจาก HR: ${instruction}` : "ไม่มีคำสั่งเพิ่มเติม ให้ออกแบบตามมาตรฐานทั่วไปที่เหมาะสม เช่น พฤติกรรมการทำงาน การขาดลามาสาย ความรับผิดชอบ คุณภาพงาน และข้อเสนอแนะเพื่อพัฒนา",
    ].join("\n");

    const genAI = getGemini();
    let text = "";
    let lastErr: unknown = null;
    for (const modelName of getModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: system,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchemaToGemini(OUTPUT_SCHEMA as unknown as Record<string, unknown>),
            maxOutputTokens: 4096,
          },
        });
        const response = await model.generateContent(userPrompt);
        text = response.response.text();
        break;
      } catch (err) {
        lastErr = err;
        if (isModelFallbackError(err)) continue;
        throw err;
      }
    }
    if (!text && lastErr) throw lastErr;

    let draft: DesignerDraft | null = null;
    try {
      draft = JSON.parse(text) as DesignerDraft;
    } catch {
      draft = null;
    }

    return ok({ target: { scope, label }, draft, configured: true });
  } catch (error) {
    return handleApiError(error);
  }
}
