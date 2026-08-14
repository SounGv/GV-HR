"use client";

import Link from "next/link";
import { Plus, Sparkles, Target, BookOpen, CalendarClock, ClipboardList, MoreHorizontal } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { formatDate } from "@/lib/format";
import { useCampaigns } from "./hooks";

const STATUS_LABEL: Record<string, string> = { DRAFT: "ฉบับร่าง", ACTIVE: "กำลังดำเนินการ", CLOSED: "ปิดแล้ว" };
const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  CLOSED: "bg-info/10 text-info",
};

export function CampaignView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");

  const { data, isLoading, isError, refetch } = useCampaigns();
  const campaigns = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">รอบประเมินผลงาน — ตนเอง / หัวหน้างาน / เพื่อนร่วมงาน / ลูกทีม / HR</p>
        <div className="flex items-center gap-2">
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="จัดการเพิ่มเติม" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href="/performance/templates" />}>
                  <ClipboardList className="size-4" /> แบบประเมิน
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/performance/competencies" />}>
                  <BookOpen className="size-4" /> คลังสมรรถนะเดิม
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/performance/campaigns/schedules" />}>
                  <CalendarClock className="size-4" /> รอบอัตโนมัติ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canManage && (
            <Button render={<Link href="/performance/campaigns/new" />}>
              <Plus className="size-4" /> สร้างรอบประเมิน
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Target}
          title="ยังไม่มีแคมเปญประเมินผล"
          description={canManage ? "สร้างแคมเปญแรก หรือให้ AI ออกแบบให้" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/performance/campaigns/${c.id}`}>
              <Card className="gap-2 p-4 transition hover:border-primary/40 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                      {c.aiGenerated && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <Sparkles className="size-2.5" /> AI
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.cycle} · {formatDate(c.startDate)} - {formatDate(c.endDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">ผู้เข้าร่วม {c.participantCount} คน</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
