import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "ออฟไลน์" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-foreground">ออฟไลน์อยู่ในขณะนี้</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          ดูเหมือนอุปกรณ์ของคุณไม่ได้เชื่อมต่ออินเทอร์เน็ต NEXA
          ต้องการการเชื่อมต่อเพื่อดึงข้อมูลล่าสุด ลองใหม่อีกครั้งเมื่อออนไลน์
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        ลองอีกครั้ง
      </Link>
    </div>
  );
}
