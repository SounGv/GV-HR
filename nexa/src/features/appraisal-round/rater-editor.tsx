"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCandidates, useSaveRound } from "./hooks";
import { parsePairLines, type PairProblemKind } from "./pair-import";
import { addPair, removePair, type RaterPairOverrides, type RaterType } from "./rules";
import { RATER_LABEL, type MatchRow, type RoundDetail } from "./types";

const PROBLEM_TEXT: Record<PairProblemKind, string> = {
  FORMAT: "รูปแบบไม่ถูกต้อง (ต้องมี ผู้ประเมิน | ผู้ถูกประเมิน)",
  NO_RATER: "หาชื่อผู้ประเมินไม่พบ",
  NO_RATEE: "หาชื่อผู้ถูกประเมินไม่พบ",
  AMBIGUOUS_RATER: "ชื่อผู้ประเมินซ้ำกับหลายคน",
  AMBIGUOUS_RATEE: "ชื่อผู้ถูกประเมินซ้ำกับหลายคน",
  BAD_TYPE: "ประเภทไม่ถูกต้อง (ใช้ หัวหน้า ลูกน้อง เพื่อน ตนเอง)",
  BAD_PAIR: "คู่นี้ใช้ไม่ได้ (ประเมินตัวเองต้องเป็นประเภท ตนเอง)",
  DUPLICATE: "ซ้ำกับบรรทัดก่อนหน้า",
};

const MAX_SHOWN = 8;

/**
 * "ตั้งผู้ประเมินเอง": HR adds, takes out or imports rater pairs on top of what the org chart gave, for lists that cross departments
 * (managers rating other managers, staff choosing which managers to rate). Every change is saved at once on the draft round.
 */
