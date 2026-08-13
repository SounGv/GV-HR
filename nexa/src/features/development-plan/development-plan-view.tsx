"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2, Target, CalendarDays, BookOpen, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { formatDate, fullName, getInitials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ApiError } from "@/lib/api/client";

import {
  useAddDevelopmentItem,
  useAddProgressNote,
  useDeleteDevelopmentItem,
  useGapSuggestions,
  useMyPlan,
  useTeamPlans,
  useUpdateDevelopmentItem,
} from "./hooks";
import { ITEM_STATUS_LABEL } from "./labels";
import { DEVELOPMENT_ITEM_STATUSES } from "./schema";
import type { DevelopmentItem, DevelopmentPlan } from "./types";

export function DevelopmentPlanView() {
  const { can } = useAuth();
  const showTeam = can("performance:approve") || can("performance:create");

  return (
    <div className="space-y-6">
      <MyPlanSection />
      {showTeam && <TeamPlansSection />}
    </div>
  );
}

function MyPlanSection() {
  const { data, isLoading, isError, refetch } = useMyPlan();
  const { data: suggestionsData } = useGapSuggestions();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DevelopmentItem | null>(null);
  const addMut = useAddDevelopmentItem();
  const deleteMut = useDeleteDevelopmentItem();

  const plan = data?.data;
  const suggestions = suggestionsData?.data ?? [];
  const existingTitles = new Set((plan?.items ?? []).map((i) => i.title));
  const openSuggestions = suggestions.filter((s) => !existingTitles.has(s.title));

  async function addSuggested(title: string) {
    if (!plan) return;
    try {
      await addMut.mutateAsync({ planId: plan.id, input: { title } });
      toast.success("เพิ่มเข้าแผนพัฒนาแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เพิ่มไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบรายการแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !plan) return <TableLoadingState rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">แผนพัฒนาตนเอง (IDP) · {plan.cycle}</h2>
          <p className="text-xs text-muted-foreground">ตั้งเป้าพัฒนาตนเอง เชื่อมจากผลประเมิน หรือเพิ่มเองได้อิสระ</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> เพิ่มรายการ
        </Button>
      </div>

      {openSuggestions.length > 0 && (
        <Card className="border-primary/30 bg-accent/40">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent-foreground">
              <Sparkles className="size-4" /> จุดที่ควรพัฒนา (จากผลประเมินล่าสุด — {suggestions[0]?.sourceCycle})
            </p>
            <div className="flex flex-wrap gap-2">
              {openSuggestions.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => addSuggested(s.title)}
                  disabled={addMut.isPending}
                  className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="size-3" /> {s.title} ({s.score.toFixed(1)}/5)
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {plan.items.length === 0 ? (
        <EmptyState icon={Target} title="ยังไม่มีรายการในแผนพัฒนา" description="เริ่มจากจุดที่ควรพัฒนาด้านบน หรือเพิ่มรายการเอง" />
      ) : (
        <div className="space-y-2">
          {plan.items.map((item) => (
            <ItemCard key={item.id} item={item} onDelete={() => setDeleteTarget(item)} />
          ))}
        </div>
      )}

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} planId={plan.id} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบรายการแผนพัฒนา"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.title}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบรายการ"
        cancelLabel="ปิด"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ItemCard({ item, onDelete }: { item: DevelopmentItem; onDelete: () => void }) {
  const updateMut = useUpdateDevelopmentItem();
  const noteMut = useAddProgressNote();
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  async function changeStatus(status: string | null) {
    if (!status) return;
    try {
      await updateMut.mutateAsync({ itemId: item.id, input: { status } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อัปเดตสถานะไม่สำเร็จ");
    }
  }

  async function submitNote() {
    if (!note.trim()) return;
    try {
      await noteMut.mutateAsync({ itemId: item.id, note: note.trim() });
      setNote("");
      setShowNoteInput(false);
      toast.success("บันทึกความคืบหน้าแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const notes = item.progressNotes ?? [];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{item.title}</p>
          {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.method && (
              <span className="flex items-center gap-1">
                <BookOpen className="size-3.5" /> {item.method}
              </span>
            )}
            {item.targetDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" /> เป้าหมาย {formatDate(item.targetDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={item.status} onValueChange={changeStatus}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVELOPMENT_ITEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ITEM_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" aria-label="ลบ" onClick={onDelete}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {notes.map((n, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatDate(n.at)}</span> — {n.note}
            </p>
          ))}
        </div>
      )}

      {showNoteInput ? (
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="บันทึกความคืบหน้า..."
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={submitNote} disabled={noteMut.isPending}>
            บันทึก
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNoteInput(true)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <MessageSquarePlus className="size-3.5" /> เพิ่มบันทึกความคืบหน้า
        </button>
      )}
    </Card>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  planId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
}) {
  const addMut = useAddDevelopmentItem();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("");
  const [targetDate, setTargetDate] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setMethod("");
    setTargetDate("");
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("กรุณาระบุหัวข้อ");
      return;
    }
    try {
      await addMut.mutateAsync({
        planId,
        input: { title: title.trim(), description: description.trim() || undefined, method: method.trim() || undefined, targetDate: targetDate || undefined },
      });
      toast.success("เพิ่มรายการแล้ว");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เพิ่มไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มรายการแผนพัฒนา</DialogTitle>
          <DialogDescription>ระบุเป้าหมายที่ต้องการพัฒนา วิธีการ และกำหนดเวลา (ถ้ามี)</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="หัวข้อ เช่น การสื่อสารในองค์กร" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="รายละเอียด (ถ้ามี)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="วิธีการ เช่น อบรม, พี่เลี้ยง, ฝึกปฏิบัติจริง" value={method} onChange={(e) => setMethod(e.target.value)} />
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={submit} disabled={addMut.isPending}>
            เพิ่มรายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamPlansSection() {
  const { data, isLoading, isError, refetch } = useTeamPlans();
  const plans = data?.data ?? [];

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">แผนพัฒนาของทีม</h2>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : plans.length === 0 ? (
        <EmptyState icon={Target} title="ยังไม่มีแผนพัฒนาในทีม" description="แผนพัฒนาของทีมจะแสดงที่นี่เมื่อสมาชิกเริ่มสร้าง" />
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <TeamPlanRow key={p.id} plan={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamPlanRow({ plan }: { plan: DevelopmentPlan }) {
  const done = plan.items.filter((i) => i.status === "COMPLETED").length;
  return (
    <Card className="flex-row items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          {plan.employee.avatarUrl && <AvatarImage src={plan.employee.avatarUrl} alt={plan.employee.firstName} />}
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">
            {getInitials(plan.employee.firstName, plan.employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fullName(plan.employee.firstName, plan.employee.lastName)}</p>
          <p className="text-xs text-muted-foreground">
            {plan.items.length} รายการ · สำเร็จแล้ว {done}/{plan.items.length}
          </p>
        </div>
      </div>
    </Card>
  );
}
