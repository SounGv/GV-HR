"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type LucideIcon, FileText, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useUpdateOvertimeReason, useUpdateOvertimeNote } from "./hooks";

/**
 * Full card body (header + current value + inline editor) shared by the
 * reason (requester-owned) and decision-note (manager/HR-owned) cards on the
 * OT detail page — kept as one client component, not a header-only button,
 * because the expanded textarea has to replace the value paragraph below the
 * header, not squeeze into the header's own flex row. Visibility (`show`) is
 * computed server-side by the page from the same own/managesTarget/HR rules
 * the service enforces, so this never has to duplicate that logic.
 */
function EditableNoteCard({
  icon: Icon,
  label,
  value,
  placeholder,
  show,
  isPending,
  onSave,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  placeholder: string;
  show: boolean;
  isPending: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {Icon && <Icon className="size-4" />} {label}
        </div>
        {show && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" /> แก้ไข
          </Button>
        )}
      </div>
      {!editing ? (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{value || "—"}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            disabled={isPending}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={async () => {
                await onSave(draft);
                setEditing(false);
              }}
            >
              <Check className="size-4" /> บันทึก
            </Button>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setEditing(false)}>
              <X className="size-4" /> ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function ReasonCard({
  id,
  reason,
  canEdit,
}: {
  id: string;
  reason: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const mut = useUpdateOvertimeReason();

  return (
    <EditableNoteCard
      icon={FileText}
      label="เหตุผล"
      value={reason}
      placeholder="เหตุผลการขอ OT"
      show={canEdit}
      isPending={mut.isPending}
      onSave={async (next) => {
        try {
          await mut.mutateAsync({ id, reason: next });
          toast.success("บันทึกเหตุผลเรียบร้อย");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
        }
      }}
    />
  );
}

export function DecisionNoteCard({
  id,
  note,
  canEdit,
}: {
  id: string;
  note: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const mut = useUpdateOvertimeNote();

  return (
    <EditableNoteCard
      label="คำสั่งการอนุมัติ"
      value={note}
      placeholder="หมายเหตุการอนุมัติ/ปฏิเสธ"
      show={canEdit}
      isPending={mut.isPending}
      onSave={async (next) => {
        try {
          await mut.mutateAsync({ id, note: next });
          toast.success("บันทึกหมายเหตุเรียบร้อย");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
        }
      }}
    />
  );
}
