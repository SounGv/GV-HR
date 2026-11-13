import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { listMyAssignments } from "@/features/appraisal-round/service";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dueText } from "./due-text";

/**
 * Home row 1, "ประเมินที่ต้องทำ": the open rounds where the signed-in person
 * still has forms to fill, with how many are left and how many days remain.
 */
export async function MyEvaluationTasks({ companyId, session }: { companyId: string; session: AccessClaims }) {
  let rows: Awaited<ReturnType<typeof listMyAssignments>>;
  try {
    rows = await listMyAssignments(companyId, session);
  } catch {
    return (
      <Card className="p-4 text-sm text-muted-foreground">โหลดงานประเมินไม่สำเร็จ เปิดหน้านี้ใหม่อีกครั้ง</Card>
    );
  }
  const todayIso = bangkokParts().dateUTC.toISOString().slice(0, 10);
  const byRound = new Map<string, { name: string; endIso: string | null; done: number; total: number }>();
  for (const r of rows) {
    if (r.roundStatus !== "OPEN") continue;
    const cur = byRound.get(r.roundId) ?? { name: r.roundName, endIso: r.endIso, done: 0, total: 0 };
    cur.total++;
    if (r.status === "SUBMITTED") cur.done++;
    byRound.set(r.roundId, cur);
  }
  // Rounds with forms still to fill; a finished round drops off the home screen.
  const rounds = [...byRound.values()].filter((r) => r.done < r.total).sort((a, b) => (a.endIso ?? "9999").localeCompare(b.endIso ?? "9999"));

  if (rounds.length === 0) {
    return (
      <Card className="flex-1 flex-row items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
          <ClipboardCheck className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">✓ ไม่มีงานประเมินค้าง</p>
      </Card>
    );
  }

  return (
    <Card className="flex-1 gap-0 py-1">
      {rounds.slice(0, 3).map((r) => {
        const due = dueText(r.endIso, todayIso);
        return (
          <Link
            key={r.name + r.endIso}
            href="/appraisal/tasks"
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{r.name}</span>
              <span
                className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[var(--chart-muted-bar)]"
                role="img"
                aria-label={`ทำแล้ว ${r.done} จาก ${r.total} คน`}
              >
                <span className="block h-full rounded-full bg-[var(--series-highlight)]" style={{ width: `${(r.done / r.total) * 100}%` }} />
              </span>
              <span className="mt-1 block text-[13px] text-muted-foreground tabular-nums">
                ทำแล้ว <b className="text-foreground">{r.done}</b> จาก {r.total} คน
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[13px] font-semibold",
                due.tone === "late" && "bg-destructive/10 text-destructive",
                due.tone === "soon" && "bg-warning/15 text-foreground",
                due.tone === "ok" && "bg-muted text-muted-foreground",
              )}
            >
              {due.text}
            </span>
          </Link>
        );
      })}
      {rounds.length > 3 && (
        <Link href="/appraisal/tasks" className="px-4 py-2.5 text-sm font-semibold text-primary">
          ดูทั้งหมด {rounds.length} รอบ
        </Link>
      )}
    </Card>
  );
}
