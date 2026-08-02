import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { LeaveFormPage } from "@/features/leave/leave-form-page";

export const metadata: Metadata = { title: "ขอลาใหม่" };

export default async function NewLeavePage() {
  await requirePagePermission("leave:read");
  return <LeaveFormPage />;
}
