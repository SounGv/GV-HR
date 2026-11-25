"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";

import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDetailOverview, useDetailPerson } from "./hooks";
import type { DetailOverview, DetailPerson, DetailPersonView } from "./detail-report-types";
import { RATER_LABEL } from "./types";
import { Delta, fmt, MonthsTab, OverviewTab, PeopleTab, SectionsTab, TeamTab } from "./detail-report-tables";
import { ExecTab } from "./detail-report-exec";
import { MonthlyCharts } from "./detail-report-monthly";

const dateTh = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : "-";

const GRID = "var(--border)";
const TICK = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};
const BLUE = "var(--chart-1)";
const GREY = "#98a2b3";
const RED = "var(--chart-5)";
// One blue family plus greys, told apart by shade and by dash pattern (see DASHES), so the chart stays inside the one-accent rule.
const SERIES = ["#0d47a1", "#1976d2", "#64b5f6", "#455a64", "#90a4ae", "#1565c0"];
const DASHES = [undefined, "6 3", undefined, "2 3", "6 3", "2 3"];

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2 p-4 print:break-inside-avoid">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

/** "รายงานประเมินละเอียด": every score, who gave it and what they wrote, by person, by team and across rounds. HR only. */
export function DetailReportView() {
  const [roundId, setRoundId] = useState<string | null>(null);
  const q = useDetailOverview(roundId);
  const [tab, setTab] = useState("exec");
  const [pick, setPick] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const data = q.data?.data;

  // The search and department filter of the three person tables (the chart page and the team table are never filtered).
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data?.people ?? []).filter((p) => (!dept || p.department === dept) && (!s || `${p.name} ${p.code} ${p.department}`.toLowerCase().includes(s)));
  }, [data?.people, search, dept]);

  if (q.isLoading) return <TableLoadingState rows={8} />;
  if (q.isError || !data) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="โหลดรายงานไม่สำเร็จ" />;
  if (data.rounds.length === 0)
    return <EmptyState title="ยังไม่มีผลประเมินให้ดู" description="รายงานนี้ดึงจากรอบที่เปิดหรือปิดแล้วและคำนวณผลแล้ว ไปที่หน้ารอบประเมินแล้วกด คำนวณผล ก่อน" />;

  const open = (id: string) => {
    setPick(id);
    setTab("person");
  };
  const filterable = tab === "people" || tab === "months" || tab === "sections";
  const departments = [...new Set(data.people.map((p) => p.department))].sort((a, b) => a.localeCompare(b, "th"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-sm text-muted-foreground">รอบ</span>
        <Select
          value={data.roundId ?? ""}
          onValueChange={(v) => {
            if (!v) return;
            setRoundId(v as string);
            setPick(null);
          }}
          items={data.rounds.map((r) => ({ value: r.id, label: r.name }))}
        >
          <SelectTrigger className="h-11 max-w-[min(80vw,520px)] md:h-9" aria-label="เลือกรอบ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.rounds.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} ({r.people} คน)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterable && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อเล่นหรือแผนก" className="h-11 w-56 pl-8 md:h-9" aria-label="ค้นหาคน" />
            </div>
            <Select value={dept || "__all"} onValueChange={(v) => setDept(!v || v === "__all" ? "" : (v as string))} items={[{ value: "__all", label: "ทุกแผนก" }, ...departments.map((d) => ({ value: d, label: d }))]}>
              <SelectTrigger className="h-11 max-w-[min(80vw,260px)] md:h-9" aria-label="เลือกแผนก">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">ทุกแผนก</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">เห็นได้เฉพาะ HR · ตัวเลขเป็นคะแนนที่คำนวณไว้แล้ว ไม่เปลี่ยนคะแนนของใคร</span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="gap-3">
        <TabsList variant="line" className="w-fit max-w-full justify-start overflow-x-auto [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="exec">สรุปสำหรับผู้บริหาร</TabsTrigger>
          <TabsTrigger value="overview">กราฟภาพรวม</TabsTrigger>
          <TabsTrigger value="people">สรุปรายคน</TabsTrigger>
          <TabsTrigger value="months">เทียบรายรอบ</TabsTrigger>
          <TabsTrigger value="sections">รายหมวดและความเห็น</TabsTrigger>
          <TabsTrigger value="team">รายทีม</TabsTrigger>
          <TabsTrigger value="person">ดูรายคน</TabsTrigger>
        </TabsList>
        <TabsContent value="exec">
          <ExecTab key={data.roundId} data={data} onOpenPerson={open} onGoTab={setTab} />
        </TabsContent>
        <TabsContent value="overview">
          <div className="mb-2 hidden justify-end md:flex print:hidden">
            <Button variant="outline" className="h-11 md:h-9" onClick={() => window.print()}>
              <Printer className="size-4" /> พิมพ์ / บันทึก PDF
            </Button>
          </div>
          <OverviewTab key={data.roundId} data={data} />
        </TabsContent>
        <TabsContent value="people">
          <PeopleTab data={data} people={filtered} onOpen={open} />
        </TabsContent>
        <TabsContent value="months">
          <MonthsTab data={data} people={filtered} onOpen={open} top={<MonthlyCharts data={data} />}>
            <details className="rounded-sm border border-border bg-card p-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium md:min-h-0">ดูเป็นกราฟรายทีมข้ามรอบ และคนที่ขึ้นลงมากที่สุด</summary>
              <div className="mt-3">
                <TrendTab data={data} />
              </div>
            </details>
          </MonthsTab>
        </TabsContent>
        <TabsContent value="sections">
          <SectionsTab data={data} people={filtered} onOpen={open} />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab data={data} />
        </TabsContent>
        <TabsContent value="person">
          <PersonTab data={data} pick={pick} setPick={setPick} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────────── รายคน ─────────────────────────────── */

function PersonTab({ data, pick, setPick }: { data: DetailOverview; pick: string | null; setPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? data.people.filter((p) => `${p.name} ${p.code} ${p.department}`.toLowerCase().includes(s)) : data.people;
  }, [data.people, search]);
  const picked = data.people.find((p) => p.participantId === pick) ?? data.people[0];
  const detail = useDetailPerson(data.roundId, picked?.participantId ?? null);
  if (!picked) return <EmptyState title="รอบนี้ยังไม่มีคนที่คำนวณผลแล้ว" />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="gap-0 p-0 print:hidden">
        <div className="relative border-b border-border p-2">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ รหัส หรือแผนก" className="pl-8" aria-label="ค้นหาคน" />
        </div>
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto lg:max-h-[48rem]">
          {list.map((p) => (
            <li key={p.participantId}>
              <button
                type="button"
                onClick={() => setPick(p.participantId)}
                aria-pressed={p.participantId === picked.participantId}
                className={cn("flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left", p.participantId === picked.participantId ? "bg-primary/10" : "hover:bg-muted/50")}
              >
                <PersonAvatar name={p.name} gender={p.gender} seed={p.employeeId} src={p.avatarUrl} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.department}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{fmt(p.total)}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">ไม่พบคนที่ค้นหา</li>}
        </ul>
      </Card>

      <div className="min-w-0 space-y-4">
        <PersonHeader p={picked} d={detail.data?.data} />
        {detail.isLoading && <TableLoadingState rows={5} />}
        {detail.isError && <ErrorState error={detail.error} onRetry={() => detail.refetch()} title="โหลดรายละเอียดไม่สำเร็จ" />}
        {detail.data && <PersonBody roundId={data.roundId as string} d={detail.data.data} />}
      </div>
    </div>
  );
}

function PersonHeader({ p, d }: { p: DetailPerson; d?: DetailPersonView }) {
  const deptDiff = d && d.total !== null && d.deptAvg !== null ? Math.round((d.total - d.deptAvg) * 10) / 10 : null;
  return (
    <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <PersonAvatar name={p.name} gender={p.gender} seed={p.employeeId} src={p.avatarUrl} className="size-14" />
      <div className="min-w-[12rem] flex-1">
        <h2 className="text-lg leading-snug font-semibold">{p.name}</h2>
        <p className="text-sm text-muted-foreground">
          {p.code} · {p.position || "ไม่ระบุตำแหน่ง"} · {p.department}
        </p>
      </div>
      <Stat label="คะแนนรวม" value={`${fmt(p.total)}%`} />
      <Stat label="เกรด" value={p.grade ?? "ยังไม่ตั้งเกณฑ์"} small={!p.grade} />
      <Stat label={`เทียบแผนก${d?.deptAvg != null ? ` (${fmt(d.deptAvg)})` : ""}`} value={<Delta value={deptDiff} />} small />
      <Stat label="เทียบรอบก่อน" value={<Delta value={p.delta} />} small />
      <Stat label="อันดับ" value={`${p.rank} จาก ${d?.rankOf ?? "-"}`} small />
    </Card>
  );
}

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("leading-snug font-semibold tabular-nums", small ? "text-base" : "text-2xl")}>{value}</p>
    </div>
  );
}

