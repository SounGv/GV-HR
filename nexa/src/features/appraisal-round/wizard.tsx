"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { BackLink } from "@/components/shared/back-link";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Lock,
  Rocket,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SectionHeading } from "@/components/shared/section-heading";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/features/auth/auth-context";
import { useDepartments, useSaveOrgMoves } from "@/features/organization/hooks";
import { buildCompanyTree } from "@/features/organization/org-tree";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  appraisalRoundKeys,
  useCandidates,
  useOpenRound,
  usePublishedForms,
  useSaveRound,
} from "./hooks";
import {
  PEER_LIMIT,
  PRESETS,
  perspectiveTotal,
  RATER_TYPES,
  REMIND_BEFORE_DAYS,
  type RaterType,
} from "./rules";
import {
  RATER_LABEL,
  type Candidate,
  type MatchRow,
  type RoundDetail,
  type RoundSavePayload,
} from "./types";

/* round-wizard-mock.html: four steps, saved on every move, readiness always in view. */

const STEPS = ["ตั้งรอบ", "เลือกคน", "ใครประเมินใคร", "ตรวจและเปิด"] as const;
type PresetKey = keyof typeof PRESETS;
const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];
const PRESET_TEXT: Record<PresetKey, { name: string; hint: string }> = {
  "90": { name: "หัวหน้า", hint: "หัวหน้าประเมินลูกทีม เร็ว เหมาะกับรอบรายเดือน" },
  "180": { name: "+ ตนเอง", hint: "เพิ่มประเมินตัวเอง เห็นมุมมองสองฝั่ง" },
  "270": { name: "+ เพื่อน", hint: `เพิ่มเพื่อนที่มีหัวหน้าคนเดียวกัน (สูงสุด ${PEER_LIMIT} คน)` },
  "360": { name: "+ ลูกน้อง", hint: "ลูกทีมประเมินหัวหน้าด้วย เหมาะกับรอบปี" },
};
/** Starting weights per preset; placeholders until HR confirms the real ones. */
const DEFAULT_WEIGHTS: Record<PresetKey, Partial<Record<RaterType, number>>> = {
  "90": { MANAGER: 100 },
  "180": { MANAGER: 70, SELF: 30 },
  "270": { MANAGER: 50, SELF: 25, PEER: 25 },
  "360": { MANAGER: 40, SELF: 20, PEER: 20, SUBORDINATE: 20 },
};
const CHECK_STEP = { form: 0, people: 1, raters: 2, schedule: 0 } as const;
const CHECK_NAME = {
  form: "แบบประเมิน",
  people: "คนที่ถูกประเมิน",
  raters: "ผู้ประเมิน",
  schedule: "กำหนดการและการแจ้ง",
} as const;
const LIME = "#CDEB03";

const dayFmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("th-TH", { ...opts, timeZone: "UTC" });
const SHORT = dayFmt({ day: "numeric", month: "short" });
const LONG = dayFmt({ day: "numeric", month: "long", year: "numeric" });
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmtShort = (iso: string | null) => (iso ? SHORT.format(asDate(iso)) : "–");
const fmtLong = (iso: string | null) => (iso ? LONG.format(asDate(iso)) : "–");
const addDays = (iso: string, n: number) =>
  new Date(asDate(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const spanDays = (a: string, b: string) =>
  Math.round((asDate(b).getTime() - asDate(a).getTime()) / 86_400_000) + 1;
const timeNow = () =>
  new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(),
  );

/** Same-set check for two id lists. */
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Everything the wizard edits, kept here so any move (next, back, a step tab) saves it in one go. */
interface Draft {
  name: string;
  formId: string;
  start: string;
  end: string;
  remind: boolean;
  line: boolean;
  selected: Set<string>;
  /** employeeId -> form id; a person without an entry uses the round's own form. */
  formOf: Record<string, string>;
  types: RaterType[];
  weights: Partial<Record<RaterType, number>>;
}

const draftOf = (r: RoundDetail): Draft => ({
  name: r.name,
  formId: r.formId,
  start: r.startIso ?? "",
  end: r.endIso ?? "",
  remind: r.remind,
  line: r.notifyLine,
  selected: new Set(r.participantIds),
  formOf: { ...r.participantForms },
  types: [...r.raterTypes],
  weights: { ...r.perspectiveWeights },
});

/** The fields that differ from what is saved; empty = nothing to save. */
function patchOf(d: Draft, r: RoundDetail): RoundSavePayload {
  const p: RoundSavePayload = {};
  if (d.name.trim() && d.name.trim() !== r.name) p.name = d.name.trim();
  if (d.formId !== r.formId) p.formId = d.formId;
  if (d.start !== (r.startIso ?? "")) p.startDate = d.start || null;
  if (d.end !== (r.endIso ?? "")) p.endDate = d.end || null;
  if (d.remind !== r.remind) p.remind = d.remind;
  if (d.line !== r.notifyLine) p.notifyLine = d.line;
  const ids = [...d.selected];
  const formsChanged = ids.some((id) => (d.formOf[id] ?? "") !== (r.participantForms[id] ?? ""));
  if (!sameSet(ids, r.participantIds) || formsChanged) {
    p.participantIds = ids;
    p.participantForms = Object.fromEntries(ids.map((id) => [id, d.formOf[id] ?? null]));
  }
  if (
    !sameSet(d.types, r.raterTypes) ||
    d.types.some((t) => (d.weights[t] ?? 0) !== (r.perspectiveWeights[t] ?? 0))
  ) {
    p.raterTypes = d.types;
    p.perspectiveWeights = Object.fromEntries(d.types.map((t) => [t, d.weights[t] ?? 0]));
  }
  return p;
}

export function Wizard({ round }: { round: RoundDetail }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => draftOf(round));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Set after saving people: the server keeps only active employees, so the draft takes the saved list back.
  const [resyncPeople, setResyncPeople] = useState(false);
  const save = useSaveRound(round.id);
  const open = useOpenRound(round.id);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!resyncPeople) return;
    setResyncPeople(false);
    setDraft((d) => ({
      ...d,
      selected: new Set(round.participantIds),
      formOf: { ...round.participantForms },
    }));
  }, [resyncPeople, round.participantIds, round.participantForms]);

  const pending = patchOf(draft, round);
  const dirty = Object.keys(pending).length > 0;
  const badDates = !!(draft.start && draft.end && draft.end < draft.start);
  const blocker = !draft.name.trim()
    ? "กรุณาตั้งชื่อรอบ"
    : badDates
      ? "วันปิดต้องไม่ก่อนวันเปิด"
      : null;

  /** Saves whatever changed. Returns false (and says why) when it could not. */
  async function flush(extra?: RoundSavePayload): Promise<boolean> {
    if (blocker) {
      toast.error(blocker);
      return false;
    }
    const patch = { ...patchOf(draft, round), ...extra };
    if (Object.keys(patch).length === 0) return true;
    try {
      await save.mutateAsync(patch);
      setSavedAt(timeNow());
      if (patch.participantIds) setResyncPeople(true);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      return false;
    }
  }

  async function goTo(i: number) {
    if (i === step) return;
    if (await flush()) {
      setStep(i);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  /** A preset is saved at once, so the matching table below it is always current. */
  async function pickPreset(k: PresetKey) {
    const types = [...PRESETS[k]];
    const weights = DEFAULT_WEIGHTS[k];
    if (await flush({ raterTypes: types, perspectiveWeights: weights })) update({ types, weights });
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const sendsNow = !!round.startIso && round.startIso <= today;

  async function doOpen() {
    try {
      const res = await open.mutateAsync();
      setConfirmOpen(false);
      toast.success(
        res.data.mode === "NOW"
          ? `เปิดรอบแล้ว ส่งข้อความหา ${res.data.sent?.sent ?? 0} คน`
          : `ตั้งเวลาไว้แล้ว จะส่งข้อความวันที่ ${fmtLong(round.startIso)}`,
      );
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err instanceof ApiError ? err.message : "เปิดรอบไม่สำเร็จ");
    }
  }

  const failing = round.checks.filter((c) => !c.ok);
  const ready = round.ready && !dirty;
  /** Unsaved edits are saved first; the server re-checks readiness when the round opens. */
  async function askOpen() {
    if (dirty && !(await flush())) return;
    setConfirmOpen(true);
  }
  const stepDone = (i: number) => i < step || (i === 3 && ready);

  return (
    <div className="space-y-5 pb-4">
      <Hero
        round={round}
        draft={draft}
        step={step}
        stepDone={stepDone}
        goTo={goTo}
        saving={save.isPending}
        savedAt={savedAt}
        dirty={dirty}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card key={step} className="gv-rise gap-0 rounded-[22px] p-5 sm:p-6">
          {step === 0 && <StepSetup draft={draft} update={update} badDates={badDates} />}
          {step === 1 && <StepPeople round={round} draft={draft} update={update} />}
          {step === 2 && (
            <StepRaters
              round={round}
              draft={draft}
              update={update}
              pickPreset={pickPreset}
              saving={save.isPending}
            />
          )}
          {step === 3 && <StepReview round={round} goTo={goTo} />}
        </Card>
        <Readiness round={round} dirty={dirty} goTo={goTo} />
      </div>

      {/* Sticky action bar: saving happens here, so there is no separate save button per step. */}
      <div className="border-border bg-background sticky bottom-0 z-20 -mx-4 border-t px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            variant="outline"
            className="h-11 md:h-10"
            disabled={step === 0 || save.isPending}
            onClick={() => goTo(step - 1)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> ย้อนกลับ
          </Button>
          <span className="flex-1" />
          {step === 3 && !ready && !dirty && (
            <span className="order-first w-full text-center text-[12.5px] font-semibold text-[#b45309] sm:order-none sm:w-auto">
              ยังเปิดไม่ได้ · เหลือ {failing.length} ข้อ
            </span>
          )}
          {step < 3 ? (
            <Button
              className="h-11 px-5 md:h-10"
              disabled={save.isPending}
              onClick={() => goTo(step + 1)}
            >
              {save.isPending ? "กำลังบันทึก…" : "บันทึกและถัดไป"}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              className="h-11 px-5 font-bold text-[#131516] hover:brightness-95 md:h-10"
              style={{ background: LIME }}
              disabled={(!ready && !dirty) || open.isPending || save.isPending}
              onClick={askOpen}
            >
              <Rocket className="size-4" aria-hidden="true" />
              {sendsNow ? "เปิดรอบ · ส่งทันที" : `เปิดรอบ · ส่ง ${fmtShort(round.startIso)}`}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="เปิดรอบและส่งข้อความ?"
        description={`ข้อความจะถูกส่งหา ${round.invitations.total} คน${sendsNow ? " ทันที" : ` ในวันที่ ${fmtLong(round.startIso)}`} ส่งแล้วเรียกคืนไม่ได้ และเปิดรอบแล้วแก้ไขรอบนี้ไม่ได้`}
        confirmLabel="เปิดรอบ"
        onConfirm={doOpen}
        loading={open.isPending}
      />
    </div>
  );
}

/* ───────────────────────── hero: the round at a glance ───────────────────────── */

function Hero({
  round,
  draft,
  step,
  stepDone,
  goTo,
  saving,
  savedAt,
  dirty,
}: {
  round: RoundDetail;
  draft: Draft;
  step: number;
  stepDone: (i: number) => boolean;
  goTo: (i: number) => void;
  saving: boolean;
  savedAt: string | null;
  dirty: boolean;
}) {
  const m = round.matching;
  const saveText = saving
    ? "กำลังบันทึก…"
    : dirty
      ? "มีการแก้ที่ยังไม่บันทึก"
      : savedAt
        ? `บันทึกแล้ว ${savedAt}`
        : "บันทึกอัตโนมัติเมื่อกดถัดไป";
  return (
    <section className="gv-hero gv-rise p-5 sm:p-6" aria-labelledby="round-wizard-title">
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[12.5px] text-white/70">
        <BackLink href="/appraisal/rounds" onHero>
          รอบประเมิน
        </BackLink>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span>สร้างรอบ</span>
      </nav>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1
          id="round-wizard-title"
          className="min-w-0 text-[22px] leading-snug font-bold break-words sm:text-[26px]"
        >
          {draft.name.trim() || round.name}
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold">
          <span className="size-1.5 rounded-full bg-[#fde047]" aria-hidden="true" /> ฉบับร่าง
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/75"
          aria-live="polite"
        >
          <span
            className={cn("size-1.5 rounded-full", dirty ? "bg-[#fde047]" : "bg-[#4ade80]")}
            aria-hidden="true"
          />
          {saveText}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label="ผู้ถูกประเมิน" value={draft.selected.size} unit="คน" />
        <Tile label="งานประเมินทั้งหมด" value={m.assignmentCount} unit="งาน" />
        <Tile label="ผู้ประเมินที่ต้องกรอก" value={m.raterCount} unit="คน" />
        <Tile
          label="ช่วงเวลา"
          value={
            draft.start && draft.end
              ? `${fmtShort(draft.start)} – ${fmtShort(draft.end)}`
              : "ยังไม่ตั้ง"
          }
          small
        />
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4" aria-label="ขั้นตอน">
        {STEPS.map((name, i) => {
          const on = i === step;
          const done = !on && stepDone(i);
          return (
            <li key={name}>
              <button
                type="button"
                aria-current={on ? "step" : undefined}
                onClick={() => goTo(i)}
                className="grid w-full gap-2 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
              >
                <span className="h-[5px] overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500"
                    style={{ width: on || done ? "100%" : 0, background: on ? "#fff" : LIME }}
                  />
                </span>
                <span
                  className={cn(
                    "flex min-h-8 items-center gap-2 text-[13px] font-semibold",
                    on ? "text-white" : "text-white/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold",
                      on ? "bg-white text-[#0f766e]" : done ? "text-[#131516]" : "bg-white/15",
                    )}
                    style={done ? { background: LIME } : undefined}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Tile({
  label,
  value,
  unit,
  small,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  small?: boolean;
}) {
  return (
    <div className="gv-glass min-w-0 px-3.5 py-3">
      <p className="text-[12px] leading-snug text-white/80">{label}</p>
      <p
        className={cn(
          "mt-0.5 leading-tight font-bold tabular-nums",
          small ? "pt-1 text-[17px] sm:text-[19px]" : "text-[24px] sm:text-[26px]",
        )}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-white/75">{unit}</span>}
      </p>
    </div>
  );
}

/* ───────────────────────── readiness (always visible) ───────────────────────── */

function Readiness({
  round,
  dirty,
  goTo,
}: {
  round: RoundDetail;
  dirty: boolean;
  goTo: (i: number) => void;
}) {
  const passed = round.checks.filter((c) => c.ok).length;
  const total = round.checks.length;
  const circ = 2 * Math.PI * 17;
  return (
    <aside className="grid gap-3 lg:sticky lg:top-20" aria-label="ความพร้อมก่อนเปิดรอบ">
      <Card className="gap-3 rounded-[22px] p-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 42 42" className="size-[42px] shrink-0" aria-hidden="true">
            <circle cx="21" cy="21" r="17" fill="none" stroke="var(--muted)" strokeWidth="5" />
            <circle
              cx="21"
              cy="21"
              r="17"
              fill="none"
              stroke={passed === total ? "#84cc16" : "#0d9488"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(passed / total) * circ} ${circ}`}
              transform="rotate(-90 21 21)"
              className="transition-[stroke-dasharray] duration-500"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold">ความพร้อมก่อนเปิดรอบ</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              ผ่าน {passed} จาก {total} ข้อ{dirty ? " · ยังไม่ได้บันทึกการแก้ล่าสุด" : ""}
            </p>
          </div>
        </div>
        <ul className="grid gap-0.5">
          {round.checks.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => goTo(CHECK_STEP[c.key])}
                className="hover:bg-muted flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left"
              >
                <CheckDot ok={c.ok} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{CHECK_NAME[c.key]}</span>
                  <span className="text-muted-foreground block text-[11.5px] leading-snug">
                    {c.ok ? "ครบแล้ว" : c.why}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="rounded-[18px] border border-[#fde68a] bg-[linear-gradient(160deg,#fefce8,#fff)] p-4 text-[12.5px] leading-relaxed text-[#713f12] dark:bg-none dark:text-[#fde68a]">
        <p className="mb-0.5 text-[13px] font-semibold">เคล็ดลับ</p>
        ตั้งวันเปิดรอบเป็นวันพรุ่งนี้ ระบบจะตั้งเวลาส่งให้ และยังกด “ยกเลิกการตั้งเวลา”
        กลับมาแก้ได้ก่อนข้อความออก
      </div>
    </aside>
  );
}

function CheckDot({ ok, size = "sm" }: { ok: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "md" ? "size-[26px]" : "size-5",
        ok ? "text-[#131516]" : "border border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
      )}
      style={ok ? { background: LIME } : undefined}
      aria-label={ok ? "ผ่าน" : "ยังไม่ผ่าน"}
    >
      {ok ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <span className="text-[11px]" aria-hidden="true">
          !
        </span>
      )}
    </span>
  );
}

/* ───────────────────────── step 1: set up ───────────────────────── */

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-foreground/80 mt-6 mb-2.5 text-[13px] font-bold">{children}</h3>;
}

function StepSetup({
  draft,
  update,
  badDates,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  badDates: boolean;
}) {
  const forms = usePublishedForms();
  const list = forms.data?.data ?? [];
  const days = draft.start && draft.end && !badDates ? spanDays(draft.start, draft.end) : null;
  return (
    <div>
      <SectionHeading title="ตั้งรอบ" hint="ชื่อ แบบประเมิน ช่วงเวลา และการแจ้งเตือน" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          ชื่อรอบ
          <Input
            className="h-11"
            value={draft.name}
            maxLength={200}
            onChange={(e) => update({ name: e.target.value })}
          />
          {!draft.name.trim() && (
            <span className="text-xs font-normal text-[#b45309]">กรุณาตั้งชื่อรอบ</span>
          )}
        </label>
        <div className="grid gap-1.5 text-sm font-medium">
          <span>แบบประเมิน</span>
          <Select value={draft.formId} onValueChange={(v) => v && update({ formId: v as string })}>
            <SelectTrigger className="h-11 w-full" aria-label="แบบประเมิน">
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
          <span className="text-muted-foreground text-xs font-normal">
            เลือกได้เฉพาะแบบที่ยืนยันใช้แล้ว ·{" "}
            <Link href="/appraisal/forms" className="text-primary font-semibold hover:underline">
              ไปหน้าแบบประเมิน
            </Link>
          </span>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          วันเปิดรอบ
          <Input
            type="date"
            className="h-11"
            value={draft.start}
            onChange={(e) => update({ start: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          วันปิดรอบ
          <Input
            type="date"
            className="h-11"
            value={draft.end}
            onChange={(e) => update({ end: e.target.value })}
            aria-invalid={badDates || undefined}
          />
          {badDates ? (
            <span className="text-xs font-normal text-[#b45309]">วันปิดต้องไม่ก่อนวันเปิด</span>
          ) : (
            days && (
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {days} วัน
              </span>
            )
          )}
        </label>
      </div>

      {draft.start && draft.end && !badDates && (
        <>
          <Sub>ไทม์ไลน์ของรอบ</Sub>
          <Timeline start={draft.start} end={draft.end} remind={draft.remind} />
        </>
      )}

      <Sub>การแจ้งเตือน</Sub>
      <div className="divide-border border-border grid divide-y rounded-2xl border">
        <ToggleRow
          checked={draft.line}
          onChange={(v) => update({ line: v })}
          title="ส่งทาง LINE ด้วย"
          hint="ในแอปส่งเสมอ · LINE ส่งเฉพาะคนที่ผูกไว้"
        />
        <ToggleRow
          checked={draft.remind}
          onChange={(v) => update({ remind: v })}
          title="เตือนคนที่ยังไม่ส่ง"
          hint={`ก่อนปิดรอบ ${REMIND_BEFORE_DAYS} วัน`}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
      <Switch checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="min-w-0 text-sm">
        <span className="font-semibold">{title}</span>{" "}
        <span className="text-muted-foreground text-xs">· {hint}</span>
      </span>
    </label>
  );
}

/** What happens when, worked out from the two dates. The last point is the HR follow-up after closing. */
function Timeline({ start, end, remind }: { start: string; end: string; remind: boolean }) {
  const remindDay = addDays(end, -REMIND_BEFORE_DAYS);
  const points: { when: string; what: string; later?: boolean }[] = [
    { when: fmtShort(start), what: "เปิดรอบ ส่งข้อความเชิญ" },
    { when: `${fmtShort(start)} – ${fmtShort(end)}`, what: "ผู้ประเมินกรอกและส่ง" },
    ...(remind && remindDay > start
      ? [{ when: fmtShort(remindDay), what: "เตือนคนที่ยังไม่ส่ง" }]
      : []),
    { when: fmtShort(end), what: "ปิดรอบ" },
    { when: "หลังปิดรอบ", what: "HR คำนวณ อนุมัติ และประกาศผล", later: true },
  ];
  return (
    <div className="relative">
      {/* The connecting line (wide screens only); the last stretch, after closing, is grey. */}
      <div
        className="absolute top-[6px] hidden h-[3px] rounded-full sm:block"
        style={{
          left: `${50 / points.length}%`,
          right: `${50 / points.length}%`,
          background: `linear-gradient(90deg, #0d9488 0 ${((points.length - 2) / (points.length - 1)) * 100}%, var(--border) 0)`,
        }}
        aria-hidden="true"
      />
      <ol
        className="grid gap-3 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] sm:gap-2"
        style={{ "--cols": points.length } as CSSProperties}
      >
        {points.map((p) => (
          <li key={p.what} className="relative flex items-baseline gap-2.5 sm:block sm:text-center">
            <span
              className={cn(
                "bg-card relative z-[1] block size-[15px] shrink-0 rounded-full border-[3px] sm:mx-auto",
                p.later ? "border-dashed border-[#c4ccd2]" : "border-[#0d9488]",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <b className="block text-[13px] sm:mt-2">{p.when}</b>
              <span className="text-muted-foreground block text-[11.5px] leading-snug">
                {p.what}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────────────────────── step 2: people ───────────────────────── */

function StepPeople({
  round,
  draft,
  update,
}: {
  round: RoundDetail;
  draft: Draft;
  update: (p: Partial<Draft>) => void;
}) {
  const { data, isLoading, isError, refetch } = useCandidates();
  const depts = useDepartments();
  const people = useMemo(() => data?.data ?? [], [data]);
  const selected = draft.selected;

  // Same divisions as the org chart (small departments grouped as ฝ่ายอื่นๆ); people with no department last.
  const divisions = useMemo(() => {
    const tree = buildCompanyTree(
      (depts.data?.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        parentId: d.parentId,
      })),
      people.map((p) => ({
        id: p.id,
        name: p.name,
        nickname: null,
        departmentId: p.departmentId,
        managerId: null,
        positionTitle: null,
      })),
    );
    const placed = new Set<string>();
    const out = tree.divisions
      .map((d) => {
        const ids = new Set(d.deptIds);
        const members = people.filter((p) => p.departmentId && ids.has(p.departmentId));
        members.forEach((p) => placed.add(p.id));
        return {
          id: d.key,
          name: d.name,
          people: members,
          subs: new Set(d.departments.filter((x) => x.count > 0).map((x) => x.name)),
        };
      })
      .filter((d) => d.people.length > 0);
    const rest = people.filter((p) => !placed.has(p.id));
    if (rest.length)
      out.push({ id: "none", name: "ไม่ระบุแผนก", people: rest, subs: new Set<string>() });
    return out;
  }, [depts.data, people]);

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    update({ selected: next });
  };

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;

  const chosen = people.filter((p) => selected.has(p.id));
  const noManager = chosen.filter((p) => !p.hasManager).length;
  const chosenDivs = divisions.filter((d) => d.people.some((p) => selected.has(p.id)));

  return (
    <div>
      <SectionHeading
        title="เลือกคนที่ถูกประเมิน"
        hint="กดการ์ดเพื่อเลือกทั้งฝ่าย แล้วเปิดรายชื่อด้านล่างเพื่อติ๊กออกรายคน"
      />
      <div
        className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
        role="group"
        aria-label="เลือกทั้งฝ่าย"
      >
        {divisions.map((d) => {
          const ids = d.people.map((p) => p.id);
          const n = ids.filter((id) => selected.has(id)).length;
          const on = n === ids.length;
          const some = n > 0 && !on;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(ids, !on)}
              className={cn(
                "rounded-2xl border-[1.5px] p-3.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px",
                on
                  ? "border-[#0d9488] bg-[linear-gradient(180deg,#f0fdfa,var(--card))] shadow-[0_0_0_3px_#ccfbf1] dark:shadow-none"
                  : some
                    ? "bg-card border-[#0d9488]/60"
                    : "border-border bg-card hover:border-[#0d9488]/50",
              )}
            >
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <b className="block text-sm leading-snug">{d.name}</b>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[...d.subs].join(" · ") || "ทั้งฝ่าย"}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2",
                    on
                      ? "border-[#0f766e] bg-[#0f766e] text-white"
                      : some
                        ? "border-[#0d9488] text-[#0d9488]"
                        : "border-[#c4ccd2]",
                  )}
                  aria-hidden="true"
                >
                  {on ? (
                    <Check className="size-3.5" />
                  ) : some ? (
                    <span className="h-0.5 w-2.5 rounded bg-current" />
                  ) : null}
                </span>
              </span>
              <span className="mt-2.5 flex items-center gap-2">
                <span className="flex">
                  {d.people.slice(0, 3).map((p) => (
                    <PersonAvatar
                      key={p.id}
                      name={p.name}
                      gender={p.gender}
                      seed={p.id}
                      className="ring-card -ml-1.5 size-7 ring-2 first:ml-0"
                    />
                  ))}
                </span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {some ? `${n} / ` : ""}
                  <b className="text-foreground text-xl">{ids.length}</b> คน
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() =>
            toggle(
              people.map((p) => p.id),
              true,
            )
          }
        >
          เลือกทุกคน
        </Button>
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => update({ selected: new Set() })}
          disabled={selected.size === 0}
        >
          ล้างทั้งหมด
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-[#131516] px-4 py-3 text-white">
        <span className="text-sm">
          <b className="text-[22px] tabular-nums" style={{ color: LIME }}>
            {selected.size}
          </b>{" "}
          คนถูกเลือก
        </span>
        <span className="min-w-0 truncate text-[13px] text-white/60">
          {chosenDivs.map((d) => d.name).join(" · ") || "ยังไม่ได้เลือก"}
        </span>
        {noManager > 0 && (
          <span className="ml-auto rounded-full bg-[#fde68a] px-2.5 py-px text-xs font-bold text-[#131516]">
            {noManager} คนยังไม่มีหัวหน้า
          </span>
        )}
      </div>

      <PeopleList round={round} people={people} draft={draft} update={update} toggle={toggle} />
    </div>
  );
}

/** Per-person picking and per-department forms, folded away: most rounds only need the division cards. */
function PeopleList({
  round,
  people,
  draft,
  update,
  toggle,
}: {
  round: RoundDetail;
  people: Candidate[];
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  toggle: (ids: string[], on: boolean) => void;
}) {
  const forms = usePublishedForms();
  const formList = forms.data?.data ?? [];
  const [q, setQ] = useState("");
  const { selected, formOf } = draft;

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, Candidate[]>();
    for (const p of people) {
      if (term && !`${p.name} ${p.code} ${p.department}`.toLowerCase().includes(term)) continue;
      map.set(p.department, [...(map.get(p.department) ?? []), p]);
    }
    return [...map.entries()];
  }, [people, q]);

  /** Give everyone selected in these rows one form ("" = the round's own). */
  const setForm = (ids: string[], formId: string) => {
    const next = { ...formOf };
    for (const id of ids) {
      if (!selected.has(id)) continue;
      if (formId) next[id] = formId;
      else delete next[id];
    }
    update({ formOf: next });
  };

  return (
    <details className="group border-border mt-4 rounded-2xl border">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="text-muted-foreground size-4 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        ดูรายชื่อ เลือกรายคน{formList.length > 1 ? " หรือใช้แบบอื่นบางแผนก" : ""}
        <span className="text-muted-foreground ml-auto text-xs font-normal tabular-nums">
          {selected.size} จาก {people.length} คน
        </span>
      </summary>
      <div className="border-border space-y-3 border-t p-3 sm:p-4">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            aria-label="ค้นหาชื่อ รหัส หรือแผนก"
            placeholder="ค้นหาชื่อ รหัส หรือแผนก"
            className="h-11 pl-9 md:h-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[440px] space-y-4 overflow-y-auto">
          {groups.map(([dept, list]) => {
            const ids = list.map((p) => p.id);
            const all = ids.every((id) => selected.has(id));
            const chosen = ids.filter((id) => selected.has(id));
            const used = new Set(chosen.map((id) => formOf[id] ?? ""));
            const deptForm = used.size === 1 ? [...used][0] : "mixed";
            return (
              <section key={dept} aria-label={dept} className="space-y-1">
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3">
                  <label className="flex min-h-11 flex-1 items-center gap-3 text-sm font-semibold md:min-h-9">
                    <Checkbox checked={all} onCheckedChange={(c) => toggle(ids, c === true)} />
                    {dept}{" "}
                    <span className="text-muted-foreground font-normal">({list.length} คน)</span>
                  </label>
                  {chosen.length > 0 && formList.length > 1 && (
                    <Select
                      value={deptForm === "" ? "default" : deptForm}
                      onValueChange={(v) =>
                        v !== "mixed" && setForm(ids, v === "default" ? "" : (v as string))
                      }
                    >
                      <SelectTrigger
                        className="bg-card h-11 w-auto min-w-[170px] text-xs md:h-8"
                        aria-label={`แบบที่ใช้กับ ${dept}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {deptForm === "mixed" && <SelectItem value="mixed">หลายแบบ</SelectItem>}
                        <SelectItem value="default">แบบหลักของรอบ</SelectItem>
                        {formList.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {list.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3">
                    <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm md:min-h-9">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={(c) => toggle([p.id], c === true)}
                      />
                      <PersonAvatar
                        name={p.name}
                        gender={p.gender}
                        seed={p.id}
                        className="size-7"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {p.name} <span className="text-muted-foreground">{p.code}</span>
                      </span>
                      {!p.hasManager && (
                        <span className="shrink-0 rounded-full bg-[#fffbeb] px-2 py-px text-[11px] font-semibold text-[#b45309]">
                          ไม่มีหัวหน้า
                        </span>
                      )}
                    </label>
                    {selected.has(p.id) && formList.length > 1 && (
                      <Select
                        value={formOf[p.id] ?? "default"}
                        onValueChange={(v) =>
                          setForm([p.id], v === "default" || !v ? "" : (v as string))
                        }
                      >
                        <SelectTrigger
                          className="h-11 w-auto min-w-[150px] text-xs md:h-8"
                          aria-label={`แบบที่ใช้กับ ${p.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">แบบหลักของรอบ</SelectItem>
                          {formList.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
          {groups.length === 0 && (
            <p className="text-muted-foreground text-sm">ไม่พบพนักงานที่ตรงกับคำค้น</p>
          )}
        </div>
        {round.participantIds.length > 0 &&
          round.participantIds.some((id) => !people.some((p) => p.id === id)) && (
            <p className="text-muted-foreground text-xs">
              บางคนในรอบนี้ไม่ได้ทำงานแล้ว ระบบจะเอาออกเมื่อบันทึก
            </p>
          )}
      </div>
    </details>
  );
}

/* ───────────────────────── step 3: who rates whom ───────────────────────── */

/** Small "who rates you" picture for a preset card: manager above, peers beside, a report below, you in the middle. */
function PresetDiagram({ level }: { level: number }) {
  const node = (x: number, y: number, label: string, on: boolean) => (
    <g>
      <circle cx={x} cy={y} r="11" fill={on ? "#0f766e" : "var(--muted)"} />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill={on ? "#fff" : "var(--muted-foreground)"}
      >
        {label}
      </text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, on: boolean) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={on ? "#0d9488" : "var(--border)"}
      strokeWidth="2"
      markerEnd={on ? "url(#pd-ah)" : undefined}
    />
  );
  return (
    <svg viewBox="0 0 160 86" className="my-1.5 block h-[82px] w-full" aria-hidden="true">
      <defs>
        <marker
          id="pd-ah"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0L8 4L0 8z" fill="#0d9488" />
        </marker>
      </defs>
      {arrow(80, 24, 80, 32, true)}
      {arrow(40, 43, 66, 43, level >= 2)}
      {arrow(120, 43, 94, 43, level >= 2)}
      {arrow(80, 74, 80, 58, level >= 3)}
      {node(80, 13, "หน.", true)}
      {node(28, 43, "เพื่อน", level >= 2)}
      {node(132, 43, "เพื่อน", level >= 2)}
      {node(80, 74, "ลูก", level >= 3)}
      <circle cx="80" cy="45" r="12" fill={LIME} />
      <text x="80" y="48.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#131516">
        คุณ
      </text>
      {level >= 1 && (
        <path
          d="M92 40c10-8 12 6 1 9"
          fill="none"
          stroke="#0d9488"
          strokeWidth="2"
          markerEnd="url(#pd-ah)"
        />
      )}
    </svg>
  );
}

function StepRaters({
  round,
  draft,
  update,
  pickPreset,
  saving,
}: {
  round: RoundDetail;
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  pickPreset: (k: PresetKey) => void;
  saving: boolean;
}) {
  const active = PRESET_KEYS.find((k) => sameSet(PRESETS[k], draft.types));
  const total = perspectiveTotal(draft.types, draft.weights);
  const m = round.matching;
  const typesSaved = round.raterTypes;
  const missing = m.rows.filter((r) => typesSaved.includes("MANAGER") && !r.managerId);
  const overloaded = m.exceptions.filter((e) => e.kind === "OVERLOADED");
  const noPeers = m.exceptions.filter((e) => e.kind === "NO_PEERS");

  return (
    <div>
      <SectionHeading
        title="ใครประเมินใคร"
        hint="เลือกรูปแบบ ระบบจับคู่ให้จากผังองค์กรทันที (หัวหน้า = หัวหน้าที่ตั้งไว้ในข้อมูลพนักงาน)"
      />
      <div
        role="group"
        aria-label="รูปแบบการประเมิน"
        className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4"
      >
        {PRESET_KEYS.map((k, i) => (
          <button
            key={k}
            type="button"
            aria-pressed={active === k}
            disabled={saving}
            onClick={() => active !== k && pickPreset(k)}
            className={cn(
              "relative rounded-[18px] border-[1.5px] p-3.5 pb-3 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px disabled:cursor-wait",
              active === k
                ? "border-[#0d9488] bg-[linear-gradient(180deg,#f0fdfa,var(--card))] shadow-[0_0_0_3px_#ccfbf1] dark:shadow-none"
                : "border-border bg-card hover:border-[#0d9488]/50",
            )}
          >
            {k === "90" && (
              <span
                className="absolute top-3 right-3 rounded-full px-2 text-[10.5px] font-bold text-[#131516]"
                style={{ background: LIME }}
              >
                แนะนำรายเดือน
              </span>
            )}
            <span className="text-2xl font-bold tracking-tight">{k}°</span>
            <span className="ml-1.5 text-[12.5px] font-bold text-[#0f766e] dark:text-[#5eead4]">
              {PRESET_TEXT[k].name}
            </span>
            <PresetDiagram level={i} />
            <span className="text-muted-foreground block min-h-[34px] text-xs leading-snug">
              {PRESET_TEXT[k].hint}
            </span>
          </button>
        ))}
      </div>

      {draft.types.includes("PEER") && (
        <p className="bg-muted text-muted-foreground mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]">
          เพื่อนร่วมงาน = คนที่มีหัวหน้าคนเดียวกัน ระบบเลือกให้คนละไม่เกิน {PEER_LIMIT} คน
        </p>
      )}

      <Sub>ผลการจับคู่</Sub>
      {typesSaved.length === 0 || m.rows.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
          {m.rows.length === 0
            ? "ยังไม่ได้เลือกคนที่ถูกประเมิน กลับไปขั้น “เลือกคน”"
            : "เลือกรูปแบบด้านบน ระบบจะจับคู่ให้ทันที"}
        </p>
      ) : (
        <MatchTable round={round} missing={missing} />
      )}

      {(overloaded.length > 0 || noPeers.length > 0) && (
        <ul className="mt-3 space-y-1 text-[12.5px] text-[#b45309]">
          {overloaded.map((e) => (
            <li key={`o-${e.employeeId}`} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {e.name}{" "}
              ต้องประเมิน {e.detail} คน มากเกินไป ลองแบ่งให้หัวหน้าทีมย่อย
            </li>
          ))}
          {noPeers.length > 0 && (
            <li className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {noPeers.length} คนไม่มีเพื่อนร่วมทีม (ไม่มีคนอื่นใต้หัวหน้าเดียวกัน)
              จะไม่มีมุมมองเพื่อน:{" "}
              {noPeers
                .slice(0, 4)
                .map((e) => e.name)
                .join(", ")}
              {noPeers.length > 4 ? " …" : ""}
            </li>
          )}
        </ul>
      )}

      {draft.types.length > 0 && (
        <details
          className="dark:border-border mt-5 rounded-2xl border border-dashed border-[#cfd6dc] px-4 py-3"
          open={!total.ok}
        >
          <summary className="flex min-h-9 cursor-pointer flex-wrap items-center gap-2 text-[13px] font-bold [&::-webkit-details-marker]:hidden">
            น้ำหนักคะแนนแต่ละมุมมอง
            <span className="rounded-md bg-[#ffedd5] px-1.5 text-[11px] font-bold text-[#7c2d12]">
              รอ HR ยืนยัน
            </span>
            <span
              className={cn(
                "ml-auto text-xs font-semibold",
                total.ok ? "text-[#15803d]" : "text-[#b45309]",
              )}
            >
              {total.ok ? "รวม 100%" : `รวม ${total.total}% ต้องเป็น 100%`}
            </span>
          </summary>
          <p className="text-muted-foreground mt-1 text-xs">
            มีผลต่อคะแนนรวม ค่าเริ่มต้นเป็นตัวอย่าง บันทึกเมื่อกดถัดไป
          </p>
          <div className="mt-2 space-y-2">
            {RATER_TYPES.filter((t) => draft.types.includes(t)).map((t) => {
              const w = draft.weights[t] ?? 0;
              return (
                <label key={t} className="flex items-center gap-3 text-sm">
                  <span className="w-[86px] shrink-0">{RATER_LABEL[t]}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-11 w-20 tabular-nums md:h-9"
                    value={w}
                    onChange={(e) =>
                      update({
                        weights: {
                          ...draft.weights,
                          [t]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        },
                      })
                    }
                  />
                  <span className="text-muted-foreground">%</span>
                  <span
                    className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-[#0d9488] transition-[width]"
                      style={{ width: `${w}%` }}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/** The matched raters per person: problems first, the rest folded after a few rows. */
function MatchTable({ round, missing }: { round: RoundDetail; missing: MatchRow[] }) {
  const { can } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const m = round.matching;
  const types = round.raterTypes;
  const rows = [...missing, ...m.rows.filter((r) => !missing.includes(r))];
  const visible = showAll ? rows : rows.slice(0, Math.max(8, missing.length));
  const ready = m.rows.length - missing.length;

  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      <div className="border-border bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-px text-xs font-bold text-[#15803d]">
          ✓ {ready} คนพร้อม
        </span>
        {missing.length > 0 && (
          <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-2.5 py-px text-xs font-bold text-[#b45309]">
            {missing.length} คนยังไม่มีหัวหน้าประเมิน
          </span>
        )}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          รวม {m.assignmentCount} งานประเมิน
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="text-muted-foreground text-left text-[11.5px] font-bold">
              <th className="px-4 py-2 font-bold">ผู้ถูกประเมิน</th>
              <th className="px-4 py-2 font-bold">หัวหน้าประเมิน</th>
              {types.includes("SELF") && <th className="px-3 py-2 font-bold">ตนเอง</th>}
              {types.includes("PEER") && <th className="px-3 py-2 font-bold">เพื่อน</th>}
              {types.includes("SUBORDINATE") && <th className="px-3 py-2 font-bold">ลูกน้อง</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const bad = missing.includes(r);
              return (
                <tr
                  key={r.employeeId}
                  className={cn(
                    "border-border border-t",
                    bad && "bg-[#fffcf2] dark:bg-[#b45309]/10",
                  )}
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <PersonAvatar name={r.name} gender={r.gender} seed={r.employeeId} />
                      <span className="min-w-0">
                        <span className="block leading-snug">{r.name}</span>
                        <span className="text-muted-foreground block text-[11.5px]">
                          {r.department}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.managerId ? (
                      <span className="flex items-center gap-2.5">
                        <PersonAvatar
                          name={r.managerName ?? "-"}
                          gender={r.managerGender}
                          seed={r.managerId}
                        />
                        {r.managerName}
                      </span>
                    ) : can("employee:update") ? (
                      <SetManager row={r} />
                    ) : (
                      <span className="text-xs font-semibold text-[#b45309]">
                        ไม่มีหัวหน้า · ให้ HR ตั้งในผังองค์กร
                      </span>
                    )}
                  </td>
                  {types.includes("SELF") && (
                    <td className="px-3 py-2">{r.self ? <Pill>✓ ตนเอง</Pill> : "–"}</td>
                  )}
                  {types.includes("PEER") && (
                    <td className="px-3 py-2">{r.peers ? <Pill>{r.peers} คน</Pill> : "–"}</td>
                  )}
                  {types.includes("SUBORDINATE") && (
                    <td className="px-3 py-2">{r.subs ? <Pill>{r.subs} คน</Pill> : "–"}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="border-border text-primary hover:bg-muted flex min-h-11 w-full items-center justify-center border-t text-[13px] font-semibold"
        >
          ดูทั้งหมด {rows.length} คน
        </button>
      )}
      {missing.length > 0 && can("employee:update") && (
        <p className="border-border text-muted-foreground border-t px-4 py-2.5 text-xs">
          หัวหน้าที่เลือกตรงนี้จะบันทึกลงผังองค์กรจริง ใช้กับรอบต่อไปและการอนุมัติลา/OT ด้วย ·{" "}
          <Link href="/organization" className="text-primary font-semibold hover:underline">
            เปิดผังองค์กร
          </Link>
        </p>
      )}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-muted inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
      {children}
    </span>
  );
}

/** Picks a manager for someone with none: a real org-chart change, so it asks first. */
function SetManager({ row }: { row: MatchRow }) {
  const { data } = useCandidates();
  const saveMoves = useSaveOrgMoves();
  const [pick, setPick] = useState<string | null>(null);
  const people = (data?.data ?? []).filter((p) => p.id !== row.employeeId);
  const me = data?.data.find((p) => p.id === row.employeeId);
  const chosen = people.find((p) => p.id === pick);
  const invalidateRound = useInvalidateRounds();

  async function confirm() {
    if (!pick) return;
    try {
      await saveMoves.mutateAsync([
        { employeeId: row.employeeId, departmentId: me?.departmentId ?? null, managerId: pick },
      ]);
      await invalidateRound();
      toast.success(`ตั้ง ${chosen?.name ?? ""} เป็นหัวหน้าของ ${row.name} แล้ว`);
      setPick(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <>
      <Select value={pick ?? ""} onValueChange={(v) => setPick((v as string) || null)}>
        <SelectTrigger
          className="bg-card h-10 w-full max-w-[240px] border-[1.5px] border-[#fde68a] text-[12.5px] font-semibold text-[#b45309]"
          aria-label={`เลือกหัวหน้าให้ ${row.name}`}
        >
          <SelectValue placeholder="ไม่มีหัวหน้า · เลือก…" />
        </SelectTrigger>
        <SelectContent>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} · {p.department}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        open={!!pick}
        onOpenChange={(o) => !o && setPick(null)}
        title={`ตั้ง ${chosen?.name ?? ""} เป็นหัวหน้าของ ${row.name}?`}
        description="บันทึกลงผังองค์กร มีผลกับรอบประเมินนี้ รอบต่อไป และการอนุมัติลา/OT ของคนนี้ด้วย"
        confirmLabel="ตั้งเป็นหัวหน้า"
        onConfirm={confirm}
        loading={saveMoves.isPending}
      />
    </>
  );
}

/* ───────────────────────── step 4: review and open ───────────────────────── */

function StepReview({ round, goTo }: { round: RoundDetail; goTo: (i: number) => void }) {
  const inv = round.invitations;
  const ex = inv.example;
  // Not a blocker (they still have other raters), but worth seeing before the messages go out.
  const noManager = round.raterTypes.includes("MANAGER")
    ? round.matching.rows.filter((r) => !r.managerId)
    : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const sendsNow = !!round.startIso && round.startIso <= today;
  const detail: Record<string, string> = {
    form: round.formsUsed.map((f) => f.name).join(" · ") || round.formName,
    people: `${round.participantIds.length} คน`,
    raters: `${round.matching.assignmentCount} งานประเมิน · ผู้ประเมิน ${round.matching.raterCount} คน`,
    schedule: `${fmtShort(round.startIso)} – ${fmtShort(round.endIso)} · LINE ${round.notifyLine ? `${inv.withLine} คน` : "ปิดไว้"} · ในแอป ${inv.appOnly} คน${round.remind ? ` · เตือนก่อนปิด ${REMIND_BEFORE_DAYS} วัน` : ""}`,
  };

  return (
    <div>
      <SectionHeading
        title="ตรวจและเปิดรอบ"
        hint="ทุกข้อต้องผ่านก่อนเปิด · กด “แก้” เพื่อกลับไปขั้นนั้น"
      />
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <ul className="border-border overflow-hidden rounded-2xl border">
            {round.checks.map((c) => (
              <li
                key={c.key}
                className="border-border flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
              >
                <CheckDot ok={c.ok} size="md" />
                <span className="min-w-0 flex-1">
                  <b className="block text-[13.5px]">{CHECK_NAME[c.key]}</b>
                  <span
                    className={cn(
                      "block text-xs break-words",
                      c.ok ? "text-muted-foreground" : "text-[#b45309]",
                    )}
                  >
                    {c.ok ? detail[c.key] : c.why}
                  </span>
                </span>
                <Button
                  variant={c.ok ? "ghost" : "outline"}
                  className="h-11 shrink-0 text-[#0f766e] md:h-9"
                  onClick={() => goTo(CHECK_STEP[c.key])}
                >
                  {c.ok ? "แก้" : "ไปแก้"}
                </Button>
              </li>
            ))}
          </ul>
          {noManager.length > 0 && (
            <p className="mt-3 flex gap-2 text-[12.5px] text-[#b45309]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {noManager.length} คนจะไม่มีหัวหน้าประเมิน (มีแค่มุมมองอื่น):{" "}
                {noManager
                  .slice(0, 4)
                  .map((r) => r.name)
                  .join(", ")}
                {noManager.length > 4 ? " …" : ""}{" "}
                <button
                  type="button"
                  onClick={() => goTo(2)}
                  className="font-semibold underline underline-offset-2"
                >
                  ตั้งหัวหน้า
                </button>
              </span>
            </p>
          )}
          {inv.unreachable > 0 && (
            <p className="mt-3 flex gap-2 text-[12.5px] text-[#b45309]">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ส่งไม่ถึง {inv.unreachable} คน (ยังไม่มีบัญชีเข้าใช้งาน):{" "}
              {inv.unreachableNames.slice(0, 5).join(", ")}
              {inv.unreachableNames.length > 5 ? " …" : ""}
            </p>
          )}
          {!inv.lineConfigured && (
            <p className="text-muted-foreground mt-2 text-xs">
              ระบบยังไม่ได้ตั้งค่า LINE จึงส่งในแอปอย่างเดียว
            </p>
          )}
          <p className="bg-muted mt-3 flex gap-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed">
            <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            เมื่อเปิดรอบ ระบบจำแผนกและตำแหน่งของทุกคน ณ วันนั้น และล็อกคำถามของแบบประเมินไว้
            ถ้าย้ายทีมหรือแก้แบบระหว่างรอบ ผลรอบนี้ยังนับตามเดิม
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {sendsNow
              ? "จะส่งข้อความทันทีที่กดเปิดรอบ"
              : round.startIso
                ? `จะส่งข้อความอัตโนมัติวันที่ ${fmtLong(round.startIso)}`
                : ""}
          </p>
        </div>

        {/* What a rater receives: same title and body as sendInvitations(). */}
        <figure
          className="mx-auto w-full max-w-[280px] rounded-[30px] bg-[#131516] p-2.5 shadow-[0_24px_44px_-22px_rgba(0,0,0,0.6)]"
          aria-label="ตัวอย่างข้อความที่ผู้ประเมินได้รับ"
        >
          <div className="min-h-[300px] rounded-[22px] bg-[#e6eef3] px-3 py-3.5 text-[#131516]">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#3a4248]">
              <span
                className="flex size-[26px] items-center justify-center rounded-full bg-[linear-gradient(150deg,#115e59,#0d9488)] text-[10.5px]"
                style={{ color: LIME }}
              >
                GV
              </span>
              GV One HR{round.notifyLine && inv.lineConfigured ? " · LINE" : " · ในแอป"}
            </div>
            <div className="rounded-[4px_16px_16px_16px] bg-white px-3 py-3 text-[12.5px] leading-relaxed shadow-sm">
              <b className="mb-1 block text-[13px] break-words">ถึงรอบประเมิน: {round.name}</b>
              คุณมี {ex?.count ?? "–"} คนที่ต้องประเมิน
              {round.endIso ? ` ปิดรอบวันที่ ${fmtLong(round.endIso)}` : ""}
              <span className="mt-2.5 block rounded-[10px] bg-[#0f766e] py-2 text-center font-bold text-white">
                เปิดงานประเมิน →
              </span>
            </div>
            <figcaption className="mt-1.5 text-[10.5px] text-[#5e6670]">
              {round.startIso ? `${fmtShort(round.startIso)} · ` : ""}ตัวอย่าง
              {ex ? `: ข้อความถึง ${ex.name}` : ""}
            </figcaption>
          </div>
        </figure>
      </div>
    </div>
  );
}

/** Refetches every round query (detail, list) after an org change moved who rates whom. */
function useInvalidateRounds() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.all });
}
