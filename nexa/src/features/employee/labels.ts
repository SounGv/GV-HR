import type { EmployeeStatus, EmploymentType } from "./types";

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: "ปฏิบัติงาน",
  ON_LEAVE: "ลางาน",
  SUSPENDED: "พักงาน",
  TERMINATED: "เลิกจ้าง",
  RESIGNED: "ลาออก",
};

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "พนักงานประจำ",
  PART_TIME: "พาร์ทไทม์",
  CONTRACT: "สัญญาจ้าง",
  INTERN: "ฝึกงาน",
  PROBATION: "ทดลองงาน",
};

export const GENDER_LABEL: Record<string, string> = {
  MALE: "ชาย",
  FEMALE: "หญิง",
  OTHER: "อื่น ๆ",
};

export const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "โสด",
  MARRIED: "สมรส",
  DIVORCED: "หย่าร้าง",
  WIDOWED: "หม้าย",
};
