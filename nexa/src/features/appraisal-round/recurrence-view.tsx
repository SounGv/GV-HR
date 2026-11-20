"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Info, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCandidates, usePublishedForms, useRecurrenceActions, useRecurrences } from "./hooks";
import {
  DRAFT_LEAD_DAYS,
  FREQUENCIES,
  FREQUENCY_LABEL,
  MAX_DAY,
  MIN_DAY,
  checkRecurrence,
  roundName,
  upcomingOccurrences,
  type Frequency,
} from "./recurrence-rules";
import { ROUND_STATUS_LABEL, type RecurrenceBody, type RecurrenceItem } from "./types";

const PRESETS = [
  { key: "90", name: "90 หัวหน้า", hint: "หัวหน้าประเมินลูกทีม" },
  { key: "180", name: "180 เพิ่มตนเอง", hint: "เพิ่มประเมินตัวเอง" },
  { key: "270", name: "270 เพิ่มเพื่อน", hint: "เพิ่มเพื่อนร่วมทีม" },
  { key: "360", name: "360 เพิ่มลูกน้อง", hint: "ลูกทีมประเมินหัวหน้าด้วย" },
] as const;
const presetName = (key: string) => PRESETS.find((p) => p.key === key)?.name ?? key;

const fmt = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
/** Today in Bangkok as YYYY-MM-DD, for the preview of the next rounds. */
const bangkokToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date());

/** The name each frequency starts with. Changing the frequency swaps the name only while it is still one of these. */
const DEFAULT_NAME: Record<Frequency, string> = {
  MONTHLY: "ประเมินประจำเดือน {เดือน} {ปี}",
  QUARTERLY: "ประเมินประจำไตรมาส {ไตรมาส} {ปี}",
  YEARLY: "ประเมินประจำปี {ปี}",
};

const EMPTY: RecurrenceBody = { name: DEFAULT_NAME.MONTHLY, frequency: "MONTHLY", openDay: 1, closeDay: 7, formId: "", preset: "180", departmentNames: [] };

