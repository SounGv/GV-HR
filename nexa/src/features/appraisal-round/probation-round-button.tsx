"use client";

import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCreateProbationRound } from "./hooks";

/** Starts a draft round for the people near the end of probation; HR then finishes it in the normal steps. */
export function ProbationRoundButton() {
  const router = useRouter();
  const create = useCreateProbationRound();

  async function start() {
    try {
      const res = await create.mutateAsync();
      toast.success(`สร้างรอบประเมินทดลองงานแล้ว ${res.data.participants} คน เลือกแบบและผู้ประเมินต่อได้เลย`);
      router.push(`/appraisal/rounds/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบไม่สำเร็จ");
    }
  }

  return (
    <Button variant="outline" className="h-11 md:h-9" onClick={start} disabled={create.isPending}>
      <ClipboardCheck className="size-4" /> สร้างรอบประเมินทดลองงาน
    </Button>
  );
}
