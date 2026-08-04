"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { fullName } from "@/lib/format";
import { usePlans } from "./hooks";

export function SuccessionView() {
  const { can } = useAuth();
  const canCreate = can("succession:create");
  const { data, isLoading, isError, refetch } = usePlans();
  const plans = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">แผนสืบทอดตำแหน่งสำคัญและผู้สืบทอดที่มีศักยภาพ</p>
        {canCreate && (
          <Button render={<Link href="/performance/succession/new" />}>
            <Plus className="size-4" /> สร้างแผนสืบทอด
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : plans.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีแผนสืบทอดตำแหน่ง" description={canCreate ? "สร้างแผนแรกสำหรับตำแหน่งสำคัญ" : "ยังไม่มีข้อมูล"} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <Link key={p.id} href={`/performance/succession/${p.id}`}>
              <Card className="gap-2 p-4 transition hover:border-primary/40 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{p.position.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ผู้ดำรงตำแหน่ง: {p.incumbentEmployee ? fullName(p.incumbentEmployee.firstName, p.incumbentEmployee.lastName) : "ว่าง"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">ผู้สืบทอด {p.candidateCount} คน</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
