"use client";

import { useState } from "react";
import { Award, Heart, Loader2, Sparkle, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCreateRecognition } from "./hooks";
import type { RecognitionType } from "./types";

const TYPE_OPTIONS: { type: RecognitionType; label: string; icon: typeof Star }[] = [
  { type: "STAR", label: "Star", icon: Star },
  { type: "AWARD", label: "Award", icon: Award },
  { type: "HEART", label: "Heart", icon: Heart },
  { type: "POINT", label: "Point", icon: Sparkle },
];

export function RecognitionGiveButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RecognitionType>("STAR");
  const [points, setPoints] = useState("10");
  const [message, setMessage] = useState("");
  const createMut = useCreateRecognition();

  async function submit() {
    try {
      await createMut.mutateAsync({
        employeeId,
        type,
        points: type === "POINT" ? Number(points) || 0 : undefined,
        message: message.trim() || undefined,
      });
      toast.success(`ให้กำลังใจ ${employeeName} เรียบร้อย`);
      setOpen(false);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ให้กำลังใจไม่สำเร็จ");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkle className="size-4" /> ให้กำลังใจ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ให้กำลังใจ {employeeName}</DialogTitle>
            <DialogDescription>เลือกประเภทและใส่ข้อความให้กำลังใจ (ถ้ามี)</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setType(opt.type)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("size-5", active && "fill-primary/20")} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {type === "POINT" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">จำนวนคะแนน</label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ข้อความให้กำลังใจ (ไม่บังคับ)</label>
              <Textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="เช่น ขอบคุณที่ช่วยงานลูกค้าเมื่อวานนี้!"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="size-4 animate-spin" />} ส่งกำลังใจ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
