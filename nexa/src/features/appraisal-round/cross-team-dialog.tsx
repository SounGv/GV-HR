"use client";

import { useMemo, useState } from "react";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCandidates } from "./hooks";
import { addPair, type RaterPairOverrides } from "./rules";
import type { Candidate, RoundDetail } from "./types";

/**
 * "เลือกคู่ข้ามทีม": HR picks a group of people to be rated and a group of colleagues (any team) who rate them, in one go,
 * e.g. this month the warehouse team worked with the online sales team. Pairs are added as peers (เพื่อนร่วมงาน), so their
 * score counts with the weight HR set for peers. "ประเมินกันและกัน" adds the other direction too, for people who are in the round.
 */
export function CrossTeamDialog({
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
  const inRound = useMemo(() => new Set(round.participantIds), [round.participantIds]);
  const ratees = useMemo(() => cands.filter((c) => inRound.has(c.id)), [cands, inRound]);
  const [rateeSel, setRateeSel] = useState<Set<string>>(new Set());
  const [raterSel, setRaterSel] = useState<Set<string>>(new Set());
  const [mutual, setMutual] = useState(false);

  // Peers already in the round (automatic or hand-set), so the count says how many are really new.
  const existing = useMemo(
    () => new Set(round.matching.rows.flatMap((r) => r.raters.filter((x) => x.type === "PEER").map((x) => `${r.employeeId}|${x.id}`))),
    [round.matching.rows],
  );

  const plan = useMemo(() => {
    const pairs: { participantId: string; raterId: string }[] = [];
    const seen = new Set<string>();
    let already = 0;
    let outside = 0;
    const push = (participantId: string, raterId: string) => {
      if (participantId === raterId) return;
      const key = `${participantId}|${raterId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!inRound.has(participantId)) {
        outside++;
        return;
      }
      if (existing.has(key)) {
        already++;
        return;
      }
      pairs.push({ participantId, raterId });
    };
    for (const p of rateeSel)
      for (const r of raterSel) {
        push(p, r);
        if (mutual) push(r, p);
      }
    return { pairs, already, outside };
  }, [rateeSel, raterSel, mutual, inRound, existing]);

  async function add() {
    let next = ov;
    for (const p of plan.pairs) next = addPair(next, { participantId: p.participantId, raterId: p.raterId, raterType: "PEER" });
    if (await apply(next, `เพิ่ม ${plan.pairs.length} คู่ผู้ร่วมงานแล้ว`)) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>เลือกคู่ข้ามทีม</DialogTitle>
          <DialogDescription>
            เลือกคนที่ถูกประเมินกับผู้ร่วมงานที่ประเมินเขา ข้ามฝ่ายได้ ใช้ประเภท “เพื่อนร่วมงาน” คะแนนนับตามน้ำหนักเพื่อนร่วมงานที่ตั้งไว้
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <PickList title="ผู้ถูกประเมิน (เฉพาะคนในรอบนี้)" people={ratees} selected={rateeSel} onChange={setRateeSel} />
          <PickList title="ผู้ประเมิน (ทุกทีม)" people={cands} selected={raterSel} onChange={setRaterSel} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm md:min-h-10">
          <Checkbox checked={mutual} onCheckedChange={(c) => setMutual(c === true)} />
          <span>
            <b>ประเมินกันและกัน</b> <span className="text-muted-foreground">เพิ่มอีกฝั่งด้วย (ผู้ประเมินต้องเป็นคนในรอบนี้ด้วย)</span>
          </span>
        </label>
        <p className="bg-muted rounded-lg px-3.5 py-2.5 text-sm tabular-nums" aria-live="polite">
          {plan.pairs.length === 0 && rateeSel.size + raterSel.size === 0
            ? "เลือกผู้ถูกประเมินและผู้ประเมินทางซ้ายและขวา"
            : `จะเพิ่ม ${plan.pairs.length} คู่ใหม่`}
          {plan.already > 0 && ` · มีอยู่แล้ว ${plan.already} คู่`}
          {plan.outside > 0 && ` · ข้าม ${plan.outside} คู่ (ผู้ถูกประเมินไม่ได้อยู่ในรอบนี้)`}
        </p>
        <DialogFooter>
          <Button variant="outline" className="h-11 md:h-10" onClick={onClose}>
            ปิด
          </Button>
          <Button className="h-11 md:h-10" disabled={busy || plan.pairs.length === 0} onClick={add}>
            เพิ่ม {plan.pairs.length} คู่
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A searchable list grouped by department; the department row ticks everyone shown in it. */
function PickList({
  title,
  people,
  selected,
  onChange,
}: {
  title: string;
  people: Candidate[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, Candidate[]>();
    for (const p of people) {
      if (term && !`${p.name} ${p.code} ${p.department}`.toLowerCase().includes(term)) continue;
      const dept = p.department || "ไม่ระบุแผนก";
      map.set(dept, [...(map.get(dept) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "th"));
  }, [people, q]);

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };

  return (
    <section aria-label={title} className="border-border min-w-0 rounded-lg border">
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <b className="text-sm">{title}</b>
        <span className="text-muted-foreground text-xs tabular-nums">เลือก {selected.size} คน</span>
      </div>
      <div className="p-2">
        <Input aria-label={`ค้นหา ${title}`} placeholder="ค้นหาชื่อ รหัส หรือแผนก" className="h-11 md:h-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-72 overflow-y-auto px-2 pb-2">
        {groups.map(([dept, list]) => {
          const ids = list.map((p) => p.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <div key={dept} className="mb-1">
              <label className="bg-muted flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold md:min-h-10">
                <Checkbox checked={all} onCheckedChange={(c) => toggle(ids, c === true)} />
                <span className="min-w-0 flex-1 break-words">{dept}</span>
                <span className="text-muted-foreground text-xs font-medium tabular-nums">{list.length} คน</span>
              </label>
              {list.map((p) => (
                <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm md:min-h-10">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={(c) => toggle([p.id], c === true)} />
                  <PersonAvatar name={p.name} gender={p.gender} seed={p.id} src={p.avatarUrl} className="size-7" />
                  <span className="min-w-0 flex-1 break-words">{p.name}</span>
                </label>
              ))}
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-muted-foreground px-3 py-4 text-sm">ไม่พบชื่อที่ค้นหา</p>}
      </div>
    </section>
  );
}
