import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { BadRequest, NotFound } from "@/lib/api/errors";
import { getGemini, isAiConfigured, getModelCandidates, isModelFallbackError, withGeminiRetry } from "@/lib/ai/client";
import { jsonSchemaToGemini } from "@/lib/ai/tools";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/format";

export const runtime = "nodejs";

const bodySchema = z.object({
  scope: z.enum(["employee", "team", "department", "company"]),
  targetId: z.string().uuid().optional(),
  instruction: z.string().trim().max(2000).optional(),
});

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
          description: { type: "string", description: "นิยาม/สิ่งที่คาดหวังของหัวข้อนี้" },
          weight: { type: "number", description: "น้ำหนักความสำคัญ 1-5" },
        },
        required: ["name", "description", "weight"],
        additionalProperties: false,
      },
    },
    focus: { type: "string", description: "จุดเน้นของการประเมินรอบนี้" },
    rationale: { type: "string", description: "เหตุผลสั้น ๆ ว่าทำไมจึงเลือกเกณฑ์เหล่านี้" },
  },
  required: ["competencies", "focus", "rationale"],
  additionalProperties: false,
} as const;

type DesignerDraft = {
  competencies: { name: string; description: string; weight: number }[];
  focus: string;
  rationale: string;
};

async function buildContext(companyId: string, scope: string, targetId?: string) {
  if (scope === "employee") {
    if (!targetId) throw BadRequest("กรุณาเลือกพนักงาน");
    const emp = await prisma.employee.findFirst({
      where: { id: targetId, companyId, deletedAt: null },
      select: {
        firstName: true,
        lastName: true,
        employmentType: true,
        department: { select: { name: true } },
        position: { select: { title: true, level: true } },
      },
    });
    if (!emp) throw NotFound("ไม่พบพนักงาน");
    const label = fullName(emp.firstName, emp.lastName);
    return {
      label,
      context: [
        `ขอบเขต: พนักงานรายบุคคล`,
        `พนักงาน: ${label}`,
        `แผนก/ฝ่าย: ${emp.department?.name ?? "-"}`,
        `ตำแหน่ง: ${emp.position?.title ?? "-"}${emp.position?.level ? ` (ระดับ ${emp.position.level})` : ""}`,
        `ประเภทการจ้าง: ${emp.employmentType}`,
      ].join("\n"),
    };
  }

  if (scope === "team") {
    const managerId = targetId;
    if (!managerId) throw BadRequest("กรุณาเลือกหัวหน้าทีม");
    const manager = await prisma.employee.findFirst({
      where: { id: managerId, companyId, deletedAt: null },
      select: { firstName: true, lastName: true },
    });
    if (!manager) throw NotFound("ไม่พบหัวหน้าทีม");
    const reports = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, managerId },
      select: { position: { select: { title: true } } },
    });
    const label = `ทีมของ ${fullName(manager.firstName, manager.lastName)}`;
    const positions = [...new Set(reports.map((r) => r.position?.title).filter(Boolean))];
    return {
      label,
      context: [
        `ขอบเขต: ทีม`,
        `หัวหน้าทีม: ${fullName(manager.firstName, manager.lastName)}`,
        `จำนวนสมาชิกในทีม: ${reports.length}`,
        `ตำแหน่งในทีม: ${positions.join(", ") || "-"}`,
      ].join("\n"),
    };
  }

  if (scope === "department") {
    const departmentId = targetId;
    if (!departmentId) throw BadRequest("กรุณาเลือกแผนก");
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
      select: { name: true },
    });
    if (!dept) throw NotFound("ไม่พบแผนก");
    const headcount = await prisma.employee.count({ where: { companyId, deletedAt: null, departmentId } });
    return {
      label: dept.name,
      context: [`ขอบเขต: แผนก`, `แผนก: ${dept.name}`, `จำนวนพนักงานในแผนก: ${headcount}`].join("\n"),
    };
  }

  // company
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
      "คุณคือผู้เชี่ยวชาญด้าน HR ที่ออกแบบเกณฑ์การประเมินผลงาน (competency) สำหรับแคมเปญประเมินผล " +
      "สร้างหัวข้อประเมินที่วัดผลได้จริง เจาะจงกับขอบเขตที่ระบุ หลีกเลี่ยงหัวข้อกว้าง ๆ ที่ใช้ไม่ได้จริง ตอบเป็นภาษาไทย";

    const userPrompt = [
      "ออกแบบเกณฑ์การประเมินผลงานสำหรับขอบเขตนี้:",
      "",
      context,
      "",
      instruction ? `คำสั่งเพิ่มเติมจาก HR: ${instruction}` : "ไม่มีคำสั่งเพิ่มเติม ให้ออกแบบตามมาตรฐานทั่วไปที่เหมาะสม",
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
        const response = await withGeminiRetry(() => model.generateContent(userPrompt));
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
