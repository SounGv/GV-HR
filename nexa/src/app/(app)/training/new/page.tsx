import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CourseFormPage } from "@/features/training/course-form-page";

export const metadata: Metadata = { title: "สร้างหลักสูตร" };

export default async function NewCoursePage() {
  await requirePagePermission("training:create");
  return <CourseFormPage />;
}
