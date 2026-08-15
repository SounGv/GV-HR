import type { EmployeeDocumentType } from "./types";

export const EMPLOYEE_DOCUMENT_TYPE_LABEL: Record<EmployeeDocumentType, string> = {
  ID_CARD: "บัตรประชาชน",
  DEGREE: "วุฒิการศึกษา",
  CONTRACT: "สัญญาจ้าง",
  WORK_PERMIT: "ใบอนุญาตทำงาน",
  OTHER: "อื่นๆ",
};
