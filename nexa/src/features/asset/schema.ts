import { z } from "zod";

export const ASSET_STATUSES = ["AVAILABLE", "ASSIGNED", "REPAIR", "RETIRED"] as const;

const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), inner.optional());

export const assetCreateSchema = z.object({
  assetCode: z.string().trim().min(1, "กรุณาระบุรหัสทรัพย์สิน").max(40),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(200),
  category: z.string().trim().min(1, "กรุณาระบุหมวดหมู่").max(60),
  serialNumber: optional(z.string().trim().max(100)),
  status: z.enum(ASSET_STATUSES).default("AVAILABLE"),
  purchaseDate: optional(z.coerce.date()),
  purchasePrice: optional(z.coerce.number().min(0)),
  note: optional(z.string().trim().max(500)),
});
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

export const assetUpdateSchema = assetCreateSchema.partial();
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;

export const assetListQuerySchema = z.object({
  status: z.enum(ASSET_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;

export const assignSchema = z.object({
  employeeId: z.string().uuid().nullable(),
});
export type AssignInput = z.infer<typeof assignSchema>;
