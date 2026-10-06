"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CircleCheck, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useCandidates,
  useCloseRound,
  useOpenRound,
  usePublishedForms,
  useRemindRound,
  useRound,
  useRoundProgress,
  useSaveRound,
} from "./hooks";
import { PRESETS, perspectiveTotal, RATER_TYPES, type RaterType } from "./rules";
import { RATER_LABEL, ROUND_STATUS_LABEL, type RoundDetail, type RoundSavePayload, type RoundStatus } from "./types";

const TONE: Record<RoundStatus, StatusTone> = { DRAFT: "warning", SCHEDULED: "info", OPEN: "success", CLOSED: "neutral" };
const STEPS = ["แบบ", "คน", "ผู้ประเมิน", "กำหนดการ", "ตรวจและเปิดรอบ"] as const;
const STEP_HINT = ["เลือกแบบที่ใช้แล้ว", "ใครถูกประเมิน", "90° ถึง 360°", "วันที่และการเตือน", "ต้องครบก่อนเปิด"];
/** Starting weights per preset; placeholders until HR confirms the real ones. */
const DEFAULT_WEIGHTS: Record<keyof typeof PRESETS, Partial<Record<RaterType, number>>> = {
  "90": { MANAGER: 100 },
  "180": { MANAGER: 70, SELF: 30 },
  "270": { MANAGER: 50, SELF: 25, PEER: 25 },
  "360": { MANAGER: 40, SELF: 20, PEER: 20, SUBORDINATE: 20 },
};
const EXCEPTION_LABEL = {
  NO_MANAGER: "ไม่มีหัวหน้า",
  NO_PEERS: "ไม่มีเพื่อนร่วมทีม",
  NO_RATER: "ยังไม่มีผู้ประเมินเลย",
  OVERLOADED: "ต้องประเมินหลายคนเกินไป",
} as const;

const fmtDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "-";

/** Loads one round; a draft opens in the 5-step wizard, anything else shows progress. */
export function RoundPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useRound(id);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  const round = data.data;
  return round.status === "DRAFT" ? <Wizard key={round.id} round={round} /> : <RoundOverview round={round} />;
}

function Header({ round, backTitle }: { round: RoundDetail; backTitle?: string }) {
  return (
    <PageHeaderBar
      breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/rounds" }, { label: "รอบประเมิน", href: "/appraisal/rounds" }, { label: round.name }]}
      backHref="/appraisal/rounds"
      title={backTitle ?? round.name}
      status={<StatusChip tone={TONE[round.status]} label={ROUND_STATUS_LABEL[round.status]} />}
      sticky={false}
    />
  );
}

/* ───────────────────────── wizard (draft) ───────────────────────── */

