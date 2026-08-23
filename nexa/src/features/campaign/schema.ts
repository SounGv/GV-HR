import { z } from "zod";

const competencyWeightSchema = z.object({
  competencyId: z.string().uuid(),
  weight: z.coerce.number().int().min(1, "1-5").max(5, "1-5"),
});

const raterTypesSchema = z
  .array(z.enum(["SELF", "MANAGER", "PEER", "UPWARD", "HR_EXEC"]))
  .min(1, "ต้องเลือกทิศทางการประเมินอย่างน้อย 1 แบบ");

const campaignCreateBaseSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแคมเปญ").max(200),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบการประเมิน").max(40),
  startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
  endDate: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุด"),
  acknowledgeDueDate: z.string().optional(),
  followUpDate: z.string().optional(),
  raterTypes: raterTypesSchema.default(["SELF", "MANAGER"]),
  // Mutually exclusive — a campaign either scores against the new Evaluation
  // Template (Section -> Question) or the legacy Competency list, never both.
  templateId: z.string().uuid().optional(),
  competencies: z.array(competencyWeightSchema).optional(),
  aiGenerated: z.boolean().optional(),
  aiRationale: z.string().max(2000).optional(),
  // "สร้างรอบใหม่จากรอบเดิม" lineage — set by cloneCampaign, never by the
  // client directly (not part of the create form).
  clonedFromId: z.string().uuid().optional(),
});

export const campaignCreateSchema = campaignCreateBaseSchema.refine(
  (v) => !!v.templateId || (v.competencies && v.competencies.length > 0),
  { message: "ต้องเลือกแบบประเมิน (Template) หรือสมรรถนะอย่างน้อย 1 รายการ", path: ["competencies"] },
);
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cycle: z.string().trim().min(1).max(40).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  acknowledgeDueDate: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
  raterTypes: raterTypesSchema.optional(),
  competencies: z.array(competencyWeightSchema).min(1).optional(),
});
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const campaignListQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
});
export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;

/** "สร้างรอบใหม่จากรอบเดิม" — see cloneCampaign in service.ts. */
export const cloneCampaignSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อรอบใหม่").max(200),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบการประเมิน").max(40),
  startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
  endDate: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุด"),
  acknowledgeDueDate: z.string().optional(),
  followUpDate: z.string().optional(),
  // Which of the source campaign's competency categories to bring along —
  // omitted/empty means "all". Only meaningful for the legacy Competency
  // path; a Template-based source is always cloned in full (the template
  // itself is versioned, not filtered question-by-question).
  categoryIds: z.array(z.string().uuid()).optional(),
  raterTypes: raterTypesSchema.optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
});
export type CloneCampaignInput = z.infer<typeof cloneCampaignSchema>;

export const evaluationThresholdsSchema = z
  .object({
    evalThresholdUrgentMax: z.coerce.number().min(0).max(100),
    evalThresholdWatchMax: z.coerce.number().min(0).max(100),
    evalThresholdGoodMin: z.coerce.number().min(0).max(100),
  })
  .refine((v) => v.evalThresholdUrgentMax < v.evalThresholdWatchMax, {
    message: "เกณฑ์ 'ต้องแก้ไขเร่งด่วน' ต้องน้อยกว่าเกณฑ์ 'ต้องติดตาม'",
    path: ["evalThresholdWatchMax"],
  })
  .refine((v) => v.evalThresholdWatchMax < v.evalThresholdGoodMin, {
    message: "เกณฑ์ 'ต้องติดตาม' ต้องน้อยกว่าเกณฑ์ 'ดี/ดีเยี่ยม'",
    path: ["evalThresholdGoodMin"],
  });
export type EvaluationThresholdsInput = z.infer<typeof evaluationThresholdsSchema>;

export const addParticipantsSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกพนักงานอย่างน้อย 1 คน"),
});
export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;

export const submitResponseSchema = z
  .object({
    // Legacy Competency-based path.
    scores: z
      .array(z.object({ competencyId: z.string().uuid(), score: z.coerce.number().min(1, "1-5").max(5, "1-5") }))
      .optional(),
    // New Template-based path — value is an option value (resolved to a
    // score server-side) or free text for LONG_TEXT questions.
    answers: z.array(z.object({ questionId: z.string(), value: z.string().max(2000) })).optional(),
    strengths: z.string().max(1000).optional(),
    improvements: z.string().max(1000).optional(),
    summary: z.string().max(1000).optional(),
    evidenceUrls: z.array(z.string()).max(3, "แนบหลักฐานได้สูงสุด 3 ไฟล์").optional(),
  })
  .refine((v) => (v.scores && v.scores.length > 0) || (v.answers && v.answers.length > 0), {
    message: "กรุณาตอบคำถามอย่างน้อย 1 ข้อ",
    path: ["answers"],
  });
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

export const inviteRaterSchema = z.object({
  raterType: z.enum(["PEER", "UPWARD", "HR_EXEC"]),
  raterEmployeeId: z.string().uuid(),
});
export type InviteRaterInput = z.infer<typeof inviteRaterSchema>;

export const aiDesignerRequestSchema = z.object({
  scope: z.enum(["employee", "team", "department", "company"]),
  targetId: z.string().uuid().optional(),
  instruction: z.string().max(2000).optional(),
});
export type AiDesignerRequest = z.infer<typeof aiDesignerRequestSchema>;
