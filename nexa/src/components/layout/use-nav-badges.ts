"use client";

import { useAuth } from "@/features/auth/auth-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections } from "@/features/attendance-correction/hooks";
import { useMyPendingAppraisalTasks } from "@/features/appraisal-round/hooks";
import { useNotifications } from "@/features/notification/hooks";
import type { BadgeKey } from "@/config/section-tabs";

/**
 * The live counts shown beside menu entries: requests waiting for this person's approval, their own pending evaluation
 * forms, unread notifications. Same data the mobile bottom nav uses. Used by the side menu and the tab row, so a count
 * is never different between the two (React Query shares the requests).
 */
export function useNavBadges(): (key?: BadgeKey) => number {
  const { canAny } = useAuth();
  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);
  const leavePending = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPending = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const correctionPending = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
  const pendingApprovals = (leavePending.data?.data.length ?? 0) + (otPending.data?.data.length ?? 0) + (correctionPending.data?.data.length ?? 0);
  const pendingReviews = useMyPendingAppraisalTasks().items.length;
  const unreadNotifications = useNotifications().data?.data.unread ?? 0;

  return (key) => {
    if (key === "pendingApprovals") return pendingApprovals;
    if (key === "pendingReviews") return pendingReviews;
    if (key === "unreadNotifications") return unreadNotifications;
    return 0;
  };
}
