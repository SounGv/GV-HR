"use client";

import { useState } from "react";
import { CircleCheck, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { METRICS, metricOf, profileProblems, type Indicator, type KpiBand } from "./rules";
import type { KpiProfileView, KpiRunRow } from "./service";

const TONE_LABEL: Record<KpiBand["tone"], string> = { green: "เขียว", yellow: "เหลือง", red: "แดง", black: "ดำ" };
const TONE_CLASS: Record<KpiBand["tone"], string> = {
  green: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  yellow: "border-status-late-border bg-status-late-bg text-status-late-fg",
  red: "border-status-absent-border bg-status-absent-bg text-status-absent-fg",
  black: "border-border bg-foreground text-background",
};

const firstOfLastMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)).toISOString().slice(0, 10);
};
const lastOfLastMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 0)).toISOString().slice(0, 10);
};

/** KPI profiles: pick numbers the system already keeps (late days, leave, OT ...), give each a weight and a step table, and score people for a period. Informational only. */
export function KpiView() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canEdit = can("campaign:update");
  const list = useQuery({ queryKey: ["appraisal-kpi"], queryFn: () => api.get<Envelope<KpiProfileView[]>>("/api/appraisal-kpi") });
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const profiles = list.data?.data ?? [];
  const current = selected && selected !== "new" ? profiles.find((p) => p.id === selected) : undefined;

  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;
  if (list.isLoading) return <TableLoadingState rows={3} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ใช้ตัวเลขที่ระบบมีอยู่แล้วเป็นตัวชี้วัด แปลงเป็นคะแนนด้วยตารางขั้นบันไดที่ HR เขียนเอง ผลนี้เป็นข้อมูลประกอบ ยังไม่ถูกรวมเข้าคะแนนประเมินใดๆ
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected === p.id}
            onClick={() => setSelected(p.id)}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-9", selected === p.id ? "border-primary bg-accent" : "border-border bg-card")}
          >
            {p.name}
          </button>
        ))}
        {canEdit && (
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setSelected("new")}>
            <Plus className="size-4" /> โปรไฟล์ใหม่
          </Button>
        )}
      </div>

      {profiles.length === 0 && selected !== "new" && (
        <EmptyState icon={Plus} title="ยังไม่มีโปรไฟล์ KPI" description="กด “โปรไฟล์ใหม่” เพื่อเลือกตัวชี้วัดและตั้งเกณฑ์" />
      )}

      {selected && (
        <Editor
          key={selected}
          profile={current}
          canEdit={canEdit}
          onSaved={(id) => {
            qc.invalidateQueries({ queryKey: ["appraisal-kpi"] });
            setSelected(id);
          }}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ["appraisal-kpi"] });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function Editor({
  profile,
  canEdit,
  onSaved,
  onDeleted,
}: {
  profile?: KpiProfileView;
  canEdit: boolean;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const { can } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [indicators, setIndicators] = useState<Indicator[]>(profile?.indicators ?? []);
  const [bands, setBands] = useState<KpiBand[]>(profile?.bands ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const problems = profileProblems(indicators, bands);
  const total = indicators.reduce((s, i) => s + i.weight, 0);

  const save = useMutation({
    mutationFn: () => api.put<Envelope<KpiProfileView>>("/api/appraisal-kpi", { id: profile?.id, name: name.trim() || "โปรไฟล์ KPI", indicators, bands }),
    onSuccess: (res) => {
      toast.success("บันทึกโปรไฟล์แล้ว");
      onSaved(res.data.id);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ"),
  });
  const remove = useMutation({
    mutationFn: () => api.del<Envelope<unknown>>(`/api/appraisal-kpi/${profile!.id}`),
    onSuccess: () => {
      toast.success("ลบโปรไฟล์แล้ว");
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ"),
  });

  const setInd = (i: number, patch: Partial<Indicator>) => setIndicators((cur) => cur.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const used = new Set(indicators.map((i) => i.metric));

  return (
    <div className="space-y-4">
      <Card className="gap-4 p-4">
        <label className="space-y-1.5 text-sm font-medium">
          ชื่อโปรไฟล์
          <Input className="h-11 md:h-9" value={name} maxLength={200} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">ตัวชี้วัดและน้ำหนัก</h2>
          {indicators.map((ind, i) => {
            const m = metricOf(ind.metric);
            return (
              <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={ind.metric} disabled={!canEdit} onValueChange={(v) => v && setInd(i, { metric: v })}>
                    <SelectTrigger className="h-11 min-w-[200px] md:h-9" aria-label={`ตัวชี้วัดที่ ${i + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map((x) => (
                        <SelectItem key={x.key} value={x.key} disabled={used.has(x.key) && x.key !== ind.metric}>
                          {x.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-sm">
                    น้ำหนัก
                    <Input type="number" min={0} max={100} className="h-11 w-20 md:h-9" disabled={!canEdit} value={ind.weight} onChange={(e) => setInd(i, { weight: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
                  </label>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="ml-auto size-11 md:size-9" aria-label={`ลบตัวชี้วัดที่ ${i + 1}`} onClick={() => setIndicators((cur) => cur.filter((_, k) => k !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m?.higherBetter ? `ยิ่งมากยิ่งดี: ค่าตั้งแต่ขีดที่ระบุขึ้นไปได้คะแนนตามขั้น` : `ยิ่งน้อยยิ่งดี: ค่าไม่เกินขีดที่ระบุได้คะแนนตามขั้น เกินทุกขั้นได้ 0`} (หน่วย: {m?.unit})
                </p>
                {ind.steps.map((s, k) => (
                  <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24">{m?.higherBetter ? "ตั้งแต่" : "ไม่เกิน"}</span>
                    <Input type="number" className="h-11 w-24 md:h-9" aria-label={`ขีดของขั้นที่ ${k + 1}`} disabled={!canEdit} value={s.limit} onChange={(e) => setInd(i, { steps: ind.steps.map((x, j) => (j === k ? { ...x, limit: Number(e.target.value) || 0 } : x)) })} />
                    <span>ได้</span>
                    <Input type="number" min={0} max={100} className="h-11 w-24 md:h-9" aria-label={`คะแนนของขั้นที่ ${k + 1} เป็นเปอร์เซ็นต์`} disabled={!canEdit} value={s.points} onChange={(e) => setInd(i, { steps: ind.steps.map((x, j) => (j === k ? { ...x, points: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)) })} />
                    <span>% ของน้ำหนัก</span>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`ลบขั้นที่ ${k + 1}`} onClick={() => setInd(i, { steps: ind.steps.filter((_, j) => j !== k) })}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && ind.steps.length < 12 && (
                  <Button variant="outline" className="h-11 md:h-9" onClick={() => setInd(i, { steps: [...ind.steps, { limit: 0, points: 100 }] })}>
                    <Plus className="size-4" /> เพิ่มขั้น
                  </Button>
                )}
              </div>
            );
          })}
          {canEdit && indicators.length < 12 && (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setIndicators((cur) => [...cur, { metric: METRICS.find((m) => !used.has(m.key))?.key ?? "late", weight: 0, steps: [{ limit: 0, points: 100 }] }])}>
              <Plus className="size-4" /> เพิ่มตัวชี้วัด
            </Button>
          )}
          <p className={cn("flex items-center gap-2 text-sm", total === 100 ? "text-success" : "text-warning")}>
            {total === 100 ? <CircleCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
            น้ำหนักรวม {total} {total === 100 ? "" : "ต้องเป็น 100"}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">แถบสี (ไม่บังคับ)</h2>
          {bands.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select value={b.tone} disabled={!canEdit} onValueChange={(v) => v && setBands((cur) => cur.map((x, k) => (k === i ? { ...x, tone: v as KpiBand["tone"] } : x)))}>
                <SelectTrigger className="h-11 w-28 md:h-9" aria-label={`สีของระดับที่ ${i + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TONE_LABEL) as KpiBand["tone"][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TONE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label={`ชื่อระดับที่ ${i + 1}`} placeholder="ชื่อระดับ" className="h-11 min-w-0 flex-1 md:h-9" maxLength={60} disabled={!canEdit} value={b.label} onChange={(e) => setBands((cur) => cur.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <label className="flex items-center gap-1.5 text-sm">
                ตั้งแต่
                <Input type="number" min={0} max={100} className="h-11 w-20 md:h-9" aria-label={`คะแนนขั้นต่ำของระดับที่ ${i + 1}`} disabled={!canEdit} value={b.min} onChange={(e) => setBands((cur) => cur.map((x, k) => (k === i ? { ...x, min: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} />
              </label>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`ลบระดับที่ ${i + 1}`} onClick={() => setBands((cur) => cur.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {canEdit && bands.length < 8 && (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setBands((cur) => [...cur, { label: "", min: 0, tone: "green" }])}>
              <Plus className="size-4" /> เพิ่มระดับ
            </Button>
          )}
        </div>

        {problems.length > 0 && (
          <ul className="space-y-1 text-sm text-warning">
            {problems.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            {profile && can("campaign:delete") && (
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirmDelete(true)}>
                ลบโปรไฟล์
              </Button>
            )}
            <Button className="h-11 md:h-9" disabled={problems.length > 0 || save.isPending} onClick={() => save.mutate()}>
              บันทึกโปรไฟล์
            </Button>
          </div>
        )}
      </Card>

      {profile && <RunPanel profile={profile} />}

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="ลบโปรไฟล์นี้?" description={profile ? `“${profile.name}” จะถูกลบ` : undefined} confirmLabel="ลบ" destructive onConfirm={() => remove.mutate()} loading={remove.isPending} />
    </div>
  );
}

function RunPanel({ profile }: { profile: KpiProfileView }) {
  const [from, setFrom] = useState(firstOfLastMonth());
  const [to, setTo] = useState(lastOfLastMonth());
  const [result, setResult] = useState<{ rows: KpiRunRow[]; period: string } | null>(null);
  const run = useMutation({
    mutationFn: () => api.get<Envelope<{ rows: KpiRunRow[]; period: string }>>(`/api/appraisal-kpi/${profile.id}?from=${from}&to=${to}`),
    onSuccess: (res) => setResult(res.data),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "คำนวณไม่สำเร็จ"),
  });

  return (
    <Card className="gap-3 p-4" aria-label="คำนวณคะแนน KPI">
      <h2 className="text-base font-semibold">คำนวณคะแนนตามโปรไฟล์นี้</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium">
          ตั้งแต่
          <Input type="date" className="h-11 md:h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          ถึง
          <Input type="date" className="h-11 md:h-9" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button className="h-11 md:h-9" onClick={() => run.mutate()} disabled={run.isPending}>
          คำนวณ
        </Button>
      </div>
      {result && (
        <>
          <p className="text-sm text-muted-foreground">ช่วง {result.period} · {result.rows.length} คน (เรียงจากคะแนนน้อยไปมาก)</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">พนักงาน</th>
                  {profile.indicators.map((i) => (
                    <th key={i.metric} scope="col" className="px-2 py-2 text-right font-medium">{metricOf(i.metric)?.label}</th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right font-medium">คะแนน</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">ระดับ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((r) => (
                  <tr key={r.code}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {r.name} <span className="font-normal text-muted-foreground">{r.code}</span>
                    </th>
                    {r.parts.map((p) => (
                      <td key={p.metric} className="px-2 py-2 text-right tabular-nums">{p.value}</td>
                    ))}
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.score}</td>
                    <td className="px-3 py-2">
                      {r.band ? <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE_CLASS[r.band.tone as KpiBand["tone"]])}>{r.band.label}</span> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
