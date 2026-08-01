import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyPayslip } from "@/features/payroll/service";

export const metadata: Metadata = { title: "ตรวจสอบสลิปเงินเดือน" };

export default async function VerifyPayslipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await verifyPayslip(id).catch(() => null);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 py-10 text-center">
      {result ? (
        <>
          <div className="flex size-16 items-center justify-center rounded-2xl bg-success/10">
            <CheckCircle2 className="size-9 text-success" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">สลิปเงินเดือนถูกต้อง</h1>
            <p className="text-sm text-muted-foreground">ออกโดยระบบ NEXA HR — เอกสารนี้เป็นของจริง</p>
          </div>
          <div className="w-full max-w-sm divide-y divide-border rounded-2xl border border-border text-left">
            <Row label="บริษัท" value={result.company} />
            <Row label="พนักงาน" value={`${result.name} (${result.employeeCode})`} />
            <Row label="งวด" value={result.period} />
            <Row label="สถานะ" value={result.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง"} />
            <Row
              label="ออกเอกสารเมื่อ"
              value={new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
                new Date(result.issuedAt),
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">รหัสอ้างอิง: {id}</p>
        </>
      ) : (
        <>
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <XCircle className="size-9 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">ไม่พบสลิปนี้</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              ไม่พบข้อมูลสลิปที่ตรงกับรหัสนี้ อาจเป็นเอกสารที่ไม่ถูกต้องหรือถูกยกเลิกแล้ว
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
