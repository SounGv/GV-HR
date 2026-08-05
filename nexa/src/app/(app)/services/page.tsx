import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ServicesGridView } from "@/features/services/services-grid-view";

export const metadata: Metadata = { title: "บริการ" };

export default async function ServicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ServicesGridView />;
}
