"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCloneRound } from "@/features/appraisal-round/hooks";
import { ApiError } from "@/lib/api/client";

/** Copies a template into a new draft round and opens it, so HR only sets the dates and opens it. */
export function CopyTemplateButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const clone = useCloneRound();
  async function copy() {
    try {
      const res = await clone.mutateAsync(id);
      toast.success("สร้างรอบใหม่จากแม่แบบแล้ว ตั้งวันที่แล้วเปิดรอบได้เลย");
      router.push(`/appraisal/rounds/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบจากแม่แบบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }
  return (
    <Button type="button" className="h-11 w-full justify-start px-4 text-sm font-semibold shadow-md md:h-11" disabled={clone.isPending} onClick={copy}>
      {clone.isPending ? "กำลังสร้างรอบ…" : label}
    </Button>
  );
}
