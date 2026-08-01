import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max = 200) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสาขา").max(120),
  code: z.string().trim().min(1, "กรุณากรอกรหัสสาขา").max(30),
  address: optText(300),
  phone: optText(50),
});

export const branchUpdateSchema = branchCreateSchema.partial();

export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;

export interface BranchRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  employeeCount: number;
  hasGeofence: boolean;
}
