import { z } from "zod";
import { COMPETENCIES } from "@/features/performance/calc";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const score = z.coerce.number().min(1, "คะแนนต้องอยู่ระหว่าง 1-5").max(5, "คะแนนต้องอยู่ระหว่าง 1-5");

export const performanceImportRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบ").max(40),
  scores: z.array(score).length(COMPETENCIES.length),
  strengths: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  improvements: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  summary: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
});
export type PerformanceImportRow = z.infer<typeof performanceImportRowSchema>;

export const performanceImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});
