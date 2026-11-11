"use client";

/**
 * Org chart edit mode (org-edit-mock.html): HR drags people between department
 * columns — or picks "ย้ายไป…" on touch / keyboard — and the moves wait in a
 * dark tray until they are reviewed and saved. The chart components read the
 * edit state from {@link OrgEditContext}; null means "not editing".
 */

import { createContext, useContext, useState, type DragEvent, type ReactNode } from "react";
import { ArrowRightLeft, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { OrgDropTarget, OrgPerson } from "./org-tree";

export interface OrgEditState {
  /** The division's columns, for the "ย้ายไป…" select. */
  columns: { id: string; name: string }[];
  /** People with a pending (unsaved) change. */
  moved: ReadonlySet<string>;
  move: (personId: string, target: OrgDropTarget) => void;
}

export const OrgEditContext = createContext<OrgEditState | null>(null);

/** The edit state, or null when the chart is not in edit mode. */
export function useOrgEdit() {
  return useContext(OrgEditContext);
}

const DRAG_TYPE = "application/x-gv-person";

/** Amber "moved" card style from the mock; the word ย้ายแล้ว goes with it so it is never colour-only. */
const MOVED_ROW = "border-[#fde68a] bg-[#fffbeb] dark:border-amber-500/40 dark:bg-amber-500/10";

export function MovedTag() {
  return (
    <span className="shrink-0 rounded-full bg-[#fef3c7] px-1.5 text-[10.5px] leading-[18px] font-bold text-[#92400e] dark:bg-amber-500/20 dark:text-amber-200">
      ย้ายแล้ว
    </span>
  );
}

/**
 * A person row in edit mode: draggable on desktop (grip shown from md up), the
 * amber moved style, and the "ย้ายไป…" select that works on phones and keyboards.
 * `children` gets whether the person has a pending change.
 */
export function EditableRow({
  person,
  className,
  trailing,
  children,
}: {
  person: OrgPerson;
  className?: string;
  trailing?: ReactNode;
  children: (moved: boolean) => ReactNode;
}) {
  const edit = useOrgEdit();
  const [dragging, setDragging] = useState(false);
  const moved = edit?.moved.has(person.id) ?? false;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, person.id);
        e.dataTransfer.setData("text/plain", person.name);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        className,
        "select-none md:cursor-grab md:active:cursor-grabbing",
        moved && MOVED_ROW,
        dragging && "opacity-40",
      )}
    >
      <GripVertical className="-mx-1 hidden size-3.5 shrink-0 text-[#a3acb4] md:block" aria-hidden="true" />
      {children(moved)}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {trailing}
        <MoveSelect person={person} />
      </span>
    </div>
  );
}

