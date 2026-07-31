import { cn } from "@/lib/utils";
import type { CandidateStage, JobStatus } from "./types";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  OPEN: "เปิดรับสมัคร",
  CLOSED: "ปิดรับสมัคร",
};

export const CANDIDATE_STAGE_LABEL: Record<CandidateStage, string> = {
  APPLIED: "สมัครแล้ว",
  SCREENING: "คัดกรอง",
  INTERVIEW: "สัมภาษณ์",
  OFFER: "เสนองาน",
  HIRED: "รับเข้าทำงาน",
  REJECTED: "ไม่ผ่าน",
};

const STAGE_STYLE: Record<CandidateStage, string> = {
  APPLIED: "bg-muted text-muted-foreground",
  SCREENING: "bg-info/10 text-info",
  INTERVIEW: "bg-warning/10 text-warning",
  OFFER: "bg-primary/10 text-primary",
  HIRED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STAGE_STYLE[stage],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {CANDIDATE_STAGE_LABEL[stage]}
    </span>
  );
}
