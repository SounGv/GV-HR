import { z } from "zod";

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(200),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหา").max(5000),
  pinned: z.coerce.boolean().default(false),
  status: z.enum(ANNOUNCEMENT_STATUSES).default("PUBLISHED"),
});
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const announcementUpdateSchema = announcementCreateSchema.partial();
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;

export const announcementListQuerySchema = z.object({
  scope: z.enum(["feed", "manage"]).default("feed"),
});
export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;
