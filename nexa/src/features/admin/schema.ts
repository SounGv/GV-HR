import { z } from "zod";
import { ALL_PERMISSION_KEYS } from "@/config/permissions";

const permissionKey = z.string().refine((k) => ALL_PERMISSION_KEYS.includes(k), {
  message: "สิทธิ์ไม่ถูกต้อง",
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อบทบาท").max(60),
  description: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
  permissions: z.array(permissionKey).default([]),
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
  permissions: z.array(permissionKey).optional(),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

export const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;

export const setAiAccessGrantSchema = z.object({
  scope: z.enum(["TEAM", "DEPARTMENT", "COMPANY"]),
});
export type SetAiAccessGrantInput = z.infer<typeof setAiAccessGrantSchema>;
