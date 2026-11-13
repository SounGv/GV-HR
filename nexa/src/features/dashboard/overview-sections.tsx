import Link from "next/link";
import type { ReactNode } from "react";
import type { AccessClaims } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { getRoundDepartmentProgress } from "@/features/appraisal-round/service";
import { getOvertimeByDepartment } from "./service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface HBarRow {
  key: string;
  name: string;
  /** Bar length, 0–100. */
  percent: number;
  value: ReactNode;
}

/** One department per row: name, a teal bar to scale, the number in words. Names wrap, never truncate. */
export function HBarList({ rows }: { rows: HBarRow[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(86px,128px)_minmax(0,1fr)_auto] items-center gap-2.5">
          <span className="text-[13.5px] leading-snug [overflow-wrap:anywhere]">{r.name}</span>
          <span className="h-3 overflow-hidden rounded-full bg-[var(--chart-muted-bar)]">
            <span
              className="block h-full rounded-full bg-[var(--series-highlight)]"
              style={{ width: `${Math.max(0, Math.min(100, r.percent))}%` }}
            />
          </span>
          <span className="text-right text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-[13px] text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const SHORT_DATE = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

/** "ความคืบหน้าประเมินรายแผนก": the open round closing soonest, departments with the least done on top. */
export async function EvaluationByDepartmentCard({ companyId, session }: { companyId: string; session: AccessClaims }) {
  const title = "ความคืบหน้าประเมินรายแผนก";
  let round: { id: string; name: string; endDate: Date | null } | null;
  let rows: Awaited<ReturnType<typeof getRoundDepartmentProgress>>;
  try {
    round = await prisma.appraisalRound.findFirst({
      where: { companyId, deletedAt: null, status: "OPEN" },
      select: { id: true, name: true, endDate: true },
      orderBy: [{ endDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
    rows = round ? await getRoundDepartmentProgress(companyId, round.id, session) : [];
  } catch {
    return (
      <SectionCard title={title} hint="โหลดความคืบหน้าไม่สำเร็จ">
        <p className="py-6 text-center text-sm text-muted-foreground">เปิดหน้านี้ใหม่อีกครั้ง ถ้ายังไม่ได้ แจ้งผู้ดูแลระบบ</p>
      </SectionCard>
    );
  }
  if (!round) {
    return (
      <SectionCard title={title} hint="ยังไม่มีรอบประเมินที่เปิดอยู่">
        <p className="py-6 text-center text-sm text-muted-foreground">
          เปิดรอบประเมินได้ที่{" "}
          <Link href="/appraisal/rounds" className="font-semibold text-primary hover:underline">
            รอบประเมิน
          </Link>
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={title}
      hint={
        <>
          <Link href={`/appraisal/rounds/${round.id}`} className="font-medium text-foreground hover:underline">
            {round.name}
          </Link>
          {round.endDate ? ` ปิด ${SHORT_DATE.format(round.endDate)}` : ""} แผนกที่ทำน้อยอยู่บนสุด
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">รอบนี้ยังไม่มีผู้ถูกประเมิน</p>
      ) : (
        <HBarList
          rows={rows.map((r) => ({
            key: r.department,
            name: r.department,
            percent: r.percent,
            value:
              r.submitted === r.total ? (
                <span className="font-semibold text-success">✓ ครบ</span>
              ) : (
                <>
                  <b className="text-foreground">{r.percent}%</b> ({r.submitted}/{r.total})
                </>
              ),
          }))}
        />
      )}
    </SectionCard>
  );
}

/** "OT เดือนนี้รายแผนก": approved hours since the 1st, most first. */
export async function OvertimeByDepartmentCard({ companyId }: { companyId: string }) {
  const title = "OT เดือนนี้รายแผนก";
  let rows: Awaited<ReturnType<typeof getOvertimeByDepartment>>;
  try {
    rows = await getOvertimeByDepartment(companyId);
  } catch {
    return (
      <SectionCard title={title} hint="โหลดข้อมูล OT ไม่สำเร็จ">
        <p className="py-6 text-center text-sm text-muted-foreground">เปิดหน้านี้ใหม่อีกครั้ง ถ้ายังไม่ได้ แจ้งผู้ดูแลระบบ</p>
      </SectionCard>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.hours));
  const total = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  return (
    <SectionCard
      title={title}
      hint={
        rows.length ? (
          <>
            OT ที่อนุมัติแล้วตั้งแต่วันที่ 1 รวม <b className="text-foreground tabular-nums">{total}</b> ชม.
          </>
        ) : (
          "OT ที่อนุมัติแล้วตั้งแต่วันที่ 1"
        )
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มี OT ที่อนุมัติในเดือนนี้</p>
      ) : (
        <HBarList
          rows={rows.map((r) => ({
            key: r.department,
            name: r.department,
            percent: (r.hours / max) * 100,
            value: (
              <>
                <b className="text-foreground">{r.hours}</b> ชม.
              </>
            ),
          }))}
        />
      )}
    </SectionCard>
  );
}
