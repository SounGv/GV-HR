import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { MeetingResponseStatus, MeetingStatus } from "./types";

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: "กำหนดการแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

const STATUS_TONE: Record<MeetingStatus, StatusTone> = {
  SCHEDULED: "success",
  CANCELLED: "neutral",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={MEETING_STATUS_LABEL[status]} />;
}

export const RESPONSE_STATUS_LABEL: Record<MeetingResponseStatus, string> = {
  PENDING: "รอตอบรับ",
  ACCEPTED: "ตอบรับแล้ว",
  DECLINED: "ปฏิเสธ",
};

const RESPONSE_TONE: Record<MeetingResponseStatus, StatusTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
};

export function ResponseStatusBadge({ status }: { status: MeetingResponseStatus }) {
  return <StatusChip tone={RESPONSE_TONE[status]} label={RESPONSE_STATUS_LABEL[status]} />;
}
