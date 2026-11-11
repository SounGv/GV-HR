"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";

import { useOrgPeople } from "./hooks";
import {
  buildCompanyTree,
  buildDivisionPeople,
  detectOrgIssues,
  divisionHead,
  hasOrgIssues,
  OTHER_MAX_PEOPLE,
  type CompanyTree,
  type Division,
  type OrgIssues,
  type OrgPerson,
  type PersonNode,
  type TeamColumn,
} from "./org-tree";
import type { DepartmentRow } from "./types";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/* Tree connectors (org-division-mock.html), drawn from sm up; on phones the
   cards stack as a plain list. Line colour matches the mock's --line. */
const LINE = "sm:before:bg-[#cfd8dc] sm:after:bg-[#cfd8dc] dark:sm:before:bg-border dark:sm:after:bg-border";
/** Row of children under one parent: a short stem down from the parent's centre. */
const ROW =
  "mt-4 flex flex-col gap-3 sm:relative sm:mt-0 sm:flex-row sm:justify-center sm:gap-4 sm:pt-[26px] " +
  "sm:before:absolute sm:before:top-0 sm:before:left-1/2 sm:before:h-[13px] sm:before:w-0.5 sm:before:-translate-x-1/2 " +
  LINE;
/** One child: a stem up to the shared bar, which spans to its neighbours' centres. */
const ITEM =
  "relative sm:shrink-0 sm:pt-[13px] " +
  "sm:before:absolute sm:before:top-0 sm:before:left-1/2 sm:before:h-[13px] sm:before:w-0.5 sm:before:-translate-x-1/2 " +
  "sm:after:absolute sm:after:top-0 sm:after:-right-2 sm:after:-left-2 sm:after:h-0.5 sm:first:after:left-1/2 sm:last:after:right-1/2 " +
  LINE;

const employeeHref = (id: string) => `/employees/${id}`;

