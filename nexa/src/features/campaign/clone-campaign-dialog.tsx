"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { useCloneCampaign } from "./hooks";

/**
 * "สร้างรอบใหม่จากรอบเดิม" — a focused subset of cloneCampaign's full input
 * (name/cycle/dates only; raterTypes/participants/category filter default to
 * the source campaign as-is). Copying a subset of categories or overriding
 * the rater list is supported by the API but not exposed here yet — this
 * covers the common case (same setup, new dates) with the least UI.
 */
export function CloneCampaignDialog({
  campaignId,
  sourceName,
  sourceCycle,
}: {
  campaignId: string;
  sourceName: string;
  sourceCycle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${sourceName} (รอบใหม่)`);
  const [cycle, setCycle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const cloneMutation = useCloneCampaign();

  async function submit() {
    if (!name.trim() || !cycle.trim() || !startDate || !endDate) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    try {
      const res = await cloneMutation.mutateAsync({
        campaignId,
        input: { name, cycle, startDate, endDate },
      });
      toast.success("สร้างรอบใหม่จากรอบเดิมเรียบร้อย");
      setOpen(false);
      router.push(`/performance/campaigns/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบใหม่ไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="สร้างรอบใหม่จากรอบเดิม"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Copy className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>สร้างรอบใหม่จาก &quot;{sourceName}&quot;</DialogTitle>
          <DialogDescription>
            คัดลอกแบบประเมิน/ผู้เข้าร่วม/ผู้ประเมินจากรอบ {sourceCycle} — ไม่กระทบผลของรอบเดิม
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">ชื่อรอบใหม่</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">รอบ/ปี</span>
            <Input placeholder="เช่น Q3/2569" value={cycle} onChange={(e) => setCycle(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">วันที่เริ่ม</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">วันที่สิ้นสุด</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <Button className="w-full" onClick={submit} disabled={cloneMutation.isPending}>
            {cloneMutation.isPending && <Loader2 className="size-4 animate-spin" />} สร้างรอบใหม่
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
