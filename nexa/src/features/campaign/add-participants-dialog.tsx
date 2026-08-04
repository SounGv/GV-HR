"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useAddParticipants } from "./hooks";

export function AddParticipantsDialog({
  campaignId,
  existingEmployeeIds,
}: {
  campaignId: string;
  existingEmployeeIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { data: orgData } = useOrgOptions();
  const addMutation = useAddParticipants(campaignId);

  const candidates = (orgData?.data.managers ?? []).filter((e) => !existingEmployeeIds.includes(e.id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (selected.length === 0) {
      toast.error("กรุณาเลือกพนักงานอย่างน้อย 1 คน");
      return;
    }
    try {
      await addMutation.mutateAsync(selected);
      toast.success(`เพิ่มผู้เข้าร่วม ${selected.length} คนแล้ว`);
      setSelected([]);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เพิ่มผู้เข้าร่วมไม่สำเร็จ");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> เพิ่มผู้เข้าร่วม
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มผู้เข้าร่วมการประเมิน</DialogTitle>
            <DialogDescription>เลือกพนักงานที่จะเข้าร่วมแคมเปญนี้ — ระบบจะสร้างแบบประเมินตนเองและแบบประเมินโดยหัวหน้างานให้อัตโนมัติ</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีพนักงานให้เพิ่มแล้ว</p>
            ) : (
              candidates.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={() => toggle(e.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={submit} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="size-4 animate-spin" />} เพิ่มผู้เข้าร่วม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
