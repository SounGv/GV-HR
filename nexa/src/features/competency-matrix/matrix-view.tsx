"use client";

import { useEffect, useState } from "react";
import { Grid3x3, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePositions } from "@/features/organization/hooks";
import { usePositionRequirements, useSetPositionRequirements } from "./hooks";
import { LevelPicker } from "./level-picker";

/**
 * HR sets, per position, how proficient someone in that role is expected to
 * be in each competency (0 = not required, 1-5 = required level). This is
 * the "requirements" half of the competency matrix — see employee-gap-view.tsx
 * for the other half (an individual's assessed level against these).
 */
export function CompetencyMatrixView() {
  const { data: positionsRes, isLoading: loadingPositions } = usePositions();
  const positions = positionsRes?.data ?? [];
  const [positionId, setPositionId] = useState<string>("");

  useEffect(() => {
    if (!positionId && positionsRes?.data?.length) setPositionId(positionsRes.data[0].id);
    // Depend on the query result (referentially stable once fetched), not the
    // `positions` array literal above — that's re-created every render and
    // would otherwise re-run this effect (and the one below) constantly.
  }, [positionsRes, positionId]);

  const { data: reqRes, isLoading: loadingReqs } = usePositionRequirements(positionId);
  const rows = reqRes?.data ?? [];
  const setReqs = useSetPositionRequirements(positionId);

  const [levels, setLevels] = useState<Record<string, number>>({});
  useEffect(() => {
    setLevels(Object.fromEntries((reqRes?.data ?? []).map((r) => [r.competencyId, r.requiredLevel ?? 0])));
  }, [reqRes]);

  async function save() {
    try {
      await setReqs.mutateAsync(
        Object.entries(levels).map(([competencyId, level]) => ({ competencyId, level })),
      );
      toast.success("บันทึกระดับที่ต้องการของตำแหน่งนี้แล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  }

  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const key = r.categoryName ?? "ไม่มีหมวดหมู่";
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Grid3x3 className="size-4.5" />
            </span>
            <div>
              <p className="font-semibold text-foreground">เลือกตำแหน่ง</p>
              <p className="text-xs text-muted-foreground">กำหนดระดับสมรรถนะที่ต้องการสำหรับตำแหน่งนี้</p>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={positionId}
              onValueChange={(v) => setPositionId(v ?? "")}
              items={positions.map((p) => ({ value: p.id, label: `${p.title}${p.department ? ` · ${p.department.name}` : ""}` }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingPositions ? "กำลังโหลด…" : "เลือกตำแหน่ง"} />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                    {p.department ? ` · ${p.department.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!positionId ? (
        <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีตำแหน่งในระบบ — เพิ่มตำแหน่งที่หน้าโครงสร้างองค์กรก่อน</p>
      ) : loadingReqs ? (
        <p className="p-6 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีสมรรถนะในคลัง — เพิ่มที่เมนู &quot;คลังสมรรถนะ&quot; ก่อน</p>
      ) : (
        <>
          {Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardContent className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">{category}</h3>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div
                      key={r.competencyId}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm font-medium text-foreground">{r.competencyName}</span>
                      <LevelPicker
                        value={levels[r.competencyId] ?? 0}
                        onChange={(v) => setLevels((prev) => ({ ...prev, [r.competencyId]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
            <Button onClick={save} disabled={setReqs.isPending} className="shadow-lg">
              {setReqs.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึก
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