/** The recurring-round setups: each one makes a draft round on its own schedule, and HR press open. */
export function RecurrenceView() {
  const { data, isLoading, isError, error, refetch } = useRecurrences();
  const actions = useRecurrenceActions();
  const [editing, setEditing] = useState<{ id: string | null; body: RecurrenceBody } | null>(null);
  const [removing, setRemoving] = useState<RecurrenceItem | null>(null);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={3} />;
  const items = data.data;

  const toBody = (r: RecurrenceItem, patch: Partial<RecurrenceBody> = {}): RecurrenceBody => ({
    name: r.name,
    frequency: r.frequency,
    openDay: r.openDay,
    closeDay: r.closeDay,
    formId: r.formId,
    preset: r.preset,
    departmentNames: r.departmentNames,
    enabled: r.enabled,
    ...patch,
  });

  async function toggle(r: RecurrenceItem) {
    try {
      await actions.update.mutateAsync({ id: r.id, body: toBody(r, { enabled: !r.enabled }) });
      toast.success(r.enabled ? "หยุดการสร้างรอบอัตโนมัติแล้ว รอบที่สร้างไปแล้วยังอยู่" : "เปิดใช้การสร้างรอบอัตโนมัติแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await actions.remove.mutateAsync(removing.id);
      toast.success("ลบการตั้งรอบอัตโนมัติแล้ว รอบที่สร้างไปแล้วยังอยู่");
      setRemoving(null);
    } catch (err) {
      setRemoving(null);
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/appraisal/rounds" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline md:min-h-0">
          กลับไปรอบประเมิน
        </Link>
        <Button className="h-11 md:h-9" onClick={() => setEditing({ id: null, body: EMPTY })}>
          <Plus className="size-4" /> เพิ่มการตั้งรอบ
        </Button>
      </div>

      <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
        <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <span>
          ระบบสร้างรอบเป็นฉบับร่างล่วงหน้า {DRAFT_LEAD_DAYS} วัน แล้วแจ้งในกระดิ่งของ HR ให้ตรวจรายชื่อและผู้ประเมิน HR กดเปิดรอบเอง ระบบไม่เปิดรอบให้
        </span>
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="ยังไม่ได้ตั้งรอบอัตโนมัติ"
          description="กด เพิ่มการตั้งรอบ เพื่อให้ระบบสร้างรอบประเมินให้ทุกเดือน ไม่ต้องสร้างด้วยมือซ้ำ"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead className="w-full">ชื่อรอบ</TableHead>
              <TableHead>แบบประเมิน</TableHead>
              <TableHead>ผู้ประเมิน</TableHead>
              <TableHead>ผู้ถูกประเมิน</TableHead>
              <TableHead>3 รอบถัดไป</TableHead>
              <TableHead>สร้างไปแล้ว</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="min-w-56 whitespace-normal">
                  <button
                    type="button"
                    className="text-left font-medium break-words text-foreground hover:text-primary hover:underline"
                    onClick={() => setEditing({ id: r.id, body: toBody(r) })}
                  >
                    {r.name}
                  </button>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {FREQUENCY_LABEL[r.frequency]} เปิดวันที่ {r.openDay} ปิดวันที่ {r.closeDay} ของเดือนที่เปิด
                  </p>
                </TableCell>
                <TableCell className="min-w-36 whitespace-normal break-words">{r.formName}</TableCell>
                <TableCell>{presetName(r.preset)}</TableCell>
                <TableCell className="min-w-40 whitespace-normal break-words">
                  {r.departmentNames.length === 0 ? "พนักงานที่ยังทำงานอยู่ทุกคน" : `เฉพาะแผนก ${r.departmentNames.join(", ")}`}
                </TableCell>
                <TableCell className="min-w-64 whitespace-normal">
                  <ul className="space-y-1 text-xs">
                    {r.upcoming.map((u) => (
                      <li key={u.periodKey} className="tabular-nums">
                        <span className="font-medium">{u.name}</span>{" "}
                        <span className="text-muted-foreground">
                          เปิด {fmt(u.startIso)} ปิด {fmt(u.endIso)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell className="min-w-40 whitespace-normal">
                  <span className="tabular-nums">{r.roundsMade} รอบ</span>
                  {r.lastRound && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ล่าสุด{" "}
                      <Link href={`/appraisal/rounds/${r.lastRound.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                        {r.lastRound.name}
                      </Link>{" "}
                      ({ROUND_STATUS_LABEL[r.lastRound.status]})
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <StatusChip tone={r.enabled ? "success" : "neutral"} label={r.enabled ? "เปิดใช้อยู่" : "หยุดอยู่"} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${r.name}`} onClick={() => setEditing({ id: r.id, body: toBody(r) })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggle(r)} disabled={actions.update.isPending}>
                      {r.enabled ? "หยุดชั่วคราว" : "เปิดใช้อีกครั้ง"}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`ลบ ${r.name}`} onClick={() => setRemoving(r)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RecurrenceDialog state={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="ลบการตั้งรอบอัตโนมัติ?"
        description={`ระบบจะไม่สร้างรอบใหม่จาก “${removing?.name ?? ""}” อีก รอบที่สร้างไปแล้ว${removing ? ` (${removing.roundsMade} รอบ)` : ""}ยังอยู่ตามเดิม`}
        confirmLabel="ลบ"
        destructive
        onConfirm={confirmRemove}
        loading={actions.remove.isPending}
      />
    </div>
  );
}

/* ───────────────────────── the form ───────────────────────── */

function RecurrenceDialog({ state, onClose }: { state: { id: string | null; body: RecurrenceBody } | null; onClose: () => void }) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{state && <Form key={state.id ?? "new"} id={state.id} initial={state.body} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

const field = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base md:h-10";

function Form({ id, initial, onClose }: { id: string | null; initial: RecurrenceBody; onClose: () => void }) {
  const actions = useRecurrenceActions();
  const forms = usePublishedForms();
  const people = useCandidates();
  const [body, setBody] = useState<RecurrenceBody>(initial);
  const [onlyDepts, setOnlyDepts] = useState(initial.departmentNames.length > 0);
  const [error, setError] = useState("");
  const set = (patch: Partial<RecurrenceBody>) => setBody((b) => ({ ...b, ...patch }));
  const publishedForms = forms.data?.data ?? [];
  const departments = [...new Set((people.data?.data ?? []).map((c) => c.department))].sort((a, b) => a.localeCompare(b, "th"));
  const formMissing = body.formId !== "" && forms.data !== undefined && !publishedForms.some((f) => f.id === body.formId);
  const busy = actions.create.isPending || actions.update.isPending;

  const preview = checkRecurrence(body) ? [] : upcomingOccurrences(bangkokToday(), { frequency: body.frequency, openDay: body.openDay, closeDay: body.closeDay }, 3);

  async function save() {
    const problem = checkRecurrence(body) ?? (body.formId === "" ? "เลือกแบบประเมิน" : onlyDepts && body.departmentNames.length === 0 ? "เลือกอย่างน้อยหนึ่งแผนก หรือเลือกพนักงานทุกคน" : null);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const payload: RecurrenceBody = { ...body, departmentNames: onlyDepts ? body.departmentNames : [] };
    try {
      if (id) await actions.update.mutateAsync({ id, body: payload });
      else await actions.create.mutateAsync(payload);
      toast.success(id ? "บันทึกการตั้งรอบแล้ว" : "ตั้งรอบอัตโนมัติแล้ว ระบบจะสร้างฉบับร่างให้ตามกำหนด");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ต แล้วลองใหม่");
    }
  }

  const seg = (on: boolean) => cn("min-h-11 rounded-lg border px-3 text-sm font-medium md:min-h-9", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{id ? "แก้ไขการตั้งรอบ" : "เพิ่มการตั้งรอบ"}</DialogTitle>
        <DialogDescription>ตั้งครั้งเดียว ระบบสร้างรอบเป็นฉบับร่างให้ตามกำหนด และ HR กดเปิดเอง</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="rc-name" className="text-sm font-medium">
            ชื่อรอบ
          </label>
          <Input id="rc-name" value={body.name} onChange={(e) => set({ name: e.target.value })} maxLength={200} className="h-11 text-base md:h-10" />
          <p className="text-xs text-muted-foreground">ระบบแทน {"{เดือน}"} {"{ไตรมาส}"} และ {"{ปี}"} ด้วยช่วงที่ประเมินให้เอง</p>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">ความถี่</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ความถี่">
            {FREQUENCIES.map((f: Frequency) => (
              <button key={f} type="button" aria-pressed={body.frequency === f} className={seg(body.frequency === f)} onClick={() => set({ frequency: f, ...(Object.values(DEFAULT_NAME).includes(body.name) ? { name: DEFAULT_NAME[f] } : {}) })}>
                {FREQUENCY_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">ช่วงเปิดรอบ</span>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="rc-open" className="text-sm">
              เปิดวันที่
            </label>
            <input id="rc-open" type="number" inputMode="numeric" min={MIN_DAY} max={MAX_DAY} value={body.openDay} onChange={(e) => set({ openDay: Number(e.target.value) })} className={cn(field, "w-20 tabular-nums")} />
            <label htmlFor="rc-close" className="text-sm">
              ปิดวันที่
            </label>
            <input id="rc-close" type="number" inputMode="numeric" min={MIN_DAY} max={MAX_DAY} value={body.closeDay} onChange={(e) => set({ closeDay: Number(e.target.value) })} className={cn(field, "w-20 tabular-nums")} />
          </div>
          <p className="text-xs text-muted-foreground">
            วันที่ {MIN_DAY} ถึง {MAX_DAY} ของเดือนที่เปิด รอบที่เปิดต้นเดือนประเมินช่วงที่เพิ่งจบ
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="rc-form" className="text-sm font-medium">
            แบบประเมิน
          </label>
          <select id="rc-form" value={body.formId} onChange={(e) => set({ formId: e.target.value })} className={field}>
            <option value="">เลือกแบบประเมิน</option>
            {formMissing && <option value={body.formId}>แบบประเมินเดิม (ไม่ได้ใช้งานแล้ว)</option>}
            {publishedForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {formMissing ? "แบบประเมินนี้เลิกใช้แล้ว ระบบจะใช้เวอร์ชันใหม่ของแบบเดียวกันถ้ามี หรือเลือกแบบอื่นตรงนี้" : "ใช้ได้เฉพาะแบบที่ยืนยันใช้แล้ว และถ้ามีเวอร์ชันใหม่ ระบบใช้เวอร์ชันล่าสุดให้เอง"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">ผู้ประเมิน</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ผู้ประเมิน">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" title={p.hint} aria-pressed={body.preset === p.key} className={seg(body.preset === p.key)} onClick={() => set({ preset: p.key })}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">ผู้ถูกประเมิน</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ผู้ถูกประเมิน">
            <button type="button" aria-pressed={!onlyDepts} className={seg(!onlyDepts)} onClick={() => setOnlyDepts(false)}>
              พนักงานที่ยังทำงานอยู่ทุกคน
            </button>
            <button type="button" aria-pressed={onlyDepts} className={seg(onlyDepts)} onClick={() => setOnlyDepts(true)}>
              เฉพาะบางแผนก
            </button>
          </div>
          {onlyDepts && (
            <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="เลือกแผนก">
              {departments.map((d) => {
                const on = body.departmentNames.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    className={cn("min-h-11 rounded-full border px-3 text-sm md:min-h-9", on ? "border-foreground bg-foreground text-background" : "border-border bg-card")}
                    onClick={() => set({ departmentNames: on ? body.departmentNames.filter((x) => x !== d) : [...body.departmentNames, d] })}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border px-3 py-2">
          <h3 className="text-sm font-semibold">3 รอบถัดไปที่ระบบจะสร้าง</h3>
          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">กรอกชื่อ ความถี่ และวันเปิดปิดให้ครบ เพื่อดูตัวอย่าง</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {preview.map((o) => (
                <li key={o.periodKey} className="tabular-nums">
                  <span className="font-medium">{roundName(body.name, o)}</span>{" "}
                  <span className="text-muted-foreground">
                    เปิด {fmt(o.startIso)} ปิด {fmt(o.endIso)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" className="h-11 md:h-9" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button className="h-11 md:h-9" onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />}
          {id ? "บันทึก" : "บันทึกการตั้งรอบอัตโนมัติ"}
        </Button>
      </DialogFooter>
    </>
  );
}
