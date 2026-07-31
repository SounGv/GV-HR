"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useUpdateGoalProgress } from "./hooks";
import type { Goal } from "./types";

export function ProgressDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
}) {
  const mut = useUpdateGoalProgress();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open && goal) setValue(String(goal.currentValue));
  }, [open, goal]);

  async function save() {
    if (!goal) return;
    if (!/^\d+(\.\d+)?$/.test(value)) {
      toast.error("กรุณากรอกตัวเลข");
      return;
    }
    try {
      await mut.mutateAsync({ id: goal.id, currentValue: value });
      toast.success("อัปเดตความคืบหน้าแล้ว");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>อัปเดตความคืบหน้า</DialogTitle>
          <DialogDescription>{goal?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            ค่าปัจจุบัน (เป้าหมาย {goal?.targetValue} {goal?.unit})
          </Label>
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="size-4 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
