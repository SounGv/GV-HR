import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Timer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { MobileRequestsView } from "@/components/mobile/mobile-requests-view";

export const metadata: Metadata = { title: "คำขอ" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requirePagePermission("leave:read");
  const { view } = await searchParams;

  return (
    <>
      <MobileRequestsView defaultTab={view === "approvals" ? "approvals" : "me"} />
      <div className="hidden space-y-6 md:block">
        <PageHeader title="คำขอ" description="ภาพรวมคำขอลาและ OT — จัดการรายละเอียดที่หน้าการลาและหน้า OT" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/leave">
            <Card className="flex-row items-center gap-3 p-5 transition hover:border-primary/40 hover:shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <CalendarDays className="size-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">การลา</p>
                <p className="text-sm text-muted-foreground">ยื่นคำขอลา ดูโควตา และอนุมัติคำขอของทีม</p>
              </div>
            </Card>
          </Link>
          <Link href="/overtime">
            <Card className="flex-row items-center gap-3 p-5 transition hover:border-primary/40 hover:shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Timer className="size-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">ล่วงเวลา (OT)</p>
                <p className="text-sm text-muted-foreground">ยื่นคำขอ OT และอนุมัติคำขอของทีม</p>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}
