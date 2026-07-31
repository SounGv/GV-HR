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
import { useCreateDepartment, useUpdateDepartment } from "./hooks";
import type { DepartmentRow } from "./types";

const NONE = "__none__";

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: DepartmentRow | null;
  departments: DepartmentRow[];
}) {
  const isEdit = !!department;
  const createMut = useCreateDepartment();
  const updateMut = useUpdateDepartment();
  const pending = createMut.isPending || updateMut.isPending;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>(NONE);

  useEffect(() => {
    if (!open) return;
    if (department) {
      setName(department.name);
      setCode(department.code);
      setParentId(department.parentId ?? NONE);
    } else {
      setName("");
      setCode("");
      setParentId(NONE);
    }
  }, [open, department]);

  // A department cannot be its own parent (server also guards deeper cycles).
  const parentOptions = departments.filter((d) => d.id !== department?.id);

  async function submit() {
    if (!name.trim()) return toast.error("กรุณาระบุชื่อ");
    if (!code.trim()) return toast.error("กรุณาระบุรหัส");
    const input = { name: name.trim(), code: code.trim(), parentId: parentId === NONE ? null : parentId };
    try {
      if (isEdit && department) {
        await updateMut.mutateAsync({ id: department.id, input });
        toast.success("บันทึกฝ่ายแล้ว");
      } else {
        await createMut.mutateAsync(input);
        toast.success("สร้างฝ่ายแล้ว");
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
          <DialogTitle>{isEdit ? "แก้ไขฝ่าย/แผนก" : "เพิ่มฝ่าย/แผนก"}</DialogTitle>
          <DialogDescription>เลือก “ฝ่ายแม่” เพื่อทำเป็นแผนกย่อย</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อฝ่าย/แผนก</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น แผนกบัญชี" />
          </div>
          <div className="space-y-1.5">
            <Label>รหัส</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="เช่น ACC"
            />
          </div>
          <div className="space-y-1.5">
            <Label>ฝ่ายแม่ (ไม่บังคับ)</Label>
            <Select value={parentId} onValueChange={(v) => setParentId(v ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— ไม่มี (เป็นฝ่ายหลัก) —</SelectItem>
                {parentOptions.map((d) => (
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
