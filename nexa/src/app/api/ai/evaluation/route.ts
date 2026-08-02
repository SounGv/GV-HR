import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { NotFound } from "@/lib/api/errors";
import { getGemini, isAiConfigured, getModelCandidates, isModelFallbackError } from "@/lib/ai/client";
import { jsonSchemaToGemini } from "@/lib/ai/tools";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/format";

export const runtime = "nodejs";

const bodySchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  instruction: z.string().trim().max(2000).optional(),
});

/** JSON schema that constrains the model to return usable, role-specific criteria. */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    competencies: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "ชื่อหัวข้อประเมินสั้นกระชับ" },
          description: { type: "string", description: "นิยาม/สิ่งที่คาดหวังของหัวข้อนี้ต่อบทบาทนี้" },
          weight: { type: "number", description: "น้ำหนักความสำคัญ 1-5" },
        },
        required: ["name", "description", "weight"],
        additionalProperties: false,
      },
    },
    focus: { type: "string", description: "จุดเน้นของการประเมินรอบนี้ตามบทบาทและสายงาน" },
    rationale: { type: "string", description: "เหตุผลสั้น ๆ ว่าทำไมจึงเลือกเกณฑ์เหล่านี้" },
  },
  required: ["competencies", "focus", "rationale"],
  additionalProperties: false,
} as const;

type EvaluationDraft = {
  competencies: { name: string; description: string; weight: number }[];
  focus: string;
  rationale: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("performance:create");

    const { employeeId, instruction } = bodySchema.parse(await request.json());

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: session.companyId, deletedAt: null },
      select: {
        firstName: true,
        lastName: true,
        employmentType: true,
        department: { select: { name: true } },
        position: { select: { title: true, level: true } },
        performanceReviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { cycle: true, band: true, overallScore: true },
        },
      },
    });
    if (!emp) throw NotFound("ไม่พบพนักงาน");

    const employee = {
      name: fullName(emp.firstName, emp.lastName),
      department: emp.department?.name ?? "-",
      position: emp.position?.title ?? "-",
      level: emp.position?.level ?? null,
    };

    if (!isAiConfigured()) {
      return ok({ employee, draft: null, configured: false });
    }

    const context = [
      `พนักงาน: ${employee.name}`,
      `แผนก/ฝ่าย: ${employee.department}`,
      `ตำแหน่ง: ${employee.position}${employee.level ? ` (ระดับ ${employee.level})` : ""}`,
      `ประเภทการจ้าง: ${emp.employmentType}`,
      emp.performanceReviews[0]
        ? `ผลประเมินล่าสุด: รอบ ${emp.performanceReviews[0].cycle} ระดับ ${emp.performanceReviews[0].band ?? "-"} คะแนน ${emp.performanceReviews[0].overallScore ?? "-"}`
        : "ยังไม่เคยมีผลประเมิน",
    ].join("\n");

    const system =
      "คุณคือผู้เชี่ยวชาญด้าน HR ที่ออกแบบเกณฑ์การประเมินผลงาน (competency) ให้ตรงกับบทบาทและสายงานของพนักงานแต่ละคน " +
      "สร้างหัวข้อประเมินที่วัดผลได้จริง เจาะจงกับหน้าที่ของตำแหน่งนั้น หลีกเลี่ยงหัวข้อกว้าง ๆ ที่ใช้กับทุกคน ตอบเป็นภาษาไทย";

    const userPrompt = [
      "ออกแบบเกณฑ์การประเมินผลงานสำหรับพนักงานคนนี้:",
      "",
      context,
      "",
      instruction ? `คำสั่งเพิ่มเติมจาก HR: ${instruction}` : "ไม่มีคำสั่งเพิ่มเติม ให้ออกแบบตามมาตรฐานของตำแหน่งนี้",
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
            maxOutputTokens: 2048,
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

    let draft: EvaluationDraft | null = null;
    try {
      draft = JSON.parse(text) as EvaluationDraft;
    } catch {
      draft = null;
    }

    return ok({ employee, draft, configured: true });
  } catch (error) {
    return handleApiError(error);
  }
}
