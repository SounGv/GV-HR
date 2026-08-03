import { z } from "zod";

export const RECOGNITION_TYPES = ["STAR", "AWARD", "HEART", "POINT"] as const;

export const recognitionCreateSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  type: z.enum(RECOGNITION_TYPES),
  points: z.coerce.number().int().min(0).max(10_000).optional(),
  message: z.string().trim().max(500).optional(),
});
export type RecognitionCreateInput = z.infer<typeof recognitionCreateSchema>;

export const recognitionListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
});
export type RecognitionListQuery = z.infer<typeof recognitionListQuerySchema>;
