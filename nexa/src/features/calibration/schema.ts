import { z } from "zod";

export const calibrationSessionCreateSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().trim().min(1, "กรุณาระบุชื่อรอบปรับเทียบ").max(200),
});
export type CalibrationSessionCreateInput = z.infer<typeof calibrationSessionCreateSchema>;

/** The five labels scoreBand() can return: a calibrated band must be one of them. */
export const CALIBRATION_BANDS = ["ดีเยี่ยม", "ดี", "ปานกลาง", "ต้องพัฒนา", "ต้องปรับปรุงเร่งด่วน"] as const;

export const calibrationParticipantUpdateSchema = z.object({
  calibratedScore: z.coerce.number().min(1, "1-5").max(5, "1-5").optional(),
  calibratedBand: z.enum(CALIBRATION_BANDS, { error: "ระดับผลประเมินไม่ถูกต้อง" }).optional(),
  potential: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  potentialNote: z.string().max(1000).optional(),
});
export type CalibrationParticipantUpdateInput = z.infer<typeof calibrationParticipantUpdateSchema>;

export const nineBoxQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
});
export type NineBoxQuery = z.infer<typeof nineBoxQuerySchema>;
