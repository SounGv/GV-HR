/**
 * What staff read for the five built-in roles. The stored names stay in English because permission code matches on them
 * (see config/permissions.ts); this is display only. A custom role shows the name HR typed.
 */
const SYSTEM_ROLE_LABEL: Record<string, string> = {
  "Super Admin": "ผู้ดูแลระบบสูงสุด",
  "HR Manager": "ฝ่ายบุคคล",
  Manager: "หัวหน้า",
  Finance: "การเงิน",
  Employee: "พนักงาน",
};

export const roleLabel = (name: string): string => SYSTEM_ROLE_LABEL[name] ?? name;
