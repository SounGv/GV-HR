import { z } from "zod";
import { EMPLOYMENT_TYPES } from "@/features/employee/schema";
import { dataUrlFileOrHttpUrlSchema } from "@/lib/image-schema";

export const JOB_STATUSES = ["OPEN", "CLOSED"] as const;
export const CANDIDATE_STAGES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), inner.optional());

export const jobCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุตำแหน่ง").max(200),
  departmentId: optional(z.string().uuid()),
  description: optional(z.string().trim().max(2000)),
  location: optional(z.string().trim().max(120)),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  openings: z.coerce.number().int().min(1).default(1),
  status: z.enum(JOB_STATUSES).default("OPEN"),
});
export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export const jobUpdateSchema = jobCreateSchema.partial();
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;

export const jobListQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export const candidateCreateSchema = z.object({
  jobPostingId: z.string().uuid("กรุณาเลือกตำแหน่ง"),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(200),
  email: optional(z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง")),
  phone: optional(z.string().trim().max(30)),
  note: optional(z.string().trim().max(1000)),
  resumeUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), dataUrlFileOrHttpUrlSchema()),
  stage: z.enum(CANDIDATE_STAGES).default("APPLIED"),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;
export const candidateUpdateSchema = candidateCreateSchema.partial().omit({ jobPostingId: true });
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;

export const candidateListQuerySchema = z.object({
  jobPostingId: optional(z.string().uuid()),
  stage: z.enum(CANDIDATE_STAGES).optional(),
});
