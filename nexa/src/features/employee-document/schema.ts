import { z } from "zod";

export const employeeDocumentCreateSchema = z.object({
  type: z.enum(["ID_CARD", "DEGREE", "CONTRACT", "WORK_PERMIT", "OTHER"]),
  label: z.string().trim().min(1, "กรุณาระบุชื่อเอกสาร").max(200),
  // An uploaded file (data URL) or an http(s) link; anything else (e.g. a javascript: string) would become a clickable link.
  fileUrl: z
    .string()
    .min(1, "กรุณาแนบไฟล์")
    .max(5_000_000, "ไฟล์ใหญ่เกินไป")
    .refine(
      (v) =>
        /^https?:\/\//.test(v) ||
        (/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/.test(v) && !/^data:(text\/html|image\/svg\+xml)/i.test(v)),
      "ต้องเป็นไฟล์ที่อัปโหลด หรือลิงก์ http(s) เท่านั้น",
    ),
});
export type EmployeeDocumentCreateInput = z.infer<typeof employeeDocumentCreateSchema>;