/** Org chart tab: the whole company by division, or one division's people by reporting line. */
export function OrgChart({ departments, companyName }: { departments: DepartmentRow[]; companyName?: string }) {
  const peopleQuery = useOrgPeople();
  const people = useMemo(() => peopleQuery.data?.data ?? [], [peopleQuery.data]);
  const tree = useMemo(() => buildCompanyTree(departments, people), [departments, people]);
  const issues = useMemo(() => detectOrgIssues(departments, people), [departments, people]);

  const [view, setView] = useState<"company" | "division">("company");
  const [divisionKey, setDivisionKey] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  if (departments.length === 0) {
    return <EmptyState icon={Building2} title="ยังไม่มีโครงสร้างองค์กร" description="เพิ่มฝ่ายและแผนกในแท็บ ฝ่าย / แผนก" />;
  }
  if (peopleQuery.isLoading) return <TableLoadingState rows={4} />;
  if (peopleQuery.isError) return <ErrorState onRetry={() => peopleQuery.refetch()} />;

  const selected = tree.divisions.find((d) => d.key === divisionKey) ?? tree.divisions[0];

  function openDivision(key: string) {
    setDivisionKey(key);
    setView("division");
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <div ref={topRef} className="grid scroll-mt-4 gap-5">
      <div
        role="group"
        aria-label="มุมมองผังองค์กร"
        className="inline-flex w-fit max-w-full rounded-xl border border-border bg-card p-1 shadow-[var(--card-shadow)]"
      >
        {(
          [
            ["company", "ทั้งบริษัท"],
            ["division", "รายฝ่าย (คนในฝ่าย)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={cn(
              "h-[34px] rounded-[9px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors sm:px-4",
              view === value
                ? "bg-[#0f766e] text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_10px_24px_-12px_rgba(15,118,110,.55)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "company" ? (
        <CompanyView tree={tree} people={people} issues={issues} companyName={companyName} onOpen={openDivision} />
      ) : selected ? (
        <DivisionView tree={tree} division={selected} people={people} onSelect={setDivisionKey} />
      ) : (
        <EmptyState icon={Building2} title="ยังไม่มีฝ่าย" />
      )}
    </div>
  );
}

// ─────────── ทั้งบริษัท ───────────

function CompanyView({
  tree,
  people,
  issues,
  companyName,
  onOpen,
}: {
  tree: CompanyTree;
  people: OrgPerson[];
  issues: OrgIssues;
  companyName?: string;
  onOpen: (key: string) => void;
}) {
  const realDivisions = tree.divisions.filter((d) => !d.isOther).length;
  return (
    <section className="grid gap-4" aria-label="ผังทั้งบริษัท">
      <div className="-mx-1 overflow-x-auto px-1 pt-1 pb-4">
        <div className="sm:mx-auto sm:w-max">
          <div className="flex sm:justify-center">
            <div className="gv-hero gv-rise flex w-full items-center gap-3 rounded-[18px] px-5 py-3.5 sm:inline-flex sm:w-auto" style={rise(0)}>
              <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] border border-white/20 bg-white/10">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[15px] leading-snug">{companyName ?? "องค์กร"}</b>
                <small className="text-xs text-white/80 tabular-nums">
                  {tree.total} คน · {realDivisions} ฝ่าย
                </small>
              </span>
            </div>
          </div>
          <div className={ROW}>
            {tree.divisions.map((d, i) => (
              <div key={d.key} className={cn(ITEM, "sm:w-[202px]")}>
                <DivisionCard division={d} people={people} onOpen={onOpen} index={i + 1} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {hasOrgIssues(issues) && <IssuesBox issues={issues} />}
    </section>
  );
}

function DivisionCard({
  division,
  people,
  onOpen,
  index,
}: {
  division: Division;
  people: OrgPerson[];
  onOpen: (key: string) => void;
  index: number;
}) {
  const head = useMemo(() => divisionHead(division, people), [division, people]);
  return (
    <div
      className="gv-rise overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-shadow)] transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(19,21,22,.06),0_14px_28px_-14px_rgba(19,21,22,.25)]"
      style={rise(index)}
    >
      <div className="border-b border-[#e6f4f1] bg-[linear-gradient(180deg,#f0fdfa,transparent)] px-3.5 py-3 dark:border-border dark:bg-[linear-gradient(180deg,#12332f,transparent)]">
        <b className="block text-[14.5px] leading-snug">{division.name}</b>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{division.isOther ? `ฝ่ายเล็กไม่มีแผนกย่อย (≤${OTHER_MAX_PEOPLE} คน)` : division.code}</span>
          <span className="shrink-0 rounded-full bg-[#ccfbf1] px-2.5 text-xs font-bold text-[#0f766e] tabular-nums dark:bg-accent dark:text-primary">
            {division.headcount} คน
          </span>
        </div>
        {head && (
          <Link href={employeeHref(head.person.id)} className="mt-2 flex items-center gap-2 rounded-lg hover:opacity-80">
            <PersonAvatar name={head.person.name} />
            <small className="min-w-0 text-xs leading-tight text-muted-foreground">
              <b className="block truncate text-[12.5px] font-semibold text-foreground">{head.person.name}</b>
              <span className="block truncate">{head.person.positionTitle ?? "หัวหน้าสูงสุดในฝ่าย"}</span>
            </small>
          </Link>
        )}
      </div>
      <div className="px-2 pt-1.5 pb-2">
        {division.rootCount > 0 && division.departments.length > 0 && (
          <DeptLine name="ขึ้นตรงกับฝ่าย" count={division.rootCount} depth={1} muted />
        )}
        {division.departments.length === 0 ? (
          <p className="px-2 py-1.5 text-[13px] text-muted-foreground/80">ไม่มีแผนกย่อย</p>
        ) : (
          division.departments.map((dep) => <DeptLine key={dep.id} name={dep.name} count={dep.count} depth={dep.depth} />)
        )}
      </div>
      <div className="flex justify-center px-2.5 pb-3">
        <button
          type="button"
          onClick={() => onOpen(division.key)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] border-[#cfd6dc] px-3.5 text-[12.5px] font-semibold transition-colors hover:border-[#0d9488] hover:text-[#0f766e] dark:border-border"
        >
          {division.isOther ? "เปิดผัง →" : "เปิดผังฝ่าย →"}
        </button>
      </div>
    </div>
  );
}

function DeptLine({ name, count, depth, muted }: { name: string; count: number; depth: number; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-[10px] py-1.5 pr-2 text-[13px] hover:bg-muted/60",
        muted && "text-muted-foreground",
      )}
      style={{ paddingLeft: 8 + (depth - 1) * 12 }}
    >
      <span className="min-w-0 truncate">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function IssuesBox({ issues }: { issues: OrgIssues }) {
  const items: string[] = [];
  if (issues.orphanDepts.length > 0) {
    items.push(
      `${issues.orphanDepts.map((d) => `${d.name} (${d.count} คน)`).join(", ")} ผูกกับฝ่ายที่ถูกลบไปแล้ว จึงลอยอยู่นอกฝ่าย`,
    );
  }
  for (const group of issues.duplicateNames) {
    items.push(`มี ${group.map((n) => `“${n}”`).join(" กับ ")} น่าจะเป็นฝ่ายเดียวกัน`);
  }
  if (issues.testDepts.length > 0) {
    items.push(`${issues.testDepts.map((d) => `“${d.name}” (${d.count} คน)`).join(", ")} น่าจะเป็นข้อมูลทดสอบ`);
  }
  const people: string[] = [];
  if (issues.noDepartment > 0) people.push(`พนักงาน ${issues.noDepartment} คนยังไม่มีแผนก`);
  if (issues.noManager > 0) people.push(`${issues.noManager} คนยังไม่ได้ตั้งหัวหน้า`);
  if (issues.managerLoop > 0) people.push(`${issues.managerLoop} คนตั้งหัวหน้าวนกันเอง`);
  if (people.length > 0) items.push(people.join(" · "));

  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#713f12] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b45309] dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0">
        <b className="block text-[#b45309] dark:text-amber-400">ข้อมูลที่ควรแก้ก่อน ผังจึงจะถูกต้อง</b>
        <ul className="mt-1 list-disc space-y-0.5 pl-[18px]">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs">
          HR แก้ได้ในแท็บ{" "}
          <Link href="/organization?tab=departments" className="font-semibold underline underline-offset-2">
            ฝ่าย / แผนก
          </Link>{" "}
          และช่อง “หัวหน้า” ในข้อมูลพนักงาน
        </p>
      </div>
    </div>
  );
}

// ─────────── รายฝ่าย (คนในฝ่าย) ───────────

function DivisionView({
  tree,
  division,
  people,
  onSelect,
}: {
  tree: CompanyTree;
  division: Division;
  people: OrgPerson[];
  onSelect: (key: string) => void;
}) {
  const view = useMemo(() => buildDivisionPeople(division, people), [division, people]);

  return (
    <section className="grid gap-[18px]" aria-label="ผังรายฝ่าย">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="เลือกฝ่าย">
        {tree.divisions.map((d) => {
          const on = d.key === division.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(d.key)}
              className={cn(
                "h-9 shrink-0 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                on
                  ? "border-[#131516] bg-[#131516] text-white dark:border-white dark:bg-white dark:text-[#131516]"
                  : "border-[#cfd6dc] bg-card hover:border-[#0d9488] dark:border-border",
              )}
            >
              {d.name}
              <small className="ml-1 font-medium tabular-nums opacity-70">{d.headcount}</small>
            </button>
          );
        })}
      </div>

      <div className="gv-hero gv-rise grid items-center gap-[18px] px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]" style={rise(0)}>
        <div className="min-w-0">
          <h2 className="text-[22px] leading-snug font-bold sm:text-2xl">{division.name}</h2>
          <p className="mt-0.5 text-[13px] text-white/80">
            {division.isOther
              ? "รวมฝ่ายเล็กที่ไม่มีแผนกย่อย · สายบังคับบัญชาจาก “หัวหน้า” ในข้อมูลพนักงาน"
              : "ผังสายบังคับบัญชาจาก “หัวหน้า” ที่ตั้งไว้ในข้อมูลพนักงาน"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <HeroStat label="พนักงาน" value={view.members.length} />
          <HeroStat label="แผนก" value={division.departments.length} />
          <HeroStat label="หัวหน้าแผนก" value={view.leadCount} />
        </div>
      </div>

      {view.members.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีพนักงานในฝ่ายนี้" />
      ) : (
        <Card className="px-3 py-5">
          <div className="-mx-1 overflow-x-auto px-1 pt-1 pb-3">
            <div className="sm:mx-auto sm:w-max">
              {view.heads.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  {view.heads.map((h) => (
                    <PersonCard key={h.person.id} node={h} tag={`ดูแล ${h.under} คน`} top />
                  ))}
                </div>
              ) : (
                <div className="flex sm:justify-center">
                  <div className="inline-flex w-full items-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6dc] bg-card px-4 py-2.5 sm:w-auto sm:min-w-[230px] dark:border-border">
                    <Building2 className="size-5 shrink-0 text-[#0f766e] dark:text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <b className="block truncate text-sm leading-snug">{division.name}</b>
                      <small className="block text-xs text-muted-foreground">
                        {division.isOther ? "รวมฝ่ายเล็กที่ไม่มีแผนกย่อย" : "ยังไม่มีหัวหน้าฝ่ายในข้อมูลพนักงาน"}
                      </small>
                    </span>
                  </div>
                </div>
              )}
              {view.teams.length > 0 && (
                <div className={ROW}>
                  {view.teams.map((t, i) => (
                    <div key={t.deptId} className={cn(ITEM, "sm:w-[280px]")}>
                      <TeamBox team={t} index={i + 1} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {view.unassigned.length > 0 && <UnassignedBox people={view.unassigned} />}
        </Card>
      )}
      <p className="text-[12.5px] text-muted-foreground">
        กดชื่อคนเพื่อเปิดข้อมูลพนักงาน · คนที่ยังไม่ได้ตั้งหัวหน้าจะขึ้นแยกในกล่อง “ยังไม่ระบุหัวหน้า” ท้ายผัง
      </p>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="gv-glass min-w-0 px-3 py-2.5 sm:min-w-[96px] sm:px-4">
      <small className="block truncate text-xs text-white/80">{label}</small>
      <b className="block text-2xl leading-tight tabular-nums">{value}</b>
    </div>
  );
}

function PersonCard({ node, tag, top }: { node: PersonNode; tag: string; top?: boolean }) {
  const p = node.person;
  return (
    <Link
      href={employeeHref(p.id)}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-[14px] border bg-card px-3.5 py-2.5 transition-colors",
        top
          ? "border-[#99f6e4] shadow-[0_0_0_3px_#ccfbf1,var(--card-shadow)] hover:border-[#0d9488] sm:min-w-[230px] dark:border-primary/40 dark:shadow-none"
          : "border-[#e6f4f1] bg-[#f8fdfc] hover:border-[#99f6e4] dark:border-border dark:bg-accent/40",
      )}
    >
      <PersonAvatar name={p.name} className={top ? "size-11 text-sm" : undefined} />
      <span className="min-w-0">
        <b className="block truncate text-sm leading-snug">{p.name}</b>
        <small className="block truncate text-xs text-muted-foreground">{p.positionTitle ?? "ไม่ระบุตำแหน่ง"}</small>
      </span>
      <span className="ml-auto shrink-0 rounded-full bg-[#ccfbf1] px-2 text-[11px] font-bold whitespace-nowrap text-[#0f766e] tabular-nums dark:bg-accent dark:text-primary">
        {tag}
      </span>
    </Link>
  );
}

const MEMBERS_SHOWN = 4;

function TeamBox({ team, index }: { team: TeamColumn; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? team.members : team.members.slice(0, MEMBERS_SHOWN);
  const hidden = team.members.length - shown.length;
  return (
    <div className="gv-rise overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]" style={rise(index)}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3.5 py-2 text-[13.5px] font-bold">
        <span className="min-w-0 truncate">{team.name}</span>
        <span className="shrink-0 rounded-full bg-[#ccfbf1] px-2.5 text-xs font-bold text-[#0f766e] tabular-nums dark:bg-accent dark:text-primary">
          {team.count}
        </span>
      </div>
      {team.lead && (
        <div className="border-b border-dashed border-border p-2.5">
          <PersonCard node={team.lead} tag={`ดูแล ${team.lead.under} คน`} />
        </div>
      )}
      {shown.length > 0 && (
        <ul className="relative m-0 list-none py-1.5 pr-2 pl-[22px] before:absolute before:top-0 before:bottom-[22px] before:left-6 before:w-0.5 before:bg-[#e6ebee] dark:before:bg-border">
          {shown.map((p) => (
            <li key={p.id} className="relative before:absolute before:top-1/2 before:left-0.5 before:h-0.5 before:w-3.5 before:bg-[#e6ebee] dark:before:bg-border">
              <MemberLink person={p} />
            </li>
          ))}
        </ul>
      )}
      {(hidden > 0 || expanded) && team.members.length > MEMBERS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mb-2.5 ml-10 text-[12.5px] font-semibold text-[#0f766e] hover:underline dark:text-primary"
        >
          {expanded ? "ย่อรายชื่อ" : `+ ดูอีก ${hidden} คน`}
        </button>
      )}
    </div>
  );
}

function MemberLink({ person, className }: { person: OrgPerson; className?: string }) {
  return (
    <Link
      href={employeeHref(person.id)}
      className={cn("flex min-w-0 items-center gap-2 rounded-[10px] py-1.5 pr-1.5 pl-[18px] text-[13px] hover:bg-muted/60", className)}
    >
      <PersonAvatar name={person.name} className="size-[26px] text-[10.5px]" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate">{person.name}</span>
        <small className="block truncate text-[11.5px] text-muted-foreground">{person.positionTitle ?? "ไม่ระบุตำแหน่ง"}</small>
      </span>
    </Link>
  );
}

function UnassignedBox({ people }: { people: OrgPerson[] }) {
  return (
    <div className="mx-1 mt-3 rounded-2xl border border-dashed border-[#cfd6dc] p-3 dark:border-border">
      <SectionHeading
        as="h3"
        title="ยังไม่ระบุหัวหน้า"
        hint={`${people.length} คนยังไม่ได้ตั้งหัวหน้าในข้อมูลพนักงาน`}
        className="mb-2 px-1"
      />
      <ul className="grid list-none gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <li key={p.id} className="min-w-0">
            <MemberLink person={p} className="pl-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
