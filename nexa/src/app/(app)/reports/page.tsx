import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ReportView } from "@/features/report/report-view";
import { REPORT_LABELS, REPORT_TYPES, type ReportType } from "@/features/report/schema";

type Props = { searchParams: Promise<{ view?: string }> };

function resolveView(view: string | undefined): ReportType {
  return view && (REPORT_TYPES as readonly string[]).includes(view) ? (view as ReportType) : "employees";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { view } = await searchParams;
  return { title: REPORT_LABELS[resolveView(view)] };
}

export default async function ReportsPage({ searchParams }: Props) {
  await requirePagePermission("report:read");
  const { view } = await searchParams;
  const title = REPORT_LABELS[resolveView(view)];

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "รายงานและสื่อสาร" }, { label: title }]}
        title={title}
        description="สรุปข้อมูลจากทุกโมดูล พร้อมส่งออกเป็น CSV"
      />
      <ReportView />
    </div>
  );
}
