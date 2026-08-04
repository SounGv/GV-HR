import type { SuccessionReadiness } from "./types";

export const READINESS_LABEL: Record<SuccessionReadiness, string> = {
  READY_NOW: "พร้อมทันที",
  ONE_TO_TWO_YEARS: "1-2 ปี",
  THREE_TO_FIVE_YEARS: "3-5 ปี",
  NOT_READY: "ยังไม่พร้อม",
};

export const READINESS_TONE: Record<SuccessionReadiness, string> = {
  READY_NOW: "bg-success/10 text-success",
  ONE_TO_TWO_YEARS: "bg-info/10 text-info",
  THREE_TO_FIVE_YEARS: "bg-warning/10 text-warning",
  NOT_READY: "bg-muted text-muted-foreground",
};
