"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { cn } from "@/lib/utils";

import { TemplateDialog } from "./template-dialog";
import {
  useTemplates,
  useAssignments,
  useUpsertAssignment,
  useDeleteAssignment,
  useDeleteTemplate,
} from "./hooks";
import type { ShiftTemplate, ShiftAssignment } from "./types";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIsoLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thisWeekStart() {
  const now = new Date();
  return toIsoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()));
}
function shiftWeek(weekStart: string, deltaDays: number) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function ShiftView() {
  const { can } = useAuth();
  const canAssign = can("shift:create");
  const canEditTpl = can("shift:update");
  const canDelTpl = can("shift:delete");

  const [weekStart, setWeekStart] = useState(thisWeekStart());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftWeek(weekStart, i)),
    [weekStart],
  );
  const weekEnd = days[6];

  const { data: tplData } = useTemplates();
  const templates = tplData?.data ?? [];
  const { data: orgData } = useOrgOptions();
  const employees = orgData?.data.managers ?? [];
  const { data: asgData, isLoading, isError, refetch } = useAssignments(weekStart, weekEnd);

  const upsertMut = useUpsertAssignment();
  const deleteAsgMut = useDeleteAssignment();
  const deleteTplMut = useDeleteTemplate();

  const [tplDialogOpen, setTplDialogOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<ShiftTemplate | null>(null);
  const [delTpl, setDelTpl] = useState<ShiftTemplate | null>(null);

  const asgMap = useMemo(() => {
    const map = new Map<string, ShiftAssignment>();
    for (const a of asgData?.data ?? []) {
      map.set(`${a.employeeId}|${a.date}`, a);
    }
    return map;
  }, [asgData]);

  const label = `${days[0].slice(8)}–${days[6].slice(8)} ${thaiMonth(days[6])} ${Number(days[6].slice(0, 4)) + 543}`;

  async function assign(employeeId: string, date: string, templateId: string) {
    try {
      await upsertMut.mutateAsync({ employeeId, date, templateId });
    } catch {
      toast.error("มอบหมายเวรไม่สำเร็จ");
    }
  }
  async function clearCell(id: string) {
    try {
      await deleteAsgMut.mutateAsync(id);
    } catch {
      toast.error("ลบเวรไม่สำเร็จ");
    }
  }
  async function confirmDelTpl() {
    if (!delTpl) return;
    try {
      await deleteTplMut.mutateAsync(delTpl.id);
      toast.success("ลบกะแล้ว");
      setDelTpl(null);
    } catch {
      toast.error("ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {/* Template strip */}
      <Card className="flex flex-row flex-wrap items-center gap-2 p-3">
        <span className="text-sm font-medium text-muted-foreground">กะ:</span>
        {templates.length === 0 && (
          <span className="text-sm text-muted-foreground">ยังไม่มีกะ — สร้างกะเพื่อเริ่มจัดตาราง</span>
        )}
        {templates.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pr-1 pl-2 text-xs"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="font-medium">{t.name}</span>
            <span className="text-muted-foreground">
              {t.startTime}–{t.endTime}
            </span>
            {canEditTpl && (
              <button
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setEditingTpl(t);
                  setTplDialogOpen(true);
                }}
                aria-label="แก้ไขกะ"
              >
                <Pencil className="size-3" />
              </button>
            )}
            {canDelTpl && (
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDelTpl(t)}
                aria-label="ลบกะ"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </span>
        ))}
        {canEditTpl && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7"
            onClick={() => {
              setEditingTpl(null);
              setTplDialogOpen(true);
            }}
          >
            <Plus className="size-3.5" /> สร้างกะ
          </Button>
        )}
      </Card>

      {/* Week nav */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, -7))} aria-label="สัปดาห์ก่อน">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-44 text-center text-sm font-semibold">{label}</span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, 7))} aria-label="สัปดาห์ถัดไป">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeekStart())}>
          สัปดาห์นี้
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={6} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-2 text-left font-medium">
                  พนักงาน
                </th>
                {days.map((d) => (
                  <th key={d} className="min-w-24 px-2 py-2 text-center font-medium">
                    <div className="text-xs text-muted-foreground">
                      {WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}
                    </div>
                    <div>{d.slice(8)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                    {emp.firstName} {emp.lastName}
                    <span className="ml-1 text-xs text-muted-foreground">({emp.employeeCode})</span>
                  </td>
                  {days.map((d) => {
                    const cell = asgMap.get(`${emp.id}|${d}`);
                    const tpl = cell?.template;
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        {canAssign ? (
                          <Popover>
                            <PopoverTrigger
                              render={
                                <button
                                  className={cn(
                                    "flex h-11 w-full items-center justify-center rounded-md border text-xs transition",
                                    tpl
                                      ? "border-transparent font-medium text-white"
                                      : "border-dashed border-border text-muted-foreground hover:border-primary",
                                  )}
                                  style={tpl ? { backgroundColor: tpl.color } : undefined}
                                >
                                  {tpl ? tpl.name : "+"}
                                </button>
                              }
                            />
                            <PopoverContent align="center" className="w-48 p-1.5">
                              <p className="px-2 py-1 text-xs text-muted-foreground">เลือกกะ</p>
                              <div className="space-y-0.5">
                                {templates.map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => assign(emp.id, d, t.id)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  >
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                    {t.name}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {t.startTime}
                                    </span>
                                  </button>
                                ))}
                                {templates.length === 0 && (
                                  <p className="px-2 py-1.5 text-xs text-muted-foreground">ยังไม่มีกะ</p>
                                )}
                                {cell && (
                                  <button
                                    onClick={() => clearCell(cell.id)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="size-3.5" /> ลบเวร
                                  </button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            className={cn(
                              "flex h-11 w-full items-center justify-center rounded-md text-xs",
                              tpl ? "font-medium text-white" : "text-muted-foreground",
                            )}
                            style={tpl ? { backgroundColor: tpl.color } : undefined}
                          >
                            {tpl ? tpl.name : "—"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    ยังไม่มีพนักงาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <TemplateDialog open={tplDialogOpen} onOpenChange={setTplDialogOpen} template={editingTpl} />
      <ConfirmDialog
        open={!!delTpl}
        onOpenChange={(o) => !o && setDelTpl(null)}
        title="ลบกะการทำงาน?"
        description={delTpl ? `การลบ “${delTpl.name}” จะลบเวรที่มอบหมายด้วยกะนี้ทั้งหมด` : undefined}
        confirmLabel="ลบ"
        destructive
        loading={deleteTplMut.isPending}
        onConfirm={confirmDelTpl}
      />
    </div>
  );
}

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function thaiMonth(iso: string) {
  return THAI_MONTHS[Number(iso.slice(5, 7)) - 1];
}
