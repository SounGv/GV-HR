import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { getBranch } from "@/features/branch/service";
import { AppError } from "@/lib/api/errors";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "QR เช็คอินสาขา" };

export default async function BranchQrPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("admin:read");
  const { id } = await params;

  const branch = await getBranch(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  const qr = await QRCode.toDataURL(`NEXA-CHECKIN:${branch.id}`, { margin: 1, width: 480 });

  return (
    <div className="space-y-4 print:space-y-0">
      <Link
        href="/branches"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4" /> กลับไปสาขา
      </Link>
      <Card className="mx-auto max-w-md print:border-none print:shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR เช็คอิน ${branch.name}`} width={320} height={320} className="rounded-lg" />
          <div>
            <p className="text-lg font-semibold text-foreground">{branch.name}</p>
            <p className="text-sm text-muted-foreground">{branch.code}</p>
            {branch.address && <p className="mt-1 text-sm text-muted-foreground">{branch.address}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            สแกน QR นี้ในหน้าเช็คอิน/เช็คเอาท์ของแอป NEXA เพื่อยืนยันตำแหน่งโดยไม่ต้องใช้ GPS
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
