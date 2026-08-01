import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/session";
import { getPayslip } from "@/features/payroll/service";
import { getCompanyProfile as getCompany } from "@/features/company/service";
import { PayslipDocument, type PayslipCompany } from "@/features/payroll/payslip-document";
import type { PayrollLineItem } from "@/features/payroll/types";

export const metadata: Metadata = { title: "สลิปเงินเดือน" };

export default async function PayslipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?redirect=/payslip/${id}`);

  let record;
  try {
    record = await getPayslip(session.companyId, session, id);
  } catch {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-muted-foreground">
        ไม่พบสลิปนี้ หรือคุณไม่มีสิทธิ์เข้าถึง
      </div>
    );
  }

  const company = await getCompany(session.companyId);

  const h = await headers();
  const host = h.get("host") ?? "gv-hr.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const verifyUrl = `${proto}://${host}/verify/payslip/${id}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });

  const companyProps: PayslipCompany = {
    name: company.name,
    legalName: company.legalName,
    taxId: company.taxId,
    logoUrl: company.logoUrl,
    signatureUrl: company.signatureUrl,
    stampUrl: company.stampUrl,
    addressLine: company.addressLine,
    subDistrict: company.subDistrict,
    district: company.district,
    province: company.province,
    postalCode: company.postalCode,
    phone: company.phone,
  };

  return (
    <PayslipDocument
      slip={{
        id: record.id,
        periodLabel: record.periodLabel,
        earnings: record.earnings as unknown as PayrollLineItem[],
        deductions: record.deductions as unknown as PayrollLineItem[],
        gross: record.gross,
        totalDeductions: record.totalDeductions,
        net: record.net,
        status: record.status,
        employee: {
          employeeCode: record.employee.employeeCode,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
        },
      }}
      company={companyProps}
      qr={qr}
      verifyUrl={verifyUrl}
    />
  );
}
