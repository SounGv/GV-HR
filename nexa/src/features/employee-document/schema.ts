import { z } from "zod";

export const employeeDocumentCreateSchema = z.object({
  type: z.enum(["ID_CARD", "DEGREE", "CONTRACT", "WORK_PERMIT", "OTHER"]),
  label: z.string().trim().min(1, "กรุณาระบุชื่อเอกสาร").max(200),
  fileUrl: z.string().min(1, "กรุณาแนบไฟล์").max(5_000_000, "ไฟล์ใหญ่เกินไป"),
});
export type EmployeeDocumentCreateInput = z.infer<typeof employeeDocumentCreateSchema>;
