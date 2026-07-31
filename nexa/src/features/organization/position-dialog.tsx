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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreatePosition, useUpdatePosition } from "./hooks";
import { JOB_LEVELS } from "./schema";
import type { PositionRow, DepartmentRow } from "./types";

const NONE = "__none__";

export function PositionDialog({
  open,
  onOpenChange,
  position,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position?: PositionRow | null;
  departments: DepartmentRow[];
}) {
  const isEdit = !!position;
  const createMut = useCreatePosition();
  const updateMut = useUpdatePosition();
  const pending = createMut.isPending || updateMut.isPending;

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState("1");
  const [departmentId, setDepartmentId] = useState<string>(NONE);

  useEffect(() => {
    if (!open) return;
    if (position) {
      setTitle(position.title);
      setCode(position.code);
      setLevel(String(position.level));
      setDepartmentId(position.department?.id ?? NONE);
    } else {
      setTitle("");
      setCode("");
      setLevel("1");
      setDepartmentId(NONE);
    }
  }, [open, position]);

  async function submit() {
    if (!title.trim()) return toast.error("กรุณาระบุชื่อตำแหน่ง");
    if (!code.trim()) return toast.error("กรุณาระบุรหัส");
    const input = {
      title: title.trim(),
      code: code.trim(),
      level,
      departmentId: departmentId === NONE ? null : departmentId,
    };
    try {
      if (isEdit && position) {
        await updateMut.mutateAsync({ id: position.id, input });
        toast.success("บันทึกตำแหน่งแล้ว");
      } else {
        await createMut.mutateAsync(input);
        toast.success("สร้างตำแหน่งแล้ว");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง"}</DialogTitle>
          <DialogDescription>กำหนดชื่อตำแหน่ง ระดับ และฝ่ายที่สังกัด</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อตำแหน่ง</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ผู้จัดการฝ่ายขาย" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>รหัส</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SALE-MGR" />
            </div>
            <div className="space-y-1.5">
              <Label>ระดับ</Label>
              <Select value={level} onValueChange={(v) => setLevel(v ?? "1")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={String(l.value)}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ฝ่ายที่สังกัด (ไม่บังคับ)</Label>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เพิ่ม"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
