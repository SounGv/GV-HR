import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";

/** Honest placeholder for modules not yet implemented (linked from the nav). */
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const { title } = await searchParams;
  const label = title || "โมดูลนี้";

  return (
    <div className="space-y-6">
      <PageHeader title={label} description="กำลังพัฒนา" />
      <Card className="border border-border bg-card p-6 md:border-0 md:p-0 md:shadow-none">
        <EmptyState
          icon={Hammer}
          title="เร็วๆ นี้"
          description={`${label} อยู่ระหว่างการพัฒนา และจะเปิดใช้งานในเร็ววันนี้`}
        />
      </Card>
    </div>
  );
}