export function RaterPairsPanel({ round }: { round: RoundDetail }) {
  const save = useSaveRound(round.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"ratee" | "rater">("ratee");
  const [raterSel, setRaterSel] = useState<string | null>(null);
  const [dept, setDept] = useState("");
  const ov: RaterPairOverrides = round.overrides;
  const m = round.matching;
  const noRater = useMemo(() => new Set(m.exceptions.filter((e) => e.kind === "NO_RATER").map((e) => e.employeeId)), [m.exceptions]);
  const rows = useMemo(() => {
    const term = q.trim();
    const list = term ? m.rows.filter((r) => r.name.includes(term)) : m.rows;
    return [...list.filter((r) => noRater.has(r.employeeId)), ...list.filter((r) => !noRater.has(r.employeeId))];
  }, [m.rows, noRater, q]);
  const visible = showAll || q.trim() ? rows : rows.slice(0, Math.max(MAX_SHOWN, [...noRater].length));
  const editRow = editing ? m.rows.find((r) => r.employeeId === editing) : undefined;
  const departments = useMemo(() => [...new Set(m.rows.map((r) => r.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [m.rows]);
  // The same pairs seen from the other side (Favpo "จับคู่ประเมิน (ผู้ประเมิน)"): every rater with the people that rater has to rate.
  const byRater = useMemo(() => {
    const by = new Map<string, { id: string; name: string; lines: { row: MatchRow; rater: MatchRow["raters"][number] }[] }>();
    for (const r of m.rows) {
      if (dept && r.department !== dept) continue;
      for (const x of r.raters) {
        const g = by.get(x.id) ?? { id: x.id, name: x.name, lines: [] };
        g.lines.push({ row: r, rater: x });
        by.set(x.id, g);
      }
    }
    const term = q.trim();
    return [...by.values()].filter((g) => !term || g.name.includes(term)).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [m.rows, dept, q]);
  const raterOpen = byRater.find((g) => g.id === raterSel) ?? byRater[0];

  async function apply(next: RaterPairOverrides, done: string) {
    try {
      await save.mutateAsync({ raterPairs: next.add.length || next.remove.length ? next : null });
      toast.success(done);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return false;
    }
  }

  const handCount = ov.add.length + ov.remove.length;

  return (
    <section className="mt-6" aria-label="ตั้งผู้ประเมินเอง">
      <div className="bg-accent flex flex-wrap items-center gap-2 rounded-lg px-4 py-3">
        <b className="text-sm">ตั้งผู้ประเมินเอง</b>
        {handCount === 0 ? (
          <span className="text-muted-foreground text-sm">ยังไม่ได้ตั้ง ใช้ที่ระบบจับคู่จากผังองค์กร</span>
        ) : (
          <>
            <span className="rounded-full border border-primary bg-card px-2.5 py-px text-xs font-semibold text-primary tabular-nums">เพิ่ม {m.manual.added} คู่</span>
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-px text-xs font-semibold tabular-nums">ตัดออก {m.manual.removed} คู่</span>
            {m.manual.ignored > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-late-bg px-2.5 py-px text-xs font-semibold text-status-late-fg tabular-nums">
                <TriangleAlert className="size-3" aria-hidden="true" /> ใช้ไม่ได้ {m.manual.ignored} คู่ (ประเภทที่รอบนี้ไม่ได้เลือก หรือผู้ประเมินไม่ได้ทำงานแล้ว)
              </span>
            )}
          </>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setImporting(true)} disabled={save.isPending}>
            นำเข้ารายชื่อคู่
          </Button>
          {handCount > 0 && (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setClearing(true)} disabled={save.isPending}>
              ล้างที่ตั้งเอง
            </Button>
          )}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        ใช้เมื่อผังองค์กรไม่ตรงกับที่ทำจริง เช่น หัวหน้าประเมินคนต่างฝ่าย หรือลูกน้องเลือกประเมินหัวหน้าหลายคน ป้ายเขียว = ตั้งเอง ป้ายขาว = ระบบจับคู่จากผังองค์กร
      </p>

      <div className="mt-3 inline-flex overflow-hidden rounded-sm border border-border" role="group" aria-label="มุมมองการจับคู่">
        {([
          ["ratee", "ตามผู้ถูกประเมิน"],
          ["rater", "ตามผู้ประเมิน"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={view === k}
            onClick={() => setView(k)}
            className={cn("min-h-11 px-4 text-sm font-medium md:min-h-9", view === k ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "rater" && (
        <div className="mt-3 grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1.7fr)]">
          <div className="space-y-2 rounded-sm border border-border p-3">
            <label className="block text-sm font-medium" htmlFor="rater-q">
              ค้นหาผู้ประเมิน
            </label>
            <Input id="rater-q" className="h-11 md:h-9" placeholder="ชื่อ" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="block pt-1 text-sm font-medium" htmlFor="rater-dept">
              แผนกของผู้ถูกประเมิน
            </label>
            <select id="rater-dept" value={dept} onChange={(e) => setDept(e.target.value)} className="border-input bg-background h-11 w-full rounded-md border px-2 text-sm md:h-9">
              <option value="">ทุกแผนก</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs tabular-nums">ผู้ประเมิน {byRater.length} คน</p>
          </div>
          <div className="max-h-[32rem] overflow-y-auto rounded-sm border border-border">
            <p className="bg-card border-border sticky top-0 border-b px-3 py-2 text-sm font-bold">ผู้ประเมิน (จำนวนที่ต้องประเมิน)</p>
            {byRater.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-sm">ไม่พบผู้ประเมิน</p>
            ) : (
              <ul>
                {byRater.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      aria-pressed={raterOpen?.id === g.id}
                      onClick={() => setRaterSel(g.id)}
                      className={cn("border-border flex min-h-11 w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-[#f6f9fe]", raterOpen?.id === g.id && "bg-accent font-bold")}
                    >
                      <span className="min-w-0 break-words">{g.name}</span>
                      <span className="text-muted-foreground tabular-nums">{g.lines.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-x-auto rounded-sm">
            {raterOpen ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">No.</TableHead>
                    <TableHead className="w-full">ผู้ถูกประเมิน ของ {raterOpen.name}</TableHead>
                    <TableHead>แผนก</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raterOpen.lines.map(({ row, rater }, i) => (
                    <TableRow key={`${row.employeeId}-${rater.type}`}>
                      <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                      <TableCell className="whitespace-normal">
                        {row.name}
                        {rater.manual && <span className="text-primary ml-2 text-xs font-semibold">ตั้งเอง</span>}
                      </TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{RATER_LABEL[rater.type]}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          disabled={save.isPending}
                          aria-label={`ตัด ${raterOpen.name} ออกจากผู้ประเมินของ ${row.name}`}
                          onClick={() => apply(removePair(ov, { participantId: row.employeeId, raterId: rater.id, raterType: rater.type }), "ตัดผู้ประเมินออกแล้ว")}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground rounded-sm border border-border px-3 py-6 text-center text-sm">เลือกผู้ประเมินทางซ้ายเพื่อดูว่าต้องประเมินใครบ้าง</p>
            )}
          </div>
        </div>
      )}

      <div className={cn("mt-3 flex items-center gap-2", view === "rater" && "hidden")}>
        <Input className="h-11 max-w-xs md:h-9" placeholder="ค้นหาชื่อ" aria-label="ค้นหาผู้ถูกประเมิน" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-muted-foreground text-xs tabular-nums">
          แสดง {visible.length} จาก {rows.length} คน
        </span>
      </div>

      <div className={cn("border-border mt-3 overflow-x-auto rounded-sm border", view === "rater" && "hidden")}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs font-bold">
              <th className="border-border border-r px-4 py-2 text-[13px] font-bold">ผู้ถูกประเมิน</th>
              <th className="border-border border-r px-4 py-2 text-[13px] font-bold">ผู้ประเมิน</th>
              <th className="border-border border-r px-3 py-2 text-[13px] font-bold">จำนวน</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const none = noRater.has(r.employeeId);
              return (
                <tr key={r.employeeId} className={cn("border-border border-t align-top", none && "bg-status-late-bg/60")}>
                  <td className="border-border border-r px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <PersonAvatar name={r.name} gender={r.gender} seed={r.employeeId} src={r.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block leading-snug">{r.name}</span>
                        <span className="text-muted-foreground block text-xs">{r.department}</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-border border-r px-4 py-2">
                    {r.raters.length === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-late-bg px-2.5 py-px text-xs font-semibold text-status-late-fg">
                        <X className="size-3" aria-hidden="true" /> ยังไม่มีผู้ประเมิน
                      </span>
                    ) : (
                      <RaterChips row={r} onRemove={(x) => apply(removePair(ov, { participantId: r.employeeId, raterId: x.id, raterType: x.type }), "ตัดผู้ประเมินออกแล้ว")} busy={save.isPending} onlyManual />
                    )}
                  </td>
                  <td className="border-border border-r px-3 py-2 tabular-nums">{r.raters.length} คน</td>
                  <td className="px-3 py-2">
                    <Button variant={none ? "default" : "outline"} className="h-11 md:h-8" onClick={() => setEditing(r.employeeId)}>
                      {none ? "เพิ่มผู้ประเมิน" : "แก้ผู้ประเมิน"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-sm">
                  ไม่พบชื่อที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view === "ratee" && !q.trim() && rows.length > visible.length && (
        <Button variant="ghost" className="mt-2 h-11 md:h-9" onClick={() => setShowAll(true)}>
          ดูทั้งหมด {rows.length} คน
        </Button>
      )}

      {editRow && <EditRatersDialog round={round} row={editRow} ov={ov} apply={apply} busy={save.isPending} onClose={() => setEditing(null)} />}
      {importing && <ImportPairsDialog round={round} ov={ov} apply={apply} busy={save.isPending} onClose={() => setImporting(false)} />}
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="ล้างที่ตั้งเอง?"
        description={`จะลบที่เพิ่มไว้ ${m.manual.added} คู่ และคืนที่ตัดออกไว้ ${m.manual.removed} คู่ กลับไปใช้ที่ระบบจับคู่จากผังองค์กรทั้งหมด`}
        confirmLabel="ล้างที่ตั้งเอง"
        destructive
        loading={save.isPending}
        onConfirm={async () => {
          if (await apply({ add: [], remove: [] }, "ล้างที่ตั้งเองแล้ว")) setClearing(false);
        }}
      />
    </section>
  );
}

function RaterChips({
  row,
  onRemove,
  busy,
  onlyManual = false,
}: {
  row: MatchRow;
  onRemove: (r: MatchRow["raters"][number]) => void;
  busy: boolean;
  onlyManual?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {row.raters.map((x) => (
        <li
          key={`${x.id}-${x.type}`}
          className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-px text-sm", x.manual ? "border-primary bg-accent" : "border-border bg-card")}
        >
          <span className="text-muted-foreground text-xs">{RATER_LABEL[x.type]}</span>
          <span>{x.id === row.employeeId ? "ตนเอง" : x.name}</span>
          {(x.manual || !onlyManual) && (
            <button
              type="button"
              disabled={busy}
              aria-label={`ตัดผู้ประเมิน ${x.name} ออก`}
              onClick={() => onRemove(x)}
              className="text-muted-foreground hover:text-foreground relative -mr-1 inline-flex size-6 items-center justify-center rounded-full before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function EditRatersDialog({
  round,
  row,
  ov,
  apply,
  busy,
  onClose,
}: {
  round: RoundDetail;
  row: MatchRow;
  ov: RaterPairOverrides;
  apply: (next: RaterPairOverrides, done: string) => Promise<boolean>;
  busy: boolean;
  onClose: () => void;
}) {
  const { data } = useCandidates();
  const cands = useMemo(() => data?.data ?? [], [data]);
  const [type, setType] = useState<RaterType>(round.raterTypes.includes("MANAGER") ? "MANAGER" : (round.raterTypes[0] ?? "MANAGER"));
  const [term, setTerm] = useState("");
  const found = useMemo(() => {
    const t = term.trim();
    if (!t) return [];
    return cands.filter((c) => c.id !== row.employeeId && c.name.includes(t) && !row.raters.some((x) => x.id === c.id && x.type === type)).slice(0, 8);
  }, [cands, term, row.employeeId, row.raters, type]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ผู้ประเมินของ {row.name}</DialogTitle>
          <DialogDescription>เพิ่มหรือตัดผู้ประเมินได้ทุกคนในบริษัท ไม่จำกัดฝ่าย การเปลี่ยนบันทึกทันที</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {row.raters.length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีผู้ประเมิน</p>
          ) : (
            <RaterChips row={row} busy={busy} onRemove={(x) => apply(removePair(ov, { participantId: row.employeeId, raterId: x.id, raterType: x.type }), "ตัดผู้ประเมินออกแล้ว")} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-11 min-w-[180px] flex-1 md:h-9" placeholder="ค้นหาชื่อพนักงาน" aria-label="ค้นหาผู้ประเมิน" value={term} onChange={(e) => setTerm(e.target.value)} />
            <Select value={type} onValueChange={(v) => v && setType(v as RaterType)}>
              <SelectTrigger className="h-11 w-[150px] md:h-9" aria-label="ประเภทผู้ประเมิน">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {round.raterTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RATER_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-xs">ประเภทต้องเป็นประเภทที่รอบนี้เลือกไว้ น้ำหนักคะแนนใช้ตามประเภท</p>
          {type === "SELF" ? (
            <Button
              className="h-11 md:h-9"
              disabled={busy || row.raters.some((x) => x.type === "SELF")}
              onClick={() => apply(addPair(ov, { participantId: row.employeeId, raterId: row.employeeId, raterType: "SELF" }), "เพิ่มผู้ประเมินแล้ว")}
            >
              <Plus className="size-4" aria-hidden="true" /> ให้ประเมินตนเอง
            </Button>
          ) : (
            <ul className="divide-border divide-y">
              {found.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PersonAvatar name={c.name} gender={c.gender} seed={c.id} src={c.avatarUrl} />
                    <span className="min-w-0 text-sm">
                      {c.name}
                      <span className="text-muted-foreground block text-xs">{c.department}</span>
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    className="h-11 md:h-8"
                    disabled={busy}
                    onClick={() => apply(addPair(ov, { participantId: row.employeeId, raterId: c.id, raterType: type }), "เพิ่มผู้ประเมินแล้ว")}
                  >
                    <Plus className="size-4" aria-hidden="true" /> เพิ่ม
                  </Button>
                </li>
              ))}
              {term.trim() && found.length === 0 && <li className="text-muted-foreground py-2 text-sm">ไม่พบชื่อที่ยังไม่ได้เป็นผู้ประเมินประเภทนี้</li>}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPairsDialog({
  round,
  ov,
  apply,
  busy,
  onClose,
}: {
  round: RoundDetail;
  ov: RaterPairOverrides;
  apply: (next: RaterPairOverrides, done: string) => Promise<boolean>;
  busy: boolean;
  onClose: () => void;
}) {
  const { data } = useCandidates();
  const cands = useMemo(() => data?.data ?? [], [data]);
  const [text, setText] = useState("");
  const [type, setType] = useState<RaterType>(round.raterTypes.includes("MANAGER") ? "MANAGER" : (round.raterTypes[0] ?? "MANAGER"));
  const inRound = useMemo(() => new Set(round.participantIds), [round.participantIds]);
  const parsed = useMemo(() => parsePairLines(text, cands.map((c) => ({ id: c.id, name: c.name })), type), [text, cands, type]);
  const usable = parsed.pairs.filter((p) => inRound.has(p.participantId) && round.raterTypes.includes(p.raterType));
  const notInRound = parsed.pairs.filter((p) => !inRound.has(p.participantId)).length;
  const typeNotUsed = parsed.pairs.filter((p) => inRound.has(p.participantId) && !round.raterTypes.includes(p.raterType)).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>นำเข้ารายชื่อคู่</DialogTitle>
          <DialogDescription>วางรายการ บรรทัดละคู่: ผู้ประเมิน | ผู้ถูกประเมิน | ประเภท (ไม่ใส่ประเภท = ใช้ประเภทเริ่มต้นด้านล่าง) ค้นหาจากชื่อและนามสกุล</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea className="min-h-32 font-mono text-sm" aria-label="รายชื่อคู่" placeholder={"สมชาย ใจดี | สมหญิง รักงาน | หัวหน้า"} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">ประเภทเริ่มต้น</span>
            <Select value={type} onValueChange={(v) => v && setType(v as RaterType)}>
              <SelectTrigger className="h-11 w-[150px] md:h-9" aria-label="ประเภทเริ่มต้น">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {round.raterTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RATER_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {text.trim() && (
            <div className="space-y-1.5 text-sm" aria-live="polite">
              <p className="inline-flex items-center gap-1 rounded-full bg-status-normal-bg px-2.5 py-px text-xs font-semibold text-success tabular-nums">✓ ใช้ได้ {usable.length} คู่</p>
              {notInRound > 0 && <p className="text-status-late-fg text-xs">{notInRound} คู่ข้าม เพราะผู้ถูกประเมินไม่ได้อยู่ในรอบนี้ (เพิ่มในขั้น “เลือกคน” ก่อน)</p>}
              {typeNotUsed > 0 && <p className="text-status-late-fg text-xs">{typeNotUsed} คู่ข้าม เพราะรอบนี้ไม่ได้เลือกประเภทนั้น</p>}
              {parsed.problems.length > 0 && (
                <ul className="text-status-late-fg space-y-0.5 text-xs">
                  {parsed.problems.slice(0, 6).map((p) => (
                    <li key={p.line} className="flex gap-1.5">
                      <X className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      <span>
                        บรรทัด {p.line}: {PROBLEM_TEXT[p.kind]} <span className="text-muted-foreground">({p.text.slice(0, 40)})</span>
                      </span>
                    </li>
                  ))}
                  {parsed.problems.length > 6 && <li className="text-muted-foreground">และอีก {parsed.problems.length - 6} บรรทัด</li>}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            disabled={busy || usable.length === 0}
            onClick={async () => {
              const next = usable.reduce((acc, p) => addPair(acc, p), ov);
              if (await apply(next, `นำเข้า ${usable.length} คู่แล้ว`)) onClose();
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} เพิ่ม {usable.length} คู่
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
