"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmployeeCompetencyGap, useSetEmployeeCompetencyLevels } from "./hooks";
import { LevelPicker } from "./level-picker";

/**
 * Required level (from the employee's position, set in the Competency
 * Matrix) vs their actual assessed level — the "gap" half of the matrix.
 * HR/the manager edits the assessed-level column here; required levels are
 * read-only (set at /performance/competencies/matrix instead).
 */
export function EmployeeCompetencyGapView({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data, isLoading } = useEmployeeCompetencyGap(employeeId);
  const rows = data?.data ?? [];
  const setLevels = useSetEmployeeCompetencyLevels(employeeId);

  const [levels, setLocalLevels] = useState<Record<string, number>>({});
  useEffect(() => {
    // Depend on `data` (stable once fetched), not the `rows` array literal
    // above, which is re-created every render and would re-run this on
    // every keystroke elsewhere in the page.
    setLocalLevels(Object.fromEntries((data?.data ?? []).map((r) => [r.competencyId, r.assessedLevel ?? 0])));
  }, [data]);

  async function save() {
    try {
      await setLevels.mutateAsync(
        Object.entries(levels).map(([competencyId, level]) => ({ competencyId, level })),
      );
      toast.success("บันทึกระดับสมรรถนะของพนักงานแล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  }

  if (isLoading) return null;
  if (rows.length === 0) return null;

  const requiredRows = rows.filter((r) => r.requiredLevel != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>สมรรถนะเทียบกับตำแหน่ง</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requiredRows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            ยังไม่ได้กำหนดระดับที่ต้องการสำหรับตำแหน่งนี้ — ตั้งค่าได้ที่ &quot;ประเมินผลงาน &gt; เกณฑ์การประเมิน &gt; Competency Matrix&quot;
          </p>
        )}
        {requiredRows.map((r) => (
          <div key={r.competencyId} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{r.competencyName}</p>
              <p className="text-xs text-muted-foreground">ต้องการระดับ {r.requiredLevel}</p>
            </div>
            <div className="flex items-center gap-3">
              {canEdit ? (
                <LevelPicker
                  value={levels[r.competencyId] ?? 0}
                  onChange={(v) => setLocalLevels((prev) => ({ ...prev, [r.competencyId]: v }))}
                />
              ) : (
                <span className="text-sm font-semibold text-foreground">{r.assessedLevel ?? "–"}</span>
              )}
              <GapBadge gap={r.gap} />
            </div>
          </div>
        ))}
        {canEdit && requiredRows.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={save} disabled={setLevels.isPending}>
              {setLevels.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึกระดับที่ประเมิน
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap == null) return <span className="text-xs text-muted-foreground">ยังไม่ประเมิน</span>;
  if (gap <= 0)
    return (
      <span className="flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-semibold text-success">
        <TrendingUp className="size-3" /> ผ่านเกณฑ์
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
      {gap >= 2 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />} ขาด {gap} ระดับ
    </span>
  );
}
