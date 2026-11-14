import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, TriangleAlert } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AI_MODEL, isAiConfigured } from "@/lib/ai/client";
import { engineStatus, recentEngineEvents } from "@/lib/ai/engine";
import { usagePercent } from "@/features/ai/engine-state";

export const metadata: Metadata = { title: "ตั้งค่าน้องวีบอท" };
export const dynamic = "force-dynamic";

const EVENT_TEXT = {
  "down-credit": "AI หลักใช้ไม่ได้ (เครดิตหมด) ระบบสลับเป็นโหมดสำรอง",
  "down-key": "AI หลักเชื่อมต่อไม่ได้ ระบบสลับเป็นโหมดสำรอง",
  up: "AI หลักกลับมาใช้ได้แล้ว",
  "cap-80": "ใช้ AI ไปแล้ว 80% ของเพดานเดือนนี้",
  "cap-100": "ใช้ AI ครบเพดานเดือนนี้ ระบบสลับเป็นโหมดสำรอง",
} as const;

const REASON_TEXT = { credit: "เครดิตของบริการ AI หมด", key: "เชื่อมต่อบริการ AI ไม่ได้", cap: "ใช้ครบเพดานของเดือนนี้" } as const;

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** Read-only for now: the values come from the server's settings, so changing them is done there. */
export default async function AiSettingsPage() {
  const session = await requirePagePermission("employee:update");
  const status = await engineStatus(session.companyId);
  const events = await recentEngineEvents(session.companyId);
  const configured = isAiConfigured();
  const fallback = status.decision.mode === "fallback";
  const percent = usagePercent(status.used, status.cap);

  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่าน้องวีบอท" description="ดูว่าตอนนี้ใครตอบ ใช้ AI ไปเท่าไรในเดือนนี้ และเหตุการณ์ล่าสุด" />
      <Link href="/ai" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> กลับไปหน้าน้องวีบอท
      </Link>

      <section aria-labelledby="engine-now" className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 id="engine-now" className="text-lg font-semibold leading-snug">สถานะตอนนี้</h2>
        {fallback ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full border border-status-late-border bg-status-late-bg px-2.5 py-1 font-medium text-status-late-fg">
              <TriangleAlert className="size-4" aria-hidden="true" /> โหมดสำรอง
            </span>
            <span>{REASON_TEXT[status.decision.mode === "fallback" ? status.decision.reason : "credit"]} ผู้ใช้ยังใช้ปุ่มลัดได้ตามปกติ</span>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
              <CheckCircle2 className="size-4" aria-hidden="true" /> AI พร้อมใช้
            </span>
            <span>{configured ? "น้องวีบอทตอบด้วย AI ตามปกติ" : "ยังไม่ได้ตั้งค่าการเชื่อมต่อ AI ผู้ใช้จึงเห็นโหมดสำรอง"}</span>
          </p>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground">
          เมื่อ AI หลักใช้ไม่ได้ ระบบสลับเป็นโหมดสำรองเอง และกลับมาใช้ AI เองเมื่อพร้อม ผู้ดูแลระบบได้รับแจ้งในกระดิ่งหนึ่งครั้งต่อเหตุการณ์
        </p>
      </section>

      <section aria-labelledby="engine-usage" className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 id="engine-usage" className="text-lg font-semibold leading-snug">การใช้ AI เดือนนี้</h2>
        {status.cap ? (
          <>
            <p className="text-sm tabular-nums">
              ใช้ไป <span className="font-semibold">{status.used}</span> จาก {status.cap} คำถาม ({percent}%)
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)} aria-label="สัดส่วนที่ใช้ของเพดานเดือนนี้">
              <div className="h-full rounded-full bg-[var(--chat-teal)]" style={{ width: `${Math.min(percent, 100)}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">ระบบแจ้งเตือนเมื่อถึง 80% และสลับเป็นโหมดสำรองเมื่อครบ 100%</p>
          </>
        ) : (
          <p className="text-sm">
            ใช้ไป <span className="font-semibold tabular-nums">{status.used}</span> คำถาม ยังไม่ได้ตั้งเพดาน จึงไม่มีการสลับเพราะใช้ครบ
          </p>
        )}
      </section>

      <section aria-labelledby="engine-events" className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 id="engine-events" className="text-lg font-semibold leading-snug">เหตุการณ์ล่าสุด</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีเหตุการณ์ AI หลักทำงานปกติมาตลอด</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="tabular-nums text-muted-foreground">{dateTime.format(e.at)}</span>
                <span>{EVENT_TEXT[e.kind]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="engine-other" className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 id="engine-other" className="text-lg font-semibold leading-snug">AI ฟรีเจ้าอื่น</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
          <input type="checkbox" disabled className="size-5" />
          เปิดใช้ AI เจ้าอื่นเป็นตัวสำรอง (ยังไม่เปิดให้ใช้)
        </label>
        <p className="text-sm leading-relaxed text-muted-foreground">ตอนนี้โหมดสำรองใช้ปุ่มลัดที่ตอบจากข้อมูลในระบบเท่านั้น ข้อมูลไม่ออกนอกระบบ</p>
      </section>

      <details className="rounded-2xl border border-border bg-card p-5 text-sm">
        <summary className="min-h-11 cursor-pointer font-semibold leading-snug">รายละเอียดสำหรับผู้ดูแลระบบ</summary>
        <dl className="mt-3 space-y-2 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">โมเดล AI ที่ใช้</dt>
            <dd className="break-all">{AI_MODEL} (ตัวแปร ANTHROPIC_MODEL)</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">เพดานคำถามต่อเดือน</dt>
            <dd>{status.cap ?? "ไม่ได้ตั้ง"} (ตัวแปร AI_MONTHLY_CAP)</dd>
          </div>
          <p className="leading-relaxed">หน้านี้ยังแก้ค่าไม่ได้ ถ้าต้องการเปลี่ยน ให้ผู้ดูแลแก้ที่ Environment Variables ของโปรเจกต์ใน Vercel แล้วปล่อยเวอร์ชันใหม่ เราจะทำหน้าแก้ค่าในระบบเมื่อเจ้าของอนุมัติให้เพิ่มตารางเก็บค่า</p>
        </dl>
      </details>
    </div>
  );
}
