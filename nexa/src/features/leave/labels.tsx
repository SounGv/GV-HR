import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { LeaveStatus, LeaveType } from "./types";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: "ลาพักร้อน",
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  UNPAID: "ลาไม่รับค่าจ้าง",
  OTHER: "อื่น ๆ",
  HOLIDAY_SWAP: "ใช้สิทธิ์วันหยุด",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};

const STATUS_TONE: Record<LeaveStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={LEAVE_STATUS_LABEL[status]} />;
}
