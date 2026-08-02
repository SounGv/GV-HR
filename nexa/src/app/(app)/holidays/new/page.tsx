import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { HolidayFormPage } from "@/features/holiday/holiday-form-page";

export const metadata: Metadata = { title: "เพิ่มวันหยุด" };

export default async function NewHolidayPage() {
  await requirePagePermission("holiday:create");
  return <HolidayFormPage />;
}
