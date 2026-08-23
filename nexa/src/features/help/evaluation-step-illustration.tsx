import { Bell, Paperclip, Send, Check, ThumbsUp } from "lucide-react";

export type EvalIllustrationKind =
  | "open"
  | "choice"
  | "text"
  | "evidence"
  | "required"
  | "submit"
  | "draft"
  | "acknowledge"
  | "reopen";

/**
 * Miniature, honest recreations of the real evaluation-taking screen
 * (features/campaign/participant-detail-view.tsx + template-renderer.tsx) —
 * same classes/shapes as the actual question card, stacked choice buttons,
 * and submit button, just scaled down. Not abstract shapes: if someone opens
 * the real page right after reading this, it should look familiar.
 */
export function EvalStepIllustration({ kind }: { kind: EvalIllustrationKind }) {
  return (
    <div className="w-full max-w-[260px] rounded-xl border border-border bg-card p-3 shadow-sm">
      {kind === "open" && (
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bell className="size-4" />
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">1</span>
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <p className="truncate text-[11px] font-semibold text-foreground">ประเมินผลงาน H2/2569</p>
            <p className="text-[10px] text-muted-foreground">รอคุณทำแบบประเมิน</p>
          </div>
        </div>
      )}

      {kind === "choice" && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-foreground">
            ความรับผิดชอบต่องาน <span className="text-destructive">*</span>
          </p>
          {["ควรปรับปรุง", "พอใช้", "ดี", "ดีมาก"].map((label, i) => (
            <div
              key={label}
              className={
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium " +
                (i === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")
              }
            >
              <span
                className={
                  "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold " +
                  (i === 2 ? "bg-primary-foreground/20" : "bg-muted-foreground/10")
                }
              >
                {i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>
      )}

      {kind === "text" && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-foreground">ข้อเสนอแนะเพิ่มเติม</p>
          <div className="space-y-1 rounded-lg border border-border p-2">
            <div className="h-1.5 w-full rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-4/5 rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-2/3 rounded-full bg-muted-foreground/15" />
          </div>
        </div>
      )}

      {kind === "evidence" && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-foreground">แนบหลักฐาน (ไม่บังคับ)</p>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-[10.5px] text-muted-foreground">
            <Paperclip className="size-3.5 shrink-0" />
            แตะเพื่อแนบไฟล์ / รูปภาพ
          </div>
        </div>
      )}

      {kind === "required" && (
        <div className="space-y-1.5">
          {[true, true, false].map((done, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span
                className={
                  "flex size-4 shrink-0 items-center justify-center rounded-full " +
                  (done ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")
                }
              >
                {done ? <Check className="size-2.5" strokeWidth={3} /> : "*"}
              </span>
              <span className={done ? "text-muted-foreground" : "font-medium text-destructive"}>
                {done ? "ตอบแล้ว" : "ยังไม่ได้ตอบ (จำเป็น)"}
              </span>
            </div>
          ))}
        </div>
      )}

      {kind === "submit" && (
        <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12px] font-bold text-primary-foreground shadow-sm">
          <Send className="size-3.5" /> ส่งแบบประเมิน
        </div>
      )}

      {kind === "draft" && (
        <div className="flex gap-1.5">
          <div className="flex h-8 flex-1 items-center justify-center rounded-lg border border-border text-[10.5px] font-bold text-muted-foreground">
            บันทึกแบบร่าง
          </div>
          <div className="flex h-8 flex-[1.4] items-center justify-center gap-1 rounded-lg bg-primary text-[10.5px] font-bold text-primary-foreground shadow-sm">
            <Send className="size-3" /> ส่งแบบประเมิน
          </div>
        </div>
      )}

      {kind === "acknowledge" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
            <div>
              <p className="text-[9.5px] text-muted-foreground">คะแนนรวม (ถ่วงน้ำหนัก)</p>
              <p className="text-[15px] font-bold text-foreground">82.4%</p>
            </div>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success">ดี/ดีเยี่ยม</span>
          </div>
          <div className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground shadow-sm">
            <ThumbsUp className="size-3.5" /> รับทราบผลการประเมิน
          </div>
        </div>
      )}

      {kind === "reopen" && (
        <div className="space-y-2">
          <div className="space-y-1 rounded-lg border border-border p-2">
            <p className="text-[10px] font-semibold text-foreground">เหตุผลที่ต้องการแก้ไข</p>
            <div className="h-1.5 w-full rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-3/5 rounded-full bg-muted-foreground/15" />
          </div>
          <div className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground shadow-sm">
            <Send className="size-3.5" /> ส่งคำขอ
          </div>
        </div>
      )}
    </div>
  );
}
