"use client";

import Link from "next/link";
import { Stethoscope, Landmark, History, ChevronRight, BarChart3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { useMedicalSummary } from "@/features/expense/hooks";
import { useLoanEligibility } from "@/features/company-loan/hooks";

/** The "สวัสดิการ" landing — one shared component for desktop (a grid of
 * cards) and mobile (big stacked cards), matching the spec's mobile mockup
 * almost verbatim. Every number here is live (useMedicalSummary /
 * useLoanEligibility), never hardcoded. */
export function BenefitsHubView() {
  const { can } = useAuth();
  const canApprove = can("expense:approve");
  const { data: medicalData, isLoading: medicalLoading } = useMedicalSummary();
  const { data: loanData, isLoading: loanLoading } = useLoanEligibility();
  const medical = medicalData?.data;
  const loan = loanData?.data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card className="gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-icon-chip-bg text-icon-chip-fg">
            <Stethoscope className="size-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-lg font-semibold text-foreground">ค่ารักษาพยาบาล</p>
            <p className="text-sm text-muted-foreground">วงเงินค่ารักษาพยาบาล</p>
          </div>
        </div>

        {medicalLoading || !medical ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <div>
            <p className="text-3xl font-bold text-foreground">
              {medical.cap.toLocaleString()} <span className="text-base font-normal text-muted-foreground">บาท</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ใช้ไปแล้ว {medical.approved.toLocaleString()} บาท
              {medical.pending > 0 && <> · รออนุมัติ {medical.pending.toLocaleString()} บาท</>}
            </p>
            <p className="text-base font-semibold text-primary">เหลือ {medical.remaining.toLocaleString()} บาทที่ยื่นได้</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button className="h-[52px] flex-1 text-base" render={<Link href="/benefits/medical/new" />}>
            ยื่นเบิกค่ารักษา
          </Button>
          <Button variant="outline" className="h-[52px] flex-1 text-base" render={<Link href="/benefits/medical" />}>
            ดูประวัติ
          </Button>
        </div>
      </Card>

      <Card className="gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-icon-chip-bg text-icon-chip-fg">
            <Landmark className="size-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-lg font-semibold text-foreground">กู้เงินบริษัท</p>
            <p className="text-sm text-muted-foreground">สิทธิ์กู้เงินบริษัท</p>
          </div>
        </div>

        {loanLoading || !loan ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : (
          <div>
            <p className="text-3xl font-bold text-foreground">
              สูงสุด {loan.maxLoanAmount.toLocaleString()} <span className="text-base font-normal text-muted-foreground">บาท</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              สถานะ: <span className="font-medium text-foreground">{loan.eligible ? "มีสิทธิ์" : "ยังไม่มีสิทธิ์"}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              ใช้สิทธิ์ปีนี้: <span className="font-medium text-foreground">{loan.usedThisYear ? "ใช้ไปแล้ว" : "ยังไม่ได้ใช้"}</span>
            </p>
          </div>
        )}

        <Button className="h-[52px] w-full text-base" render={<Link href="/benefits/loans/new" />}>
          ยื่นกู้เงินบริษัท
        </Button>
      </Card>

      <Card className="flex-row items-center gap-3 p-4 sm:col-span-2">
        <Link href="/benefits/history" className="flex flex-1 items-center gap-3 rounded-lg p-1 hover:bg-muted">
          <span className="flex size-9 items-center justify-center rounded-xl bg-icon-chip-bg text-icon-chip-fg">
            <History className="size-[18px]" strokeWidth={2.5} />
          </span>
          <span className="flex-1 text-base font-semibold text-foreground">ประวัติสวัสดิการของฉัน</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        {canApprove && (
          <Link href="/benefits/report" className="flex flex-1 items-center gap-3 rounded-lg p-1 hover:bg-muted">
            <span className="flex size-9 items-center justify-center rounded-xl bg-icon-chip-bg text-icon-chip-fg">
              <BarChart3 className="size-[18px]" strokeWidth={2.5} />
            </span>
            <span className="flex-1 text-base font-semibold text-foreground">รายงานสวัสดิการ (HR/Admin)</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}
      </Card>
    </div>
  );
}
