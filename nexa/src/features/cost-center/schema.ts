import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const costCenterCreateSchema = z.object({
  code: z.string().trim().min(1, "กรุณากรอกรหัส").max(30),
  name: z.string().trim().min(1, "กรุณากรอกชื่อศูนย์ต้นทุน").max(120),
  description: z.preprocess(emptyToNull, z.string().trim().max(300).nullable().optional()),
});

export const costCenterUpdateSchema = costCenterCreateSchema.partial();

export type CostCenterCreateInput = z.infer<typeof costCenterCreateSchema>;
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;

export interface CostCenterRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  employeeCount: number;
}
