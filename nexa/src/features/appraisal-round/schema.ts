import { z } from "zod";

const RATERS = ["SELF", "MANAGER", "PEER", "SUBORDINATE"] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const roundCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อรอบ").max(200),
});

export const roundUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  formId: z.string().min(1).optional(),
  raterTypes: z.array(z.enum(RATERS)).max(4).optional(),
  perspectiveWeights: z.record(z.enum(RATERS), z.number().int().min(0).max(100)).optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  remind: z.boolean().optional(),
  notifyLine: z.boolean().optional(),
  participantIds: z.array(z.string().min(1)).max(2000).optional(),
  /** employeeId -> form id (null = the round's own form). Only people already in the round are changed. */
  participantForms: z.record(z.string().min(1), z.string().min(1).nullable()).optional(),
});

export const answersSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), value: z.unknown() })).max(200),
  submit: z.boolean().default(false),
});

export type RoundUpdateInput = z.infer<typeof roundUpdateSchema>;

export const settingsSchema = z.object({
  calcMode: z.enum(["WEIGHTED", "SIMPLE"]),
  bands: z.array(z.object({ label: z.string().trim().min(1).max(60), minPercent: z.number().min(0).max(100) })).max(10),
  approvalLevels: z.number().int().min(0).max(1),
  employeeSees: z.enum(["NEVER", "AFTER_PUBLISH"]),
  ackRequired: z.boolean(),
  ackDays: z.number().int().min(1).max(90).nullable(),
});

export const publishSchema = z.object({ participantIds: z.array(z.string().min(1)).max(2000).optional() });
