import type { LeaveTypeKey, ReportTab, RequestStatus, TabKey } from "./types";

export const statusMeta: Record<
  RequestStatus,
  { th: string; bg: string; fg: string; dot: string }
> = {
  Pending: { th: "รออนุมัติ", bg: "#fff7e6", fg: "#b7791f", dot: "#f59e0b" },
  Approved: { th: "อนุมัติแล้ว", bg: "#e7f8f0", fg: "#0f9d6e", dot: "#10b981" },
  Rejected: { th: "ไม่อนุมัติ", bg: "#fdecec", fg: "#d64545", dot: "#ef4444" },
  Cancelled: { th: "ยกเลิก", bg: "#f1f2f5", fg: "#7b7d8c", dot: "#9aa0ab" },
};

export const requestIconMap: Record<LeaveTypeKey, { icon: string; bg: string; fg: string }> = {
  annual: { icon: "beach_access", bg: "#eef7cc", fg: "#17181c" },
  sick: { icon: "sick", bg: "#e7f8f0", fg: "#0f9d6e" },
  personal: { icon: "event_busy", bg: "#fff7e6", fg: "#b7791f" },
  unpaid: { icon: "money_off", bg: "#f1f2f5", fg: "#7b7d8c" },
  ot: { icon: "more_time", bg: "#eef7cc", fg: "#3a3c46" },
  correction: { icon: "edit_calendar", bg: "#fdeee4", fg: "#e8590c" },
};

export const leaveTypeName: Record<LeaveTypeKey, string> = {
  annual: "ลาพักร้อน",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  unpaid: "ลาไม่รับค่าจ้าง",
  ot: "ทำงานล่วงเวลา",
  correction: "ขอแก้ไขเวลา",
};

export const leaveTypeDefs: {
  key: LeaveTypeKey;
  label: string;
  en: string;
  icon: string;
  bg: string;
  color: string;
}[] = [
  { key: "annual", label: "ลาพักร้อน", en: "Annual", icon: "beach_access", bg: "#eef7cc", color: "#17181c" },
  { key: "sick", label: "ลาป่วย", en: "Sick", icon: "sick", bg: "#e7f8f0", color: "#0f9d6e" },
  { key: "personal", label: "ลากิจ", en: "Personal", icon: "event_busy", bg: "#fff7e6", color: "#b7791f" },
  { key: "unpaid", label: "ลาไม่รับค่าจ้าง", en: "Unpaid", icon: "money_off", bg: "#f1f2f5", color: "#7b7d8c" },
  { key: "ot", label: "ทำงานล่วงเวลา", en: "Overtime", icon: "more_time", bg: "#eef7cc", color: "#3a3c46" },
  { key: "correction", label: "ขอแก้ไขเวลา", en: "Correction", icon: "edit_calendar", bg: "#fdeee4", color: "#e8590c" },
];

export const aiDeptDefs = ["บริหาร", "ฝ่ายขาย", "การตลาด", "คลังสินค้า", "บัญชี", "จัดซื้อ", "บริการลูกค้า", "ไอที"];

export const reportMeta: Record<ReportTab, { c: string; bg: string }> = {
  attendance: { c: "#0f9d6e", bg: "#e7f8f0" },
  leave: { c: "#3a3c46", bg: "#eef7cc" },
  finance: { c: "#0f766e", bg: "#e3f4f1" },
};

export const moreMenuDefs = [
  { key: "aieval", label: "AI ช่วยประเมิน", sub: "ออกแบบเกณฑ์ · ร่างผลประเมิน", icon: "auto_awesome", bg: "#eef7cc", color: "#17181c", roles: ["manager", "hr"] },
  { key: "holidays", label: "วันหยุดบริษัท", sub: "กำหนดโดย HR · แจ้งเตือน", icon: "event", bg: "#eef7cc", color: "#17181c", roles: ["employee", "manager", "hr"] },
  { key: "reports", label: "รายงาน (HR · บัญชี)", sub: "เวลางาน · การลา · การเงิน", icon: "summarize", bg: "#eef7cc", color: "#17181c", roles: ["manager", "hr"] },
  { key: "perf", label: "ผลการปฏิบัติงาน", sub: "KPI · สมรรถนะ · IDP", icon: "trending_up", bg: "#e7f8f0", color: "#0f9d6e", roles: ["employee", "manager", "hr"] },
  { key: "leave", label: "การลา", sub: "ขอลา · วันลาคงเหลือ", icon: "beach_access", bg: "#eef7cc", color: "#17181c", roles: ["employee", "manager", "hr"] },
  { key: "calendar", label: "ปฏิทินบริษัท", sub: "วันหยุด · กิจกรรม", icon: "calendar_month", bg: "#fff7e6", color: "#b7791f", roles: ["employee", "manager", "hr"] },
  { key: "docs", label: "เอกสาร", sub: "สลิป · หนังสือรับรอง", icon: "folder", bg: "#fdeee4", color: "#e8590c", roles: ["employee", "manager", "hr"] },
  { key: "notifs", label: "การแจ้งเตือน", sub: "ทั้งหมด", icon: "notifications", bg: "#f1f2f5", color: "#5a5d6b", roles: ["employee", "manager", "hr"] },
  { key: "settings", label: "ตั้งค่า", sub: "บัญชี · ภาษา · ความเป็นส่วนตัว", icon: "settings", bg: "#f1f2f5", color: "#5a5d6b", roles: ["employee", "manager", "hr"] },
] as const;

export const tabDefs: { key: TabKey; icon: string; label: string }[] = [
  { key: "home", icon: "home", label: "หน้าหลัก" },
  { key: "attendance", icon: "schedule", label: "เวลางาน" },
  { key: "requests", icon: "assignment", label: "คำขอ" },
  { key: "payroll", icon: "payments", label: "เงินเดือน" },
  { key: "more", icon: "grid_view", label: "เพิ่มเติม" },
];
