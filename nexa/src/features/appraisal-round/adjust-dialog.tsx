"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { checkAdjustment, checkRevert, MAX_ADJUST_POINTS, MIN_REASON_LENGTH } from "./adjust-rules";
import { useAdjustScore, useRevertAdjustment } from "./hooks";
import type { ReviewPerson } from "./types";

/**
 * HR changes one calculated score by hand, or undoes an earlier change. The same rules as the server run first, so the
 * message appears at once; the server checks again. The limit is measured from the score the calculation gave.
 */
export function AdjustDialog({ roundId, person, onClose }: { roundId: string; person: ReviewPerson | null; onClose: () => void }) {
  return (
    <Dialog open={person !== null} onOpenChange={(o) => !o && onClose()} disablePointerDismissal>
      <DialogContent className="sm:max-w-md">{person && <Form key={person.participantId} roundId={roundId} person={person} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Form({ roundId, person, onClose }: { roundId: string; person: ReviewPerson; onClose: () => void }) {
  const adjust = useAdjustScore(roundId);
  const revert = useRevertAdjustment(roundId);
  const [mode, setMode] = useState<"adjust" | "revert">("adjust");
  const [score, setScore] = useState(String(person.total));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const original = person.original ?? person.total;
  const lo = Math.max(0, Math.round((original - MAX_ADJUST_POINTS) * 10) / 10);
  const hi = Math.min(100, Math.round((original + MAX_ADJUST_POINTS) * 10) / 10);
  const busy = adjust.isPending || revert.isPending;

  async function save() {
    const problem =
      mode === "adjust" ? checkAdjustment({ original, current: person.total, next: Number(score), reason }) : checkRevert(reason);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    try {
      if (mode === "adjust") {
        await adjust.mutateAsync({ participantId: person.participantId, scorePercent: Number(score), reason: reason.trim() });
        toast.success("บันทึกการปรับคะแนนแล้ว คะแนนที่คำนวณได้ยังเก็บไว้");
      } else {
        await revert.mutateAsync({ participantId: person.participantId, reason: reason.trim() });
        toast.success("ยกเลิกการปรับแล้ว กลับไปใช้คะแนนที่คำนวณได้");
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ ตรวจสัญญาณอินเทอร์เน็ต แล้วลองใหม่");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "adjust" ? "ปรับคะแนน" : "ยกเลิกการปรับ"}</DialogTitle>
        <DialogDescription>
          {person.name} {person.department}
        </DialogDescription>
      </DialogHeader>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="text-muted-foreground">คะแนนที่คำนวณได้</dt>
          <dd className="font-semibold tabular-nums">{original}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ตอนนี้</dt>
          <dd className="font-semibold tabular-nums">
            {person.total}% {person.grade ?? ""}
          </dd>
        </div>
      </dl>

      {mode === "adjust" ? (
        <div className="space-y-1">
          <label htmlFor="adjust-score" className="text-sm font-medium">
            คะแนนใหม่ (%)
          </label>
          <input
            id="adjust-score"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base tabular-nums md:h-10"
          />
          <p className="text-xs text-muted-foreground">
            ปรับได้ไม่เกิน {MAX_ADJUST_POINTS} จุดจากคะแนนที่คำนวณได้ ใส่ค่าระหว่าง {lo} ถึง {hi}
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">จะคืนคะแนนเป็น {original}% ตามที่คำนวณได้ และคำนวณเกรดใหม่ตามเกณฑ์ปัจจุบัน</p>
      )}

      <div className="space-y-1">
        <label htmlFor="adjust-reason" className="text-sm font-medium">
          {mode === "adjust" ? "เหตุผลที่ปรับ" : "เหตุผลที่ยกเลิกการปรับ"}
        </label>
        <Textarea
          id="adjust-reason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "adjust" ? "เช่น หัวหน้าให้คะแนนต่ำกว่าผลงานจริงที่มีหลักฐาน" : "เช่น ตรวจแล้วคะแนนเดิมถูกต้อง"}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">อย่างน้อย {MIN_REASON_LENGTH} ตัวอักษร เก็บไว้ในประวัติ พนักงานจะไม่เห็นประวัตินี้</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        {person.adjusted && (
          <Button
            variant="outline"
            className="h-11 sm:mr-auto md:h-9"
            onClick={() => {
              setMode(mode === "adjust" ? "revert" : "adjust");
              setError("");
            }}
            disabled={busy}
          >
            {mode === "adjust" ? "ยกเลิกการปรับ" : "กลับไปปรับคะแนน"}
          </Button>
        )}
        <Button variant="outline" className="h-11 md:h-9" onClick={onClose} disabled={busy}>
          ปิด
        </Button>
        <Button className="h-11 md:h-9" onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />}
          {mode === "adjust" ? "บันทึกการปรับคะแนน" : "ยืนยันยกเลิกการปรับ"}
        </Button>
      </DialogFooter>
    </>
  );
}
