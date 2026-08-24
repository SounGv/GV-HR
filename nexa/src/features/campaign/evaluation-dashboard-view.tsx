"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText as FileTextIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { toCsv, downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { useDashboard, useDashboardCycles } from "./hooks";
import type { DashboardFilters, ScoreStatus } from "./types";

const STATUS_LABEL: Record<ScoreStatus, string> = {
  GOOD: "ดี/ดีเยี่ยม",
  NEEDS_IMPROVEMENT: "ต้องปรับปรุงบางจุด",
  WATCH: "ต้องติดตาม",
  URGENT: "ต้องแก้ไขเร่งด่วน",
};

const STATUS_COLOR: Record<ScoreStatus, string> = {
  GOOD: "#84cc16",
  NEEDS_IMPROVEMENT: "#f59e0b",
  WATCH: "#f59e0b",
  URGENT: "#e4573d",
};

const STATUS_BADGE_CLASS: Record<ScoreStatus, string> = {
  GOOD: "bg-success/10 text-success",
  NEEDS_IMPROVEMENT: "bg-warning/10 text-warning",
  WATCH: "bg-warning/10 text-warning",
  URGENT: "bg-destructive/10 text-destructive",
};

const ALL = "__all";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};

export function EvaluationDashboardView() {
  const { data: cyclesData } = useDashboardCycles();
  const cycles = cyclesData?.data ?? [];

  const [campaignId, setCampaignId] = useState<string>("");
  const [status, setStatus] = useState<string>(ALL);

  useEffect(() => {
    if (!campaignId && cyclesData?.data && cyclesData.data.length > 0) setCampaignId(cyclesData.data[0].id);
  }, [campaignId, cyclesData]);

  const filters: DashboardFilters = {
    campaignId: campaignId || undefined,
    status: status === ALL ? undefined : (status as ScoreStatus),
  };
  const { data, isLoading, isError, refetch } = useDashboard(filters);
  const result = data?.data;

  function exportCsv() {
    if (!result) return;
    const columns = [
      { key: "employeeCode", label: "รหัสพนักงาน" },
      { key: "name", label: "ชื่อ" },
      { key: "department", label: "แผนก" },
      { key: "position", label: "ตำแหน่ง" },
      { key: "scorePercent", label: "คะแนน (%)" },
      { key: "status", label: "สถานะ" },
      { key: "lowestTopic", label: "หัวข้อคะแนนต่ำสุด" },
      { key: "followUpDate", label: "วันติดตาม" },
    ];
    const rows = result.table.map((r) => ({
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      department: r.department ?? "-",
      position: r.position ?? "-",
      scorePercent: r.scorePercent?.toFixed(1) ?? "-",
      status: r.scoreStatus ? STATUS_LABEL[r.scoreStatus] : "-",
      lowestTopic: r.lowestTopic ?? "-",
      followUpDate: r.followUpDate ? formatDate(r.followUpDate) : "-",
    }));
    downloadCsv(`evaluation-dashboard-${result.campaign.cycle}`, toCsv(columns, rows));
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  async function exportExcel() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const header = ["รหัสพนักงาน", "ชื่อ", "แผนก", "ตำแหน่ง", "คะแนน (%)", "สถานะ", "หัวข้อคะแนนต่ำสุด", "วันติดตาม"];
    const body = result.table.map((r) => [
      r.employeeCode,
      `${r.firstName} ${r.lastName}`,
      r.department ?? "-",
      r.position ?? "-",
      r.scorePercent?.toFixed(1) ?? "-",
      r.scoreStatus ? STATUS_LABEL[r.scoreStatus] : "-",
      r.lowestTopic ?? "-",
      r.followUpDate ? formatDate(r.followUpDate) : "-",
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "ผลประเมิน");
    XLSX.writeFile(workbook, `evaluation-dashboard-${result.campaign.cycle}.xlsx`);
    toast.success("ดาวน์โหลด Excel แล้ว");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={campaignId} onValueChange={(v) => setCampaignId(v ?? "")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="เลือกรอบประเมิน" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.cycle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
              {(Object.keys(STATUS_LABEL) as ScoreStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!result}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !result ? (
        <TableLoadingState rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="ผู้ถูกประเมิน" value={result.kpi.totalParticipants} unit="คน" />
            <KpiCard label="ทำเสร็จแล้ว" value={result.kpi.completed} unit="คน" tone="success" />
            <KpiCard label="ยังไม่ทำ" value={result.kpi.notDone} unit="คน" tone={result.kpi.notDone > 0 ? "warning" : undefined} />
            <KpiCard
              label="ค่าเฉลี่ยคะแนน"
              value={result.kpi.avgScore != null ? result.kpi.avgScore.toFixed(1) : "-"}
              unit={result.kpi.avgScore != null ? "%" : undefined}
              sub={
                result.kpi.previousAvgScore != null
                  ? `รอบก่อน (${result.kpi.previousCycleName}): ${result.kpi.previousAvgScore.toFixed(1)}%`
                  : undefined
              }
            />
            <KpiCard label="ต้องปรับปรุง/ติดตาม" value={result.kpi.countNeedsImprovementOrWatch} unit="คน" tone="warning" />
            <KpiCard label="ต้องแก้ไขเร่งด่วน" value={result.kpi.countUrgent} unit="คน" tone={result.kpi.countUrgent > 0 ? "danger" : undefined} />
            <KpiCard label="แผนพัฒนาที่ค้าง" value={result.kpi.pendingPlans} unit="แผน" tone={result.kpi.pendingPlans > 0 ? "warning" : undefined} />
            <KpiCard label="รอบประเมิน" value={result.campaign.cycle} sub={result.campaign.name} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">สถานะการทำแบบประเมิน</p>
              {result.charts.statusDistribution.every((d) => d.count === 0) ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} คน`, n]} />
                    <Pie data={result.charts.statusDistribution} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                      {result.charts.statusDistribution.map((d) => (
                        <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <ul className="mt-2 space-y-1">
                {result.charts.statusDistribution.map((d) => (
                  <li key={d.status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[d.status] }} />
                      {STATUS_LABEL[d.status]}
                    </span>
                    <span className="font-medium tabular-nums">{d.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">คะแนนเฉลี่ยรายแผนก</p>
              {result.charts.avgByDepartment.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, result.charts.avgByDepartment.length * 32)}>
                  <BarChart data={result.charts.avgByDepartment} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "คะแนนเฉลี่ย"]} />
                    <Bar dataKey="avgScore" radius={[0, 6, 6, 0]} maxBarSize={20} fill="#84cc16" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">หัวข้อที่คะแนนต่ำสุด</p>
              {result.charts.lowestTopicsOverall.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, result.charts.lowestTopicsOverall.length * 32)}>
                  <BarChart data={result.charts.lowestTopicsOverall} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v}% (พบ ${p.payload.mentions} ครั้ง)`, "คะแนนเฉลี่ย"]} />
                    <Bar dataKey="avgScorePercent" radius={[0, 6, 6, 0]} maxBarSize={20} fill="#e4573d" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card className="p-0">
            {result.table.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={FileTextIcon} title="ไม่มีข้อมูลตรงกับตัวกรอง" description="ลองเปลี่ยนรอบประเมินหรือสถานะ" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">ชื่อพนักงาน</th>
                      <th className="p-3 font-medium">แผนก</th>
                      <th className="p-3 font-medium">ตำแหน่ง</th>
                      <th className="p-3 font-medium">คะแนน</th>
                      <th className="p-3 font-medium">หัวข้อคะแนนต่ำสุด</th>
                      <th className="p-3 font-medium">สถานะ</th>
                      <th className="p-3 font-medium">วันติดตาม</th>
                      <th className="p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.map((r) => (
                      <tr key={r.participantId} className="border-b border-border last:border-0">
                        <td className="p-3 font-medium text-foreground">{r.firstName} {r.lastName}</td>
                        <td className="p-3 text-muted-foreground">{r.department ?? "-"}</td>
                        <td className="p-3 text-muted-foreground">{r.position ?? "-"}</td>
                        <td className="p-3 tabular-nums text-foreground">{r.scorePercent != null ? `${r.scorePercent.toFixed(1)}%` : "-"}</td>
                        <td className="p-3 text-muted-foreground">{r.lowestTopic ?? "-"}</td>
                        <td className="p-3">
                          {r.scoreStatus ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.scoreStatus]}`}>
                              {STATUS_LABEL[r.scoreStatus]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">ยังไม่มีคะแนน</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{r.followUpDate ? formatDate(r.followUpDate) : "-"}</td>
                        <td className="p-3 text-right">
                          <Link href={`/performance/campaigns/${result.campaign.id}/participants/${r.participantId}`} className="text-primary hover:underline">
                            ดูรายละเอียด
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {value} {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>;
}
