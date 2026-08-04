import { z } from "zod";

const competencyWeightSchema = z.object({
  competencyId: z.string().uuid(),
  weight: z.coerce.number().int().min(1, "1-5").max(5, "1-5"),
});

const raterTypesSchema = z
  .array(z.enum(["SELF", "MANAGER"]))
  .min(1, "ต้องเลือกทิศทางการประเมินอย่างน้อย 1 แบบ");

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแคมเปญ").max(200),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบการประเมิน").max(40),
  startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
  endDate: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุด"),
  raterTypes: raterTypesSchema.default(["SELF", "MANAGER"]),
  competencies: z.array(competencyWeightSchema).min(1, "ต้องมีอย่างน้อย 1 สมรรถนะ"),
  aiGenerated: z.boolean().optional(),
  aiRationale: z.string().max(2000).optional(),
});
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cycle: z.string().trim().min(1).max(40).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  raterTypes: raterTypesSchema.optional(),
  competencies: z.array(competencyWeightSchema).min(1).optional(),
});
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const campaignListQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
});
export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;

export const addParticipantsSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกพนักงานอย่างน้อย 1 คน"),
});
export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;

export const submitResponseSchema = z.object({
  scores: z
    .array(z.object({ competencyId: z.string().uuid(), score: z.coerce.number().min(1, "1-5").max(5, "1-5") }))
    .min(1),
  strengths: z.string().max(1000).optional(),
  improvements: z.string().max(1000).optional(),
  summary: z.string().max(1000).optional(),
});
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

export const aiDesignerRequestSchema = z.object({
  scope: z.enum(["employee", "team", "department", "company"]),
  targetId: z.string().uuid().optional(),
  instruction: z.string().max(2000).optional(),
});
export type AiDesignerRequest = z.infer<typeof aiDesignerRequestSchema>;
