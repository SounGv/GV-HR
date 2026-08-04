import { z } from "zod";

export const planCreateSchema = z.object({
  positionId: z.string().uuid(),
  incumbentEmployeeId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type PlanCreateInput = z.infer<typeof planCreateSchema>;

export const planUpdateSchema = z.object({
  incumbentEmployeeId: z.string().uuid().nullish(),
  notes: z.string().max(2000).nullish(),
});
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

export const candidateCreateSchema = z.object({
  employeeId: z.string().uuid(),
  readiness: z.enum(["READY_NOW", "ONE_TO_TWO_YEARS", "THREE_TO_FIVE_YEARS", "NOT_READY"]),
  note: z.string().max(1000).optional(),
  rank: z.coerce.number().int().min(1).optional(),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;

export const candidateUpdateSchema = z.object({
  readiness: z.enum(["READY_NOW", "ONE_TO_TWO_YEARS", "THREE_TO_FIVE_YEARS", "NOT_READY"]).optional(),
  note: z.string().max(1000).nullish(),
  rank: z.coerce.number().int().min(1).nullish(),
});
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;
