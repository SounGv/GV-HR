"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Grid3x3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { getInitials } from "@/lib/format";

import { useNineBoxGrid } from "./hooks";
import type { NineBoxEmployee, NineBoxTier } from "./types";

const TIERS: NineBoxTier[] = ["HIGH", "MEDIUM", "LOW"];
const PERF_TIERS: NineBoxTier[] = ["LOW", "MEDIUM", "HIGH"];
const TIER_LABEL: Record<NineBoxTier, string> = { LOW: "ต่ำ", MEDIUM: "ปานกลาง", HIGH: "สูง" };

export function NineBoxView() {
  const { data, isLoading, isError, refetch } = useNineBoxGrid();
  const grid = data?.data;

  const total = grid
    ? TIERS.reduce((sum, p) => sum + PERF_TIERS.reduce((s, perf) => s + grid[p][perf].length, 0), 0)
    : 0;

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !grid) return <TableLoadingState rows={4} />;
  if (total === 0) {
    return (
      <EmptyState
        icon={Grid3x3}
        title="ยังไม่มีข้อมูลศักยภาพ"
        description="กำหนดศักยภาพของพนักงานในหน้าปรับเทียบผลประเมินก่อน จึงจะแสดงในตารางนี้ได้"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">แผนภูมิ 9-Box: ผลงาน (แนวนอน) × ศักยภาพ (แนวตั้ง)</p>
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
        <div />
        {PERF_TIERS.map((perf) => (
          <div key={perf} className="text-center text-xs font-medium text-muted-foreground">
            ผลงาน{TIER_LABEL[perf]}
          </div>
        ))}
        {TIERS.map((potential) => (
          <Fragment key={potential}>
            <div className="flex items-center justify-center text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
              ศักยภาพ{TIER_LABEL[potential]}
            </div>
            {PERF_TIERS.map((perf) => (
              <Cell key={`${potential}-${perf}`} employees={grid[potential][perf]} />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Cell({ employees }: { employees: NineBoxEmployee[] }) {
  return (
    <Card className="min-h-28 gap-1.5 p-2">
      {employees.length === 0 ? (
        <p className="p-2 text-center text-xs text-muted-foreground">—</p>
      ) : (
        employees.map((e) => (
          <Link
            key={e.id}
            href={`/employees/${e.id}/evaluation-history`}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-muted"
          >
            <Avatar size="sm">
              <AvatarImage src={e.avatarUrl ?? undefined} />
              <AvatarFallback>{getInitials(e.firstName, e.lastName)}</AvatarFallback>
            </Avatar>
            <span className="truncate">
              {e.firstName} {e.lastName}
            </span>
          </Link>
        ))
      )}
    </Card>
  );
}
