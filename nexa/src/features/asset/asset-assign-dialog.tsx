"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useAssignAsset } from "./hooks";
import type { Asset } from "./types";

export function AssetAssignDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { data: orgData } = useOrgOptions();
  const assignMut = useAssignAsset();
  const [employeeId, setEmployeeId] = useState("");

  async function save() {
    if (!asset || !employeeId) return;
    try {
      await assignMut.mutateAsync({ id: asset.id, employeeId });
      toast.success("เบิกทรัพย์สินเรียบร้อย");
      setEmployeeId("");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เบิกทรัพย์สิน · {asset?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">มอบหมายให้พนักงาน</label>
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกพนักงาน" />
            </SelectTrigger>
            <SelectContent>
              {(orgData?.data.managers ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assignMut.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={assignMut.isPending || !employeeId}>
            {assignMut.isPending && <Loader2 className="size-4 animate-spin" />}
            เบิก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
