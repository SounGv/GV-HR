"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Heart, Loader2, Sparkle, Star } from "lucide-react";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCreateRecognition } from "./hooks";
import type { RecognitionType } from "./types";

const FORM_ID = "recognition-form";

const TYPE_OPTIONS: { type: RecognitionType; label: string; icon: typeof Star }[] = [
  { type: "STAR", label: "Star", icon: Star },
  { type: "AWARD", label: "Award", icon: Award },
  { type: "HEART", label: "Heart", icon: Heart },
  { type: "POINT", label: "Point", icon: Sparkle },
];

export function RecognitionFormPage({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const router = useRouter();
  const backHref = `/employees/${employeeId}`;
  const [type, setType] = useState<RecognitionType>("STAR");
  const [points, setPoints] = useState("10");
  const [message, setMessage] = useState("");
  const createMut = useCreateRecognition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMut.mutateAsync({
        employeeId,
        type,
        points: type === "POINT" ? Number(points) || 0 : undefined,
        message: message.trim() || undefined,
      });
      toast.success(`ให้กำลังใจ ${employeeName} เรียบร้อย`);
      router.push(backHref);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ให้กำลังใจไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "ส่งกำลังใจ", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "พนักงาน", href: "/employees" },
        { label: employeeName, href: backHref },
        { label: "ให้กำลังใจ" },
      ]}
      backHref={backHref}
      title={`ให้กำลังใจ ${employeeName}`}
      description="เลือกประเภทและใส่ข้อความให้กำลังใจ (ถ้ามี)"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(backHref)}
      actions={actions}
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="max-w-md space-y-4">
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
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="เช่น ขอบคุณที่ช่วยงานลูกค้าเมื่อวานนี้!"
          />
        </div>

        {createMut.isPending && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> กำลังส่ง...
          </p>
        )}
      </form>
    </FormPageShell>
  );
}
