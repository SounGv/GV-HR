"use client";

import { useState } from "react";
import { Sparkles, Loader2, Target, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgOptions } from "@/features/employee/hooks";
import { useGenerateEvaluation } from "./hooks";
import type { EvaluationResponse } from "./types";

export function AiEvaluationView() {
  const { data: orgData } = useOrgOptions();
  const employees = orgData?.data.managers ?? [];

  const [employeeId, setEmployeeId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<EvaluationResponse | null>(null);

  const generate = useGenerateEvaluation();

  function submit() {
    if (!employeeId) return;
    generate.mutate(
      { employeeId, instruction: instruction.trim() || undefined },
      { onSuccess: (res) => setResult(res.data) },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            สร้างแบบประเมินด้วย AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">พนักงาน</label>
            <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกพนักงาน" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">คำสั่ง / จุดเน้น (ไม่บังคับ)</label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="เช่น เน้นทักษะการเป็นผู้นำทีมและการส่งมอบงานตรงเวลา สำหรับรอบครึ่งปีหลัง"
              rows={4}
              className="resize-none"
            />
          </div>

          <Button onClick={submit} disabled={!employeeId || generate.isPending} className="w-full">
            {generate.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                กำลังวิเคราะห์…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                สร้างเกณฑ์การประเมิน
              </>
            )}
          </Button>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            AI จะดึงฝ่าย ตำแหน่ง และสายงานจริงของพนักงาน มาออกแบบเกณฑ์ให้ตรงกับหน้าที่
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!result && !generate.isPending && (
          <Card className="flex min-h-64 items-center justify-center border-dashed">
            <div className="text-center text-sm text-muted-foreground">
              <Target className="mx-auto mb-2 size-8 opacity-40" />
              เลือกพนักงานแล้วกด “สร้างเกณฑ์การประเมิน”
              <br />
              เพื่อให้ AI ออกแบบแบบประเมินที่แม่นยำ
            </div>
          </Card>
        )}

        {result && result.configured === false && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              ระบบ AI Assistant ยังไม่ได้ตั้งค่า API key จึงยังสร้างแบบประเมินอัตโนมัติไม่ได้
            </CardContent>
          </Card>
        )}

        {result?.draft && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  แบบประเมิน — {result.employee.name}
                </CardTitle>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{result.employee.department}</Badge>
                  <Badge variant="secondary">{result.employee.position}</Badge>
                  {result.employee.level && (
                    <Badge variant="outline">ระดับ {result.employee.level}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-primary/5 p-3 text-sm">
                  <p className="font-medium text-primary">จุดเน้นการประเมิน</p>
                  <p className="mt-1 text-muted-foreground">{result.draft.focus}</p>
                </div>

                <div className="space-y-2">
                  {result.draft.competencies.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {i + 1}. {c.name}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          น้ำหนัก {c.weight}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                    </div>
                  ))}
                </div>

                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="font-medium">เหตุผลของ AI:</span> {result.draft.rationale}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