/** Native select over a small icon button: opens the phone's own picker, works with the keyboard. */
function MoveSelect({ person }: { person: OrgPerson }) {
  const edit = useOrgEdit();
  if (!edit) return null;
  return (
    <label
      title="ย้ายไป…"
      className="relative grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors focus-within:border-[#0d9488] focus-within:text-[#0f766e] focus-within:ring-2 focus-within:ring-[#0d9488]/40 hover:border-[#0d9488] hover:text-[#0f766e] md:size-8 dark:focus-within:text-primary dark:hover:text-primary"
    >
      <ArrowRightLeft className="size-4" aria-hidden="true" />
      <select
        value=""
        aria-label={`ย้าย ${person.name} ไป…`}
        onChange={(e) => {
          const [slot, deptId] = e.target.value.split(":");
          if (deptId && (slot === "lead" || slot === "member")) edit.move(person.id, { deptId, slot });
        }}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        <option value="" disabled>
          ย้ายไป…
        </option>
        <optgroup label="ย้ายเข้าแผนก">
          {edit.columns.map((c) => (
            <option key={c.id} value={`member:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="ตั้งเป็นหัวหน้าทีม">
          {edit.columns.map((c) => (
            <option key={c.id} value={`lead:${c.id}`}>
              หัวหน้าทีม · {c.name}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

/** A column's lead slot or members zone. Outside edit mode it is a plain wrapper. */
export function DropZone({
  target,
  label,
  className,
  children,
}: {
  target: OrgDropTarget;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const edit = useOrgEdit();
  const [over, setOver] = useState(false);
  if (!edit) return <div className={className}>{children}</div>;

  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <div
      role="group"
      aria-label={label}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) edit.move(id, target);
      }}
      className={cn(
        className,
        "m-1.5 min-h-11 rounded-xl p-2 outline-2 -outline-offset-2 outline-[#d7e3e1] outline-dashed transition-colors motion-reduce:transition-none dark:outline-border",
        over && "bg-[#ecfdf5] outline-[#0d9488] dark:bg-primary/10 dark:outline-primary",
      )}
    >
      <p className="mb-1 px-1 text-[11px] font-bold tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function DropHint({ children }: { children: ReactNode }) {
  return <p className="px-1 py-1.5 text-xs text-muted-foreground">{children}</p>;
}

/** One pending change as the tray and the confirm dialog show it. */
export interface MoveRow {
  id: string;
  name: string;
  before: { dept: string; manager: string };
  after: { dept: string; manager: string };
}

const TRAY_BTN =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-[13.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CDEB03] motion-reduce:transition-none md:h-10";

/** Fixed dark tray with the unsaved changes; slides up once there is at least one. */
export function PendingTray({
  rows,
  onUndoAll,
  onReview,
}: {
  rows: MoveRow[];
  onUndoAll: () => void;
  onReview: () => void;
}) {
  const show = rows.length > 0;
  return (
    <div
      role="region"
      aria-label="การเปลี่ยนผังที่ยังไม่บันทึก"
      inert={!show}
      className={cn(
        "fixed left-1/2 z-[45] w-[min(860px,calc(100%-32px))] -translate-x-1/2 rounded-2xl bg-[#131516] px-3.5 py-3 text-white shadow-[0_24px_48px_-16px_rgba(0,0,0,.5)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none",
        "bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] md:bottom-5",
        show ? "translate-y-0" : "translate-y-[calc(100%+120px)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-live="polite">
          <b className="text-sm tabular-nums">{rows.length} รายการ</b>{" "}
          <small className="text-xs text-[#aab2b8]">ที่เปลี่ยน ยังไม่บันทึก</small>
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onUndoAll} className={cn(TRAY_BTN, "border border-[#3a4046] hover:bg-white/10")}>
          ย้อนกลับทั้งหมด
        </button>
        <button type="button" onClick={onReview} className={cn(TRAY_BTN, "bg-[#CDEB03] text-[#131516] hover:bg-[#d8f23a]")}>
          ตรวจและบันทึก →
        </button>
      </div>
      <ul className="mt-2 grid max-h-[140px] list-none gap-1 overflow-auto text-[12.5px] text-[#d5dbdf]">
        {rows.map((r) => (
          <li key={r.id} className="min-w-0">
            {r.name}: <span className="text-[#9aa3aa]">{r.before.dept} · {r.before.manager}</span> →{" "}
            <em className="font-bold text-[#CDEB03] not-italic">
              {r.after.dept} · {r.after.manager}
            </em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Before → after table; saving writes the employees and their audit history. */
export function ConfirmMovesDialog({
  open,
  onOpenChange,
  rows,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: MoveRow[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">ยืนยันการเปลี่ยนผัง ({rows.length} คน)</DialogTitle>
          <DialogDescription>ระบบจะแก้ข้อมูลพนักงานตามตารางนี้ และบันทึกประวัติการแก้ไข</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[55vh] overflow-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted-foreground">
                <th scope="col" className="border-b border-border px-2 py-1.5 font-bold">
                  พนักงาน
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 font-bold">
                  ก่อน
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 font-bold">
                  หลัง
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <th scope="row" className="border-b border-border px-2 py-2 text-left font-semibold">
                    {r.name}
                  </th>
                  <td className="border-b border-border px-2 py-2 text-muted-foreground">
                    <span className="block">{r.before.dept}</span>
                    <small className="block text-xs">หัวหน้า: {r.before.manager}</small>
                  </td>
                  <td className="border-b border-border px-2 py-2">
                    <b className="block">{r.after.dept}</b>
                    <small className="block text-xs">หัวหน้า: {r.after.manager}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 md:h-9" disabled={saving} onClick={() => onOpenChange(false)}>
            กลับไปแก้
          </Button>
          <Button className="h-11 md:h-9" disabled={saving} onClick={onSave}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