function Wizard({ round }: { round: RoundDetail }) {
  const [step, setStep] = useState(0);
  const save = useSaveRound(round.id);
  const stepOk = (i: number) => (i < 4 ? round.checks[i]?.ok === true : round.ready);

  async function persist(patch: RoundSavePayload, ok?: string): Promise<boolean> {
    try {
      await save.mutateAsync(patch);
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      return false;
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <Header round={round} />
      <ol className="grid gap-2 md:grid-cols-5">
        {STEPS.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left",
                step === i ? "border-primary bg-accent" : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  stepOk(i) ? "bg-success-muted text-success" : "bg-warning/10 text-warning",
                )}
                aria-hidden="true"
              >
                {stepOk(i) ? <CircleCheck className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {i + 1}. {name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {STEP_HINT[i]} · {stepOk(i) ? "ครบแล้ว" : "ยังไม่ครบ"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <StepForm round={round} persist={persist} />}
      {step === 1 && <StepPeople round={round} persist={persist} />}
      {step === 2 && <StepRaters round={round} persist={persist} />}
      {step === 3 && <StepSchedule round={round} persist={persist} />}
      {step === 4 && <StepReview round={round} goTo={setStep} />}

      <div className="flex justify-between gap-2">
        <Button variant="outline" className="h-11 md:h-9" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ย้อนกลับ
        </Button>
        <Button className="h-11 md:h-9" disabled={step === 4} onClick={() => setStep((s) => Math.min(4, s + 1))}>
          ถัดไป
        </Button>
      </div>
    </div>
  );
}

type Persist = (patch: RoundSavePayload, ok?: string) => Promise<boolean>;

function StepForm({ round, persist }: { round: RoundDetail; persist: Persist }) {
  const forms = usePublishedForms();
  const [name, setName] = useState(round.name);
  const list = forms.data?.data ?? [];
  return (
    <Card className="gap-4 p-4">
      <h2 className="text-base font-semibold">เลือกแบบประเมิน</h2>
      <div className="space-y-1.5">
        <label htmlFor="round-name" className="text-sm font-medium">
          ชื่อรอบ
        </label>
        <Input id="round-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== round.name && persist({ name: name.trim() })} />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">แบบที่ใช้ในรอบนี้</span>
        <Select value={round.formId} onValueChange={(v) => v && persist({ formId: v }, "เปลี่ยนแบบแล้ว")}>
          <SelectTrigger className="h-11 w-full md:h-9" aria-label="แบบที่ใช้ในรอบนี้">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} · {f.questionCount} คำถาม
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          เลือกได้เฉพาะแบบที่ “ยืนยันใช้” แล้ว ยังไม่มี?{" "}
          <Link href="/appraisal/forms" className="font-semibold text-primary underline-offset-2 hover:underline">
            ไปที่หน้าแบบประเมิน
          </Link>
        </p>
      </div>
    </Card>
  );
}

function StepPeople({ round, persist }: { round: RoundDetail; persist: Persist }) {
  const { data, isLoading, isError, refetch } = useCandidates();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(round.participantIds));
  const [q, setQ] = useState("");
  const people = useMemo(() => data?.data ?? [], [data]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, typeof people>();
    for (const p of people) {
      if (term && !`${p.name} ${p.code} ${p.department}`.toLowerCase().includes(term)) continue;
      map.set(p.department, [...(map.get(p.department) ?? []), p]);
    }
    return [...map.entries()];
  }, [people, q]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  const dirty = selected.size !== round.participantIds.length || round.participantIds.some((id) => !selected.has(id));

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">เลือกคนที่ถูกประเมิน</h2>
        <span className="text-sm text-muted-foreground tabular-nums">เลือกแล้ว {selected.size} จาก {people.length} คน</span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input aria-label="ค้นหาชื่อ รหัส หรือแผนก" placeholder="ค้นหาชื่อ รหัส หรือแผนก" className="h-11 pl-9 md:h-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-[420px] space-y-4 overflow-y-auto">
        {groups.map(([dept, list]) => {
          const ids = list.map((p) => p.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <section key={dept} aria-label={dept} className="space-y-1">
              <label className="flex min-h-11 items-center gap-3 rounded-lg bg-muted px-3 text-sm font-semibold md:min-h-9">
                <Checkbox checked={all} onCheckedChange={(c) => toggle(ids, c === true)} />
                {dept} <span className="font-normal text-muted-foreground">({list.length} คน)</span>
              </label>
              {list.map((p) => (
                <label key={p.id} className="flex min-h-11 items-center gap-3 px-3 text-sm md:min-h-9">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={(c) => toggle([p.id], c === true)} />
                  <span className="min-w-0 flex-1 break-words">
                    {p.name} <span className="text-muted-foreground">{p.code}</span>
                  </span>
                  {!p.hasManager && <StatusChip tone="warning" dot={false} label="ไม่มีหัวหน้า" />}
                </label>
              ))}
            </section>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">ไม่พบพนักงานที่ตรงกับคำค้น</p>}
      </div>
      <div className="flex justify-end">
        <Button className="h-11 md:h-9" disabled={!dirty} onClick={() => persist({ participantIds: [...selected] }, "บันทึกรายชื่อแล้ว")}>
          บันทึกรายชื่อ
        </Button>
      </div>
    </Card>
  );
}

function StepRaters({ round, persist }: { round: RoundDetail; persist: Persist }) {
  const [types, setTypes] = useState<RaterType[]>(round.raterTypes);
  const [weights, setWeights] = useState<Partial<Record<RaterType, number>>>(round.perspectiveWeights);
  const total = perspectiveTotal(types, weights);
  const activePreset = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).find(
    (k) => PRESETS[k].length === types.length && PRESETS[k].every((t) => types.includes(t)),
  );

  const dirty =
    types.length !== round.raterTypes.length ||
    types.some((t) => !round.raterTypes.includes(t)) ||
    types.some((t) => (weights[t] ?? 0) !== (round.perspectiveWeights[t] ?? 0));

  function pick(k: keyof typeof PRESETS) {
    setTypes([...PRESETS[k]]);
    setWeights(DEFAULT_WEIGHTS[k]);
  }

  const m = round.matching;
  return (
    <Card className="gap-4 p-4">
      <h2 className="text-base font-semibold">ใครประเมินใคร</h2>
      <div role="group" aria-label="รูปแบบการประเมิน" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([["90", "หัวหน้าประเมิน"], ["180", "+ ตนเอง"], ["270", "+ เพื่อนร่วมงาน"], ["360", "+ ลูกน้อง"]] as const).map(([k, hint]) => (
          <button
            key={k}
            type="button"
            aria-pressed={activePreset === k}
            onClick={() => pick(k)}
            className={cn("min-h-16 rounded-xl border px-3 py-2 text-left", activePreset === k ? "border-primary bg-accent" : "border-border bg-card")}
          >
            <span className="block text-base font-bold">{k}°</span>
            <span className="block text-sm text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      {types.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">น้ำหนักของแต่ละมุมมอง</h3>
          {RATER_TYPES.filter((t) => types.includes(t)).map((t) => (
            <label key={t} className="flex items-center gap-3 text-sm">
              <span className="w-32">{RATER_LABEL[t]}</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-11 w-24 md:h-9"
                value={weights[t] ?? 0}
                onChange={(e) => setWeights((w) => ({ ...w, [t]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
              />
              %
            </label>
          ))}
          <p className={cn("flex items-center gap-2 text-sm", total.ok ? "text-success" : "text-warning")}>
            {total.ok ? <CircleCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
            {total.ok ? "รวม 100%" : `รวม ${total.total}% ต้องเป็น 100%`}
          </p>
          <p className="text-xs text-muted-foreground">ค่าเริ่มต้นเป็นตัวอย่าง ตัวเลขจริงรอ HR ยืนยัน</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button className="h-11 md:h-9" disabled={!dirty || !total.ok} onClick={() => persist({ raterTypes: types, perspectiveWeights: weights }, "บันทึกแล้ว")}>
          บันทึกผู้ประเมิน
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">จับคู่จากผังองค์กร (ตามที่บันทึกแล้ว)</h3>
        {round.raterTypes.length === 0 || round.participantIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">เลือกคนที่ถูกประเมินและรูปแบบผู้ประเมินแล้วบันทึก ระบบจะจับคู่ให้</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm text-success">
              <CircleCheck className="size-4" aria-hidden="true" /> จับคู่แล้ว {m.assignmentCount} งานประเมิน (
              {RATER_TYPES.filter((t) => m.byType[t]).map((t) => `${RATER_LABEL[t]} ${m.byType[t]}`).join(" · ")})
            </p>
            {m.exceptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">ต้องดูเอง ({m.exceptions.length})</p>
                <ul className="space-y-1 text-sm">
                  {m.exceptions.slice(0, 15).map((e, i) => (
                    <li key={`${e.employeeId}-${e.kind}-${i}`} className="flex items-start gap-2 text-warning">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        {e.name} · {EXCEPTION_LABEL[e.kind]}
                        {e.detail ? ` (${e.detail} คน)` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {m.exceptions.length > 15 && <p className="text-sm text-muted-foreground">และอีก {m.exceptions.length - 15} รายการ</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function StepSchedule({ round, persist }: { round: RoundDetail; persist: Persist }) {
  const [start, setStart] = useState(round.startIso ?? "");
  const [end, setEnd] = useState(round.endIso ?? "");
  const [remind, setRemind] = useState(round.remind);
  const [line, setLine] = useState(round.notifyLine);
  const bad = !!(start && end && end < start);
  const dirty = start !== (round.startIso ?? "") || end !== (round.endIso ?? "") || remind !== round.remind || line !== round.notifyLine;
  return (
    <Card className="gap-4 p-4">
      <h2 className="text-base font-semibold">กำหนดการ</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          วันเปิดรอบ
          <Input type="date" className="h-11 md:h-9" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          วันปิดรอบ
          <Input type="date" className="h-11 md:h-9" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {bad && <p className="text-sm text-warning">วันปิดต้องไม่ก่อนวันเปิด</p>}
      <p className="text-sm text-muted-foreground">ข้อความเชิญจะถูกส่งในวันเปิดรอบ (ถ้าวันเปิดคือวันนี้หรือผ่านไปแล้ว จะส่งทันทีที่กด “เปิดรอบ”)</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">ช่องทางแจ้ง</legend>
        <p className="flex items-center gap-2 text-sm">
          <CircleCheck className="size-4 text-success" aria-hidden="true" /> กล่องข้อความในแอป (ส่งเสมอ)
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm md:min-h-9">
          <Checkbox checked={line} onCheckedChange={(c) => setLine(c === true)} />
          ส่งทาง LINE ด้วย (เฉพาะคนที่ผูก LINE ไว้)
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm md:min-h-9">
          <Checkbox checked={remind} onCheckedChange={(c) => setRemind(c === true)} />
          เตือนคนที่ยังไม่ส่ง ก่อนปิดรอบ 2 วัน
        </label>
      </fieldset>

      <div className="flex justify-end">
        <Button className="h-11 md:h-9" disabled={!dirty || bad} onClick={() => persist({ startDate: start || null, endDate: end || null, remind, notifyLine: line }, "บันทึกกำหนดการแล้ว")}>
          บันทึกกำหนดการ
        </Button>
      </div>
    </Card>
  );
}

function StepReview({ round, goTo }: { round: RoundDetail; goTo: (i: number) => void }) {
  const open = useOpenRound(round.id);
  const [confirm, setConfirm] = useState(false);
  const inv = round.invitations;
  const stepOf = { form: 0, people: 1, raters: 2, schedule: 3 } as const;
  const NAMES = { form: "แบบประเมิน", people: "คนที่ถูกประเมิน", raters: "ผู้ประเมิน", schedule: "กำหนดการ" } as const;
  // Bangkok calendar day, same as the server uses to decide whether to send now.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const sendsNow = !!round.startIso && round.startIso <= today;

  async function doOpen() {
    try {
      const res = await open.mutateAsync();
      setConfirm(false);
      if (res.data.mode === "NOW") {
        toast.success(`เปิดรอบแล้ว ส่งข้อความหา ${res.data.sent?.sent ?? 0} คน`);
      } else {
        toast.success(`ตั้งเวลาไว้แล้ว จะส่งข้อความวันที่ ${fmtDay(round.startIso)}`);
      }
    } catch (err) {
      setConfirm(false);
      toast.error(err instanceof ApiError ? err.message : "เปิดรอบไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-4 p-4">
      <h2 className="text-base font-semibold">ตรวจความพร้อม</h2>
      <ul className="divide-y divide-border">
        {round.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 py-3">
            <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-success-muted text-success" : "bg-warning/10 text-warning")}>
              {c.ok ? <CircleCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{NAMES[c.key]}</p>
              <p className="text-sm text-muted-foreground">{c.ok ? "ครบแล้ว" : c.why}</p>
            </div>
            {!c.ok && (
              <Button variant="outline" className="h-11 md:h-9" onClick={() => goTo(stepOf[c.key])}>
                ไปแก้
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
        <p className="font-semibold">สิ่งที่จะส่งเมื่อเปิดรอบ</p>
        <p>
          ข้อความ 1 ฉบับต่อผู้ประเมิน 1 คน รวม <b className="tabular-nums">{inv.total}</b> คน (LINE <b className="tabular-nums">{inv.withLine}</b> คน
          {round.notifyLine ? "" : " ปิดไว้"} · ในแอปอย่างเดียว <b className="tabular-nums">{inv.appOnly}</b> คน)
        </p>
        {inv.unreachable > 0 && (
          <p className="text-warning">
            ส่งไม่ถึง {inv.unreachable} คน (ยังไม่มีบัญชีเข้าใช้งาน): {inv.unreachableNames.slice(0, 5).join(", ")}
            {inv.unreachableNames.length > 5 ? " …" : ""}
          </p>
        )}
        {!inv.lineConfigured && <p className="text-muted-foreground">ระบบยังไม่ได้ตั้งค่า LINE จึงส่งในแอปอย่างเดียว</p>}
        <p className="text-muted-foreground">
          {sendsNow ? "จะส่งทันทีที่กด “เปิดรอบ”" : round.startIso ? `จะส่งอัตโนมัติวันที่ ${fmtDay(round.startIso)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusChip tone={round.ready ? "success" : "warning"} label={round.ready ? "พร้อมเปิดรอบ" : `ยังเปิดรอบไม่ได้ ขาด ${round.checks.filter((c) => !c.ok).length} ข้อ`} />
        <Button className="h-11 md:h-9" disabled={!round.ready || open.isPending} onClick={() => setConfirm(true)}>
          เปิดรอบ
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="เปิดรอบและส่งข้อความ?"
        description={`ข้อความจะถูกส่งหา ${inv.total} คน${sendsNow ? " ทันที" : ` ในวันที่ ${fmtDay(round.startIso)}`} ส่งแล้วเรียกคืนไม่ได้ และเปิดรอบแล้วแก้ไขรอบนี้ไม่ได้`}
        confirmLabel="เปิดรอบ"
        onConfirm={doOpen}
        loading={open.isPending}
      />
    </Card>
  );
}

/* ───────────────────────── overview (opened rounds) ───────────────────────── */

function RoundOverview({ round }: { round: RoundDetail }) {
  const { can } = useAuth();
  const live = round.status === "OPEN" || round.status === "CLOSED";
  const progress = useRoundProgress(round.id, live);
  const remind = useRemindRound(round.id);
  const close = useCloseRound(round.id);
  const [confirmClose, setConfirmClose] = useState(false);
  const p = progress.data?.data;
  const pct = p && p.total > 0 ? Math.round((p.submitted / p.total) * 100) : 0;

  async function doRemind() {
    try {
      const res = await remind.mutateAsync();
      toast.success(res.data.reminded > 0 ? `เตือน ${res.data.reminded} คนแล้ว` : "ไม่มีใครต้องเตือนในตอนนี้");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เตือนไม่สำเร็จ");
    }
  }

  async function doClose() {
    try {
      await close.mutateAsync();
      toast.success("ปิดรอบแล้ว");
      setConfirmClose(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ปิดรอบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <Header round={round} />
      <Card className="gap-3 p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">แบบที่ใช้</dt>
            <dd className="font-medium break-words">{round.formName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ช่วงรอบ</dt>
            <dd className="font-medium">
              {fmtDay(round.startIso)} – {fmtDay(round.endIso)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">คนที่ถูกประเมิน</dt>
            <dd className="font-medium tabular-nums">{round.participantIds.length} คน</dd>
          </div>
        </dl>
        {round.status === "SCHEDULED" && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm">ตั้งเวลาไว้แล้ว ระบบจะส่งข้อความหาผู้ประเมินในวันที่ {fmtDay(round.startIso)}</p>
        )}
      </Card>

      {live && (
        <Card className="gap-3 p-4" aria-label="ความคืบหน้า">
          <h2 className="text-base font-semibold">ความคืบหน้า</h2>
          {!p ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : (
            <>
              <p className="text-sm tabular-nums">
                ส่งแล้ว <b>{p.submitted}</b> จาก <b>{p.total}</b> งาน ({pct}%) · กำลังทำ {p.inProgress} · ยังไม่เริ่ม {p.pending}
              </p>
              <div role="progressbar" aria-label="ส่งแล้ว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
          {round.status === "OPEN" && can("campaign:update") && (
            <div className="flex flex-wrap gap-2">
              <Button className="h-11 md:h-9" onClick={doRemind} disabled={remind.isPending}>
                <Bell className="size-4" /> เตือนทุกคนที่ยังไม่ส่ง
              </Button>
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirmClose(true)}>
                ปิดรอบ
              </Button>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="ปิดรอบนี้?"
        description="ปิดแล้วผู้ประเมินส่งผลเพิ่มไม่ได้"
        confirmLabel="ปิดรอบ"
        destructive
        onConfirm={doClose}
        loading={close.isPending}
      />
    </div>
  );
}