function PersonBody({ roundId, d }: { roundId: string; d: DetailPersonView }) {
  const radar = d.sections.map((s) => ({ name: s.name, me: s.me, dept: s.dept ?? 0 }));
  const types = d.types.map((t) => ({
    name: RATER_LABEL[t.raterType],
    me: t.percent,
    company: d.companyTypes.find((c) => c.raterType === t.raterType)?.percent ?? 0,
  }));
  const trend = d.history.rounds.map((r, i) => ({ name: r.label, full: r.name, me: d.history.me[i], dept: d.history.dept[i], company: d.history.company[i] }));
  const hasHistory = d.history.me.filter((v) => v !== null).length >= 2;

  return (
    <>
      <Card className="gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">ใครประเมินใคร ให้คะแนนเท่าไร</h3>
          <p className="text-xs text-muted-foreground">ทุกใบประเมินของคนนี้ในรอบนี้ คะแนนคือค่าเฉลี่ยของใบนั้นเทียบเต็มสเกล กดชื่อเพื่อเปิดใบเต็ม</p>
        </div>
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ประเมิน</TableHead>
                <TableHead>มุมมอง</TableHead>
                <TableHead className="text-right">น้ำหนักในคะแนนรวม</TableHead>
                <TableHead className="text-right">คะแนนที่ให้ (%)</TableHead>
                <TableHead>ส่งเมื่อ</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.raters.map((r) => (
                <TableRow key={r.assignmentId}>
                  <TableCell>
                    <Link href={`/appraisal/rounds/${roundId}/fill/${r.assignmentId}`} className="font-medium text-primary hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>{RATER_LABEL[r.raterType]}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.weightUsed === null ? "-" : `${fmt(r.weightUsed)}%`}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.percent)}</TableCell>
                  <TableCell>{dateTh(r.submittedAt)}</TableCell>
                  <TableCell>
                    <StatusChip
                      tone={r.status === "SUBMITTED" ? "success" : r.status === "IN_PROGRESS" ? "info" : "warning"}
                      label={r.status === "SUBMITTED" ? "ส่งแล้ว" : r.status === "IN_PROGRESS" ? "กำลังทำ" : "ยังไม่เริ่ม"}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {d.raters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    รอบนี้ไม่มีใบประเมินในระบบ (คะแนนอาจนำเข้าจากระบบเดิม มีเฉพาะคะแนนรวม)
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {d.matrix.rows.length > 0 && d.matrix.columns.length > 0 && <MatrixCard d={d} />}

      <Card className="gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">ความเห็นของผู้ประเมินทุกคน</h3>
          <p className="text-xs text-muted-foreground">แสดงชื่อผู้เขียนเฉพาะ HR พนักงานและหัวหน้าเห็นแบบไม่มีชื่อ</p>
        </div>
        {d.comments.length === 0 && !d.imported?.texts.length && <p className="text-sm text-muted-foreground">ยังไม่มีผู้ประเมินเขียนความเห็นในรอบนี้</p>}
        {d.comments.map((c) => (
          <div key={c.assignmentId} className="rounded-lg border border-border p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.raterName}</span>
              <StatusChip tone="primary" dot={false} label={RATER_LABEL[c.raterType]} />
              {c.percent !== null && <span className="text-xs text-muted-foreground tabular-nums">ให้ {fmt(c.percent)}%</span>}
              <span className="ml-auto text-xs text-muted-foreground">{dateTh(c.submittedAt)}</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {c.texts.map((t, i) => (
                <li key={`t${i}`}>
                  <span className="text-xs text-muted-foreground">{t.question}</span>
                  <p className="whitespace-pre-wrap">{t.text}</p>
                </li>
              ))}
              {c.notes.map((t, i) => (
                <li key={`n${i}`}>
                  <span className="text-xs text-muted-foreground">
                    ตัวอย่างประกอบคะแนน {t.score} · {t.question}
                  </span>
                  <p className="whitespace-pre-wrap">{t.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {d.imported && d.imported.texts.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-medium">นำเข้าจากระบบเดิม</span>
              <StatusChip tone="neutral" dot={false} label={RATER_LABEL[d.imported.raterType as keyof typeof RATER_LABEL] ?? d.imported.raterType} />
              <span className="text-xs text-muted-foreground">ไม่ระบุผู้เขียน · {d.imported.raters} คนประเมิน</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {d.imported.texts.map((t, i) => (
                <li key={i} className="whitespace-pre-wrap">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <details className="rounded-sm border border-border bg-card p-3 print:hidden">
        <summary className="min-h-11 cursor-pointer text-sm font-medium md:min-h-0">ดูเป็นกราฟ (หมวด มุมมอง ย้อนหลัง)</summary>
        <div className="mt-3">
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", radar.length >= 2 ? "xl:grid-cols-3" : "lg:grid-cols-2")}>
            {radar.length >= 2 && (
            <ChartCard title="คะแนนแยกตามหมวด" hint="เทียบค่าเฉลี่ยของแผนกเดียวกัน (เส้นเทา)">
              {radar.length >= 3 ? (
                <div role="img" aria-label="กราฟใยแมงมุมคะแนนแยกตามหมวด" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radar} outerRadius="72%">
                      <PolarGrid stroke={GRID} />
                      <PolarAngleAxis dataKey="name" tick={TICK} />
                      <Radar name="คนนี้" dataKey="me" stroke={BLUE} fill={BLUE} fillOpacity={0.18} strokeWidth={2} />
                      <Radar name="ค่าเฉลี่ยแผนก" dataKey="dept" stroke={GREY} fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fmt(Number(v))}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <SectionBars rows={d.sections} />
              )}
            </ChartCard>
            )}
            <ChartCard title="คะแนนแยกตามมุมมอง" hint="ผู้ประเมินแต่ละกลุ่มให้กี่เปอร์เซ็นต์ เทียบค่าเฉลี่ยทั้งรอบ">
              {types.length ? (
                <div role="img" aria-label="กราฟแท่งคะแนนแยกตามมุมมอง" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={types} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="name" tick={TICK} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={TICK} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fmt(Number(v))}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="me" name="คนนี้" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={48} />
                      <Bar dataKey="company" name="ค่าเฉลี่ยทั้งรอบ" fill="#c3cad4" radius={[3, 3, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">รอบนี้ไม่มีคะแนนแยกตามมุมมอง</p>
              )}
            </ChartCard>
            <ChartCard title="ย้อนหลัง" hint="คะแนนรวมเทียบค่าเฉลี่ยแผนกและบริษัท ต่อรอบ">
              {hasHistory ? (
                <div role="img" aria-label="กราฟเส้นคะแนนย้อนหลัง" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="name" tick={TICK} tickLine={false} />
                      <YAxis domain={["dataMin - 5", 100]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => String(Math.round(v))} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fmt(Number(v))}%`} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="me" name="คนนี้" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="dept" name="เฉลี่ยแผนก" stroke={GREY} strokeDasharray="5 4" dot={false} connectNulls />
                      <Line type="monotone" dataKey="company" name="เฉลี่ยบริษัท" stroke={RED} strokeDasharray="2 3" dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">คนนี้ถูกประเมินแค่รอบเดียว กราฟย้อนหลังจะขึ้นเมื่อมีรอบที่สอง</p>
              )}
            </ChartCard>
          </div>

        </div>
      </details>
    </>
  );
}

function SectionBars({ rows }: { rows: DetailPersonView["sections"] }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">รอบนี้ไม่มีคะแนนแยกตามหมวด</p>;
  return (
    <ul className="space-y-3 py-2">
      {rows.map((s) => (
        <li key={s.name} className="text-sm">
          <div className="flex justify-between">
            <span>{s.name}</span>
            <span className="tabular-nums">
              {fmt(s.me)}%{s.dept !== null && <span className="text-muted-foreground"> · แผนก {fmt(s.dept)}%</span>}
            </span>
          </div>
          <div className="relative mt-1 h-3 rounded-sm bg-muted">
            <div className="h-full rounded-sm bg-primary" style={{ width: `${s.me}%` }} />
            {s.dept !== null && <div className="absolute top-[-3px] h-[18px] w-0.5 bg-muted-foreground" style={{ left: `${s.dept}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One column per rater, one row per rating question; the shade deepens with the score. */
function MatrixCard({ d }: { d: DetailPersonView }) {
  const max = d.ratingMax;
  const shade = (v: number | null) => (v === null ? undefined : `color-mix(in srgb, var(--primary) ${Math.round((v / max) * 70)}%, transparent)`);
  return (
    <Card className="gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold">คะแนนรายข้อ แยกตามผู้ประเมิน</h3>
        <p className="text-xs text-muted-foreground">เต็ม {max} คะแนน สีเข้มขึ้นเมื่อคะแนนสูง ช่องว่างคือผู้ประเมินคนนั้นไม่ได้ตอบข้อนี้</p>
      </div>
      <div className="relative overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>ข้อ</TableHead>
              {d.matrix.columns.map((c) => (
                <TableHead key={c.assignmentId} className="text-center">
                  <span className="block leading-snug">{c.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{RATER_LABEL[c.raterType]}</span>
                </TableHead>
              ))}
              <TableHead className="text-center">เฉลี่ย</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.matrix.rows.map((r) => (
              <TableRow key={r.questionId}>
                <TableCell>
                  <span className="block leading-snug">{r.text}</span>
                  {r.section !== "ทั่วไป" && <span className="block text-xs text-muted-foreground">{r.section}</span>}
                </TableCell>
                {r.scores.map((v, i) => (
                  <TableCell key={i} className="text-center font-semibold tabular-nums" style={{ background: shade(v) }}>
                    {v ?? ""}
                  </TableCell>
                ))}
                <TableCell className="text-center font-semibold tabular-nums">{fmt(r.avg)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ─────────────────────────────── เทียบข้ามรอบ ─────────────────────────────── */

function TrendTab({ data }: { data: DetailOverview }) {
  const h = data.history;
  const [on, setOn] = useState<string[]>(() => h.teams.filter((t) => t.values.some((v) => v !== null)).slice(0, 4).map((t) => t.department));
  const rows = h.rounds.map((r, i) => {
    const row: Record<string, string | number | null> = { name: r.label, full: r.name, company: h.company[i] };
    for (const t of h.teams) row[t.department] = t.values[i];
    return row;
  });
  const movers = [...data.people].filter((p) => p.delta !== null);
  const up = [...movers].sort((a, b) => (b.delta as number) - (a.delta as number)).filter((p) => (p.delta as number) > 0).slice(0, 5);
  const down = [...movers].sort((a, b) => (a.delta as number) - (b.delta as number)).filter((p) => (p.delta as number) < 0).slice(0, 5);

  return (
    <div className="space-y-4">
      <ChartCard title="คะแนนเฉลี่ยของแต่ละทีม ข้ามรอบ" hint="เป็นเปอร์เซ็นต์ของคะแนนเต็ม เทียบกันได้แม้สเกลของแบบประเมินเปลี่ยน (เช่น 1 ถึง 5 เป็น 1 ถึง 3)">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="เลือกทีมที่แสดง">
          {h.teams.map((t, i) => {
            const checked = on.includes(t.department);
            return (
              <button
                key={t.department}
                type="button"
                aria-pressed={checked}
                onClick={() => setOn(checked ? on.filter((x) => x !== t.department) : [...on, t.department])}
                className={cn("min-h-11 rounded-sm border px-3 text-sm md:min-h-8", checked ? "border-primary bg-accent text-foreground" : "border-border bg-card")}
              >
                <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
                {t.department}
              </button>
            );
          })}
        </div>
        {h.rounds.length >= 2 ? (
          <div role="img" aria-label="กราฟเส้นคะแนนเฉลี่ยรายทีมข้ามรอบ" className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={TICK} tickLine={false} />
                <YAxis domain={["dataMin - 5", 100]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => String(Math.round(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fmt(Number(v))}%`} labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="company" name="ทั้งบริษัท" stroke={GREY} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                {h.teams.map((t, i) =>
                  on.includes(t.department) ? <Line key={t.department} type="monotone" dataKey={t.department} stroke={SERIES[i % SERIES.length]} strokeDasharray={DASHES[i % DASHES.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls /> : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">ตอนนี้มีรอบที่คำนวณผลแล้วถึงรอบนี้เพียงรอบเดียว กราฟข้ามรอบจะขึ้นเมื่อมีรอบที่สอง</p>
        )}
      </ChartCard>

      <Card className="gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">เทียบรายคนกับรอบก่อน</h3>
          <p className="text-xs text-muted-foreground">เทียบกับรอบก่อนหน้าที่คนนั้นถูกประเมิน คนที่ขึ้นและลงมากที่สุด</p>
        </div>
        {movers.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีคนที่ถูกประเมินมากกว่าหนึ่งรอบ จึงยังเทียบไม่ได้</p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <MoverTable title="ขึ้นมากที่สุด" rows={up} />
            <MoverTable title="ลงมากที่สุด" rows={down} />
          </div>
        )}
      </Card>
    </div>
  );
}

function MoverTable({ title, rows }: { title: string; rows: DetailPerson[] }) {
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>
      <div className="relative overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>พนักงาน</TableHead>
              <TableHead className="text-right">รอบก่อน</TableHead>
              <TableHead className="text-right">รอบนี้</TableHead>
              <TableHead className="text-right">เปลี่ยน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.participantId}>
                <TableCell>
                  <span className="block leading-snug">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.department}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(p.prev)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(p.total)}</TableCell>
                <TableCell className="text-right">
                  <Delta value={p.delta} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  ไม่มี
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
