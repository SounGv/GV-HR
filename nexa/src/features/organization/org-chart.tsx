"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Check, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SectionHeading } from "@/components/shared/section-heading";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

import { useOrgPeople, useSaveOrgMoves } from "./hooks";
import {
  ConfirmMovesDialog,
  DropHint,
  DropZone,
  EditableRow,
  MovedTag,
  OrgEditContext,
  PendingTray,
  useOrgEdit,
  type MoveRow,
  type OrgEditState,
} from "./org-edit";
import {
  applyOrgMoves,
  buildCompanyTree,
  buildDivisionPeople,
  buildDivisionTree,
  checkOrgMoves,
  detectOrgIssues,
  divisionColumns,
  divisionHead,
  hasOrgIssues,
  OTHER_MAX_PEOPLE,
  planOrgDrop,
  type CompanyTree,
  type Division,
  type OrgDropTarget,
  type OrgIssues,
  type OrgMove,
  type OrgMoveProblem,
  type OrgPerson,
  type OrgPlacement,
  type PersonNode,
  type TeamColumn,
} from "./org-tree";
import { DivisionTreeChart } from "./org-tree-view";
import type { DepartmentRow } from "./types";

/** The API takes at most this many people per save. */
const MAX_MOVES = 100;

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/* Tree connectors (org-division-mock.html), drawn from sm up; on phones the
   cards stack as a plain list. Line colour matches the mock's --line. */
const LINE =
  "sm:before:bg-[#cfd8dc] sm:after:bg-[#cfd8dc] dark:sm:before:bg-border dark:sm:after:bg-border";
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
export function OrgChart({
  departments,
  companyName,
}: {
  departments: DepartmentRow[];
  companyName?: string;
}) {
  const peopleQuery = useOrgPeople();
  const people = useMemo(() => peopleQuery.data?.data ?? [], [peopleQuery.data]);
  const tree = useMemo(() => buildCompanyTree(departments, people), [departments, people]);
  const issues = useMemo(() => detectOrgIssues(departments, people), [departments, people]);

  const [view, setView] = useState<"company" | "division">("company");
  const [divisionKey, setDivisionKey] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Edit mode (HR / admin): pending placements by employee id, only ones that differ from the saved data.
  const { can } = useAuth();
  const canEdit = can("employee:update");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<ReadonlyMap<string, OrgPlacement>>(() => new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveMoves = useSaveOrgMoves();

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const pendingMoves = useMemo<OrgMove[]>(
    () =>
      [...pending]
        .filter(([id, p]) => {
          const cur = byId.get(id);
          return cur && (cur.departmentId !== p.departmentId || cur.managerId !== p.managerId);
        })
        .map(([employeeId, p]) => ({ employeeId, ...p })),
    [pending, byId],
  );
  // While editing, the division view shows the chart as it will be after saving.
  const shownPeople = useMemo(
    () => (editing ? applyOrgMoves(people, pendingMoves) : people),
    [editing, people, pendingMoves],
  );
  const moveRows = useMemo<MoveRow[]>(() => {
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const label = (p: OrgPlacement) => ({
      dept: p.departmentId ? (deptName.get(p.departmentId) ?? "แผนกที่ถูกลบ") : "ไม่มีแผนก",
      manager: p.managerId ? (byId.get(p.managerId)?.name ?? "หัวหน้านอกรายชื่อ") : "ไม่มีหัวหน้า",
    });
    return pendingMoves.map((m) => {
      const cur = byId.get(m.employeeId)!;
      return { id: m.employeeId, name: cur.name, before: label(cur), after: label(m) };
    });
  }, [pendingMoves, departments, byId]);

  if (departments.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="ยังไม่มีโครงสร้างองค์กร"
        description="เพิ่มฝ่ายและแผนกในแท็บ ฝ่าย / แผนก"
      />
    );
  }
  if (peopleQuery.isLoading) return <TableLoadingState rows={4} />;
  if (peopleQuery.isError) return <ErrorState onRetry={() => peopleQuery.refetch()} />;

  const selected = tree.divisions.find((d) => d.key === divisionKey) ?? tree.divisions[0];
  const isEditing = canEdit && editing && view === "division" && !!selected;

  function openDivision(key: string) {
    setDivisionKey(key);
    setView("division");
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function toggleEdit() {
    if (editing && pendingMoves.length > 0) {
      toast.info(
        `ยังไม่ได้บันทึก ${pendingMoves.length} รายการ · กด “แก้ไขผัง” เพื่อกลับไปตรวจและบันทึก`,
      );
    }
    setEditing((v) => !v);
  }

  /** Stage what a drop / "ย้ายไป…" pick does, unless it would loop or exceed one save. */
  function move(personId: string, target: OrgDropTarget) {
    if (!selected) return;
    const planned = planOrgDrop(selected, shownPeople, personId, target);
    if (planned.length === 0) return;
    const next = new Map(
      pendingMoves.map((m) => [
        m.employeeId,
        { departmentId: m.departmentId, managerId: m.managerId },
      ]),
    );
    for (const m of planned) {
      const cur = byId.get(m.employeeId);
      if (cur && cur.departmentId === m.departmentId && cur.managerId === m.managerId)
        next.delete(m.employeeId);
      else next.set(m.employeeId, { departmentId: m.departmentId, managerId: m.managerId });
    }
    const problem = checkOrgMoves(
      people,
      [...next].map(([employeeId, p]) => ({ employeeId, ...p })),
    );
    if (problem) {
      toast.error(problemText(problem, byId));
      return;
    }
    if (next.size > MAX_MOVES) {
      toast.error(`แก้ได้ครั้งละไม่เกิน ${MAX_MOVES} คน · กด “ตรวจและบันทึก” ก่อน แล้วค่อยแก้ต่อ`);
      return;
    }
    setPending(next);
  }

  async function save() {
    try {
      const res = await saveMoves.mutateAsync(pendingMoves);
      toast.success(`บันทึกผังแล้ว · แก้ข้อมูลพนักงาน ${res.data.updated} คน`);
      setPending(new Map());
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  const editState: OrgEditState | null =
    isEditing && selected
      ? {
          columns: divisionColumns(selected),
          moved: new Set(pendingMoves.map((m) => m.employeeId)),
          move,
        }
      : null;

  return (
    <div ref={topRef} className="grid scroll-mt-4 gap-5">
      <div
        role="group"
        aria-label="มุมมองผังองค์กร"
        className="border-border bg-card inline-flex w-fit max-w-full rounded-xl border p-1 shadow-[var(--card-shadow)]"
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
        <CompanyView
          tree={tree}
          people={people}
          issues={issues}
          companyName={companyName}
          onOpen={openDivision}
        />
      ) : selected ? (
        <OrgEditContext.Provider value={editState}>
          <DivisionView
            tree={tree}
            division={selected}
            people={isEditing ? shownPeople : people}
            onSelect={setDivisionKey}
            editButton={canEdit ? { editing: isEditing, onToggle: toggleEdit } : null}
          />
        </OrgEditContext.Provider>
      ) : (
        <EmptyState icon={Building2} title="ยังไม่มีฝ่าย" />
      )}

      {isEditing && (
        <>
          {/* Room so the tray never covers the last row. */}
          {moveRows.length > 0 && <div aria-hidden="true" className="h-40" />}
          <PendingTray
            rows={moveRows}
            onUndoAll={() => setPending(new Map())}
            onReview={() => setConfirmOpen(true)}
          />
          <ConfirmMovesDialog
            open={confirmOpen && moveRows.length > 0}
            onOpenChange={setConfirmOpen}
            rows={moveRows}
            saving={saveMoves.isPending}
            onSave={save}
          />
        </>
      )}
    </div>
  );
}

function problemText(problem: OrgMoveProblem, byId: Map<string, OrgPerson>): string {
  const name = (id: string) => byId.get(id)?.name ?? "พนักงานนอกรายชื่อ";
  switch (problem.kind) {
    case "self":
      return `ตั้ง ${name(problem.employeeId)} เป็นหัวหน้าของตัวเองไม่ได้`;
    case "duplicate":
      return `มี ${name(problem.employeeId)} ซ้ำในรายการ`;
    case "cycle":
      return `ย้ายแบบนี้ไม่ได้ เพราะหัวหน้าจะวนกันเอง: ${[...problem.ids, problem.ids[0]].map(name).join(" → ")}`;
  }
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
            <div
              className="gv-hero gv-rise flex w-full items-center gap-3 rounded-[18px] px-5 py-3.5 sm:inline-flex sm:w-auto"
              style={rise(0)}
            >
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
      className="gv-rise border-border bg-card overflow-hidden rounded-2xl border shadow-[var(--card-shadow)] transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(19,21,22,.06),0_14px_28px_-14px_rgba(19,21,22,.25)]"
      style={rise(index)}
    >
      <div className="dark:border-border border-b border-[#e6f4f1] bg-[linear-gradient(180deg,#f0fdfa,transparent)] px-3.5 py-3 dark:bg-[linear-gradient(180deg,#12332f,transparent)]">
        <b className="block text-[14.5px] leading-snug">{division.name}</b>
        <div className="text-muted-foreground mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate">
            {division.isOther ? `ฝ่ายเล็กไม่มีแผนกย่อย (≤${OTHER_MAX_PEOPLE} คน)` : division.code}
          </span>
          <span className="dark:bg-accent dark:text-primary shrink-0 rounded-full bg-[#ccfbf1] px-2.5 text-xs font-bold text-[#0f766e] tabular-nums">
            {division.headcount} คน
          </span>
        </div>
        {head && (
          <Link
            href={employeeHref(head.person.id)}
            className="mt-2 flex items-center gap-2 rounded-lg hover:opacity-80"
          >
            <PersonAvatar
              name={head.person.name}
              gender={head.person.gender ?? null}
              seed={head.person.id}
            />
            <small className="text-muted-foreground min-w-0 text-xs leading-tight">
              <b className="text-foreground block truncate text-[12.5px] font-semibold">
                {head.person.name}
              </b>
              <span className="block truncate">
                {head.person.positionTitle ?? "หัวหน้าสูงสุดในฝ่าย"}
              </span>
            </small>
          </Link>
        )}
      </div>
      <div className="px-2 pt-1.5 pb-2">
        {division.rootCount > 0 && division.departments.length > 0 && (
          <DeptLine name="ขึ้นตรงกับฝ่าย" count={division.rootCount} depth={1} muted />
        )}
        {division.departments.length === 0 ? (
          <p className="text-muted-foreground/80 px-2 py-1.5 text-[13px]">ไม่มีแผนกย่อย</p>
        ) : (
          division.departments.map((dep) => (
            <DeptLine key={dep.id} name={dep.name} count={dep.count} depth={dep.depth} />
          ))
        )}
      </div>
      <div className="flex justify-center px-2.5 pb-3">
        <button
          type="button"
          onClick={() => onOpen(division.key)}
          className="dark:border-border inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] border-[#cfd6dc] px-3.5 text-[12.5px] font-semibold transition-colors hover:border-[#0d9488] hover:text-[#0f766e]"
        >
          {division.isOther ? "เปิดผัง →" : "เปิดผังฝ่าย →"}
        </button>
      </div>
    </div>
  );
}

function DeptLine({
  name,
  count,
  depth,
  muted,
}: {
  name: string;
  count: number;
  depth: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "hover:bg-muted/60 flex items-center justify-between gap-2 rounded-[10px] py-1.5 pr-2 text-[13px]",
        muted && "text-muted-foreground",
      )}
      style={{ paddingLeft: 8 + (depth - 1) * 12 }}
    >
      <span className="min-w-0 truncate">{name}</span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{count}</span>
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
    items.push(
      `${issues.testDepts.map((d) => `“${d.name}” (${d.count} คน)`).join(", ")} น่าจะเป็นข้อมูลทดสอบ`,
    );
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
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-[#b45309] dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <b className="block text-[#b45309] dark:text-amber-400">
          ข้อมูลที่ควรแก้ก่อน ผังจึงจะถูกต้อง
        </b>
        <ul className="mt-1 list-disc space-y-0.5 pl-[18px]">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs">
          HR แก้ได้ในแท็บ{" "}
          <Link
            href="/organization?tab=departments"
            className="font-semibold underline underline-offset-2"
          >
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
  editButton,
}: {
  tree: CompanyTree;
  division: Division;
  people: OrgPerson[];
  onSelect: (key: string) => void;
  /** Shown only to HR / admin (employee:update). */
  editButton: { editing: boolean; onToggle: () => void } | null;
}) {
  const editing = useOrgEdit() !== null;
  const view = useMemo(
    () => buildDivisionPeople(division, people, { includeEmpty: editing }),
    [division, people, editing],
  );
  // Read-only view: the reporting tree (head → team heads → teams), like the paper chart.
  const reporting = useMemo(
    () => (editing ? null : buildDivisionTree(division, people)),
    [division, people, editing],
  );

  return (
    <section className="gv-otree-print grid gap-[18px]" aria-label="ผังรายฝ่าย">
      <div
        className="ot-noprint -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="เลือกฝ่าย"
      >
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
                  : "bg-card dark:border-border border-[#cfd6dc] hover:border-[#0d9488]",
              )}
            >
              {d.name}
              <small className="ml-1 font-medium tabular-nums opacity-70">{d.headcount}</small>
            </button>
          );
        })}
      </div>

      <div
        className="gv-hero gv-rise grid items-center gap-[18px] px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]"
        style={rise(0)}
      >
        <div className="min-w-0">
          <h2 className="text-[22px] leading-snug font-bold sm:text-2xl">{division.name}</h2>
          <p className="mt-0.5 text-[13px] text-white/80">
            {division.isOther
              ? "รวมฝ่ายเล็กที่ไม่มีแผนกย่อย · สายบังคับบัญชาจาก “หัวหน้า” ในข้อมูลพนักงาน"
              : "ผังสายบังคับบัญชาจาก “หัวหน้า” ที่ตั้งไว้ในข้อมูลพนักงาน"}
          </p>
          {editButton && (
            <button
              type="button"
              aria-pressed={editButton.editing}
              onClick={editButton.onToggle}
              className={cn(
                "mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold transition-[translate,background-color] duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:h-9",
                editButton.editing ? "bg-[#CDEB03] text-[#131516]" : "bg-white text-[#0f766e]",
              )}
            >
              {editButton.editing ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Pencil className="size-4" aria-hidden="true" />
              )}
              {editButton.editing ? "เสร็จ" : "แก้ไขผัง"}
            </button>
          )}
        </div>
        {reporting ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <HeroStat label="พนักงาน" value={reporting.members.length} />
            <HeroStat label="หัวหน้า" value={reporting.leads.length} />
            <HeroStat label="ทีม" value={reporting.teamCount} />
            <HeroStat label="รายวัน" value={reporting.dailyCount} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <HeroStat label="พนักงาน" value={view.members.length} />
            <HeroStat label="แผนก" value={division.departments.length} />
            <HeroStat label="หัวหน้าแผนก" value={view.leadCount} />
          </div>
        )}
      </div>

      {editing && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-[13px] text-[#713f12] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <span aria-hidden="true">⇅</span>
          <span>
            <b>โหมดแก้ไข:</b> ลากชื่อไปวางที่ช่อง “หัวหน้าทีม” หรือ “สมาชิก” ของแผนกที่ต้องการ
            หรือกดปุ่ม ⇄ ข้างชื่อแล้วเลือก “ย้ายไป…” · ยังไม่บันทึกจนกว่าจะกด “ตรวจและบันทึก”
          </span>
        </div>
      )}

      {view.members.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีพนักงานในฝ่ายนี้" />
      ) : reporting ? (
        <>
          <DivisionTreeChart tree={reporting} divisionName={division.name} />
          {reporting.unassigned.length > 0 && <UnassignedBox people={reporting.unassigned} />}
        </>
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
                  <div className="bg-card dark:border-border inline-flex w-full items-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6dc] px-4 py-2.5 sm:w-auto sm:min-w-[230px]">
                    <Building2
                      className="dark:text-primary size-5 shrink-0 text-[#0f766e]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-sm leading-snug">{division.name}</b>
                      <small className="text-muted-foreground block text-xs">
                        {division.isOther
                          ? "รวมฝ่ายเล็กที่ไม่มีแผนกย่อย"
                          : "ยังไม่มีหัวหน้าฝ่ายในข้อมูลพนักงาน"}
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
      {!editing && (
        <p className="ot-noprint text-muted-foreground text-[12.5px]">
          กดชื่อเพื่อเปิดข้อมูลพนักงาน · ผู้ช่วยหัวหน้าดูจากตำแหน่งที่ขึ้นต้นว่า “ผู้ช่วยหัวหน้า” ·
          รายวันดูจากประเภทการจ้าง · คนที่ยังไม่ได้ตั้งหัวหน้าอยู่ในกล่อง
          “ยังไม่ระบุหัวหน้า” ท้ายผัง
        </p>
      )}
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
  const edit = useOrgEdit();
  const p = node.person;
  const className = cn(
    "flex min-w-0 items-center gap-2.5 rounded-[14px] border bg-card px-3.5 py-2.5 transition-colors",
    top
      ? "border-[#99f6e4] shadow-[0_0_0_3px_#ccfbf1,var(--card-shadow)] hover:border-[#0d9488] sm:min-w-[230px] dark:border-primary/40 dark:shadow-none"
      : "border-[#e6f4f1] bg-[#f8fdfc] hover:border-[#99f6e4] dark:border-border dark:bg-accent/40",
  );
  const avatar = (
    <PersonAvatar
      name={p.name}
      gender={p.gender ?? null}
      seed={p.id}
      className={top ? "size-11 text-sm" : undefined}
    />
  );
  const text = (moved: boolean) => (
    <span className="min-w-0">
      <b className="block truncate text-sm leading-snug">{p.name}</b>
      <Subtitle moved={moved} className="text-xs">
        {p.positionTitle ?? "ไม่ระบุตำแหน่ง"}
      </Subtitle>
    </span>
  );
  const tagEl = (
    <span className="dark:bg-accent dark:text-primary shrink-0 rounded-full bg-[#ccfbf1] px-2 text-[11px] font-bold whitespace-nowrap text-[#0f766e] tabular-nums">
      {tag}
    </span>
  );

  if (edit) {
    return (
      <EditableRow person={p} className={cn(className, "gap-2 px-2.5 py-2")} trailing={tagEl}>
        {(moved) => (
          <>
            {avatar}
            {text(moved)}
          </>
        )}
      </EditableRow>
    );
  }
  return (
    <Link href={employeeHref(p.id)} className={className}>
      {avatar}
      {text(false)}
      <span className="ml-auto">{tagEl}</span>
    </Link>
  );
}

/** Position line under a name; in edit mode a moved person also gets the ย้ายแล้ว word. */
function Subtitle({
  moved,
  className,
  children,
}: {
  moved: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <small className={cn("text-muted-foreground flex min-w-0 items-center gap-1", className)}>
      {moved && <MovedTag />}
      <span className="min-w-0 truncate">{children}</span>
    </small>
  );
}

const MEMBERS_SHOWN = 4;

function TeamBox({ team, index }: { team: TeamColumn; index: number }) {
  const edit = useOrgEdit();
  const [expanded, setExpanded] = useState(false);
  // Edit mode shows everyone: a collapsed list would hide people HR needs to drag.
  const shown = expanded || edit ? team.members : team.members.slice(0, MEMBERS_SHOWN);
  const hidden = team.members.length - shown.length;
  return (
    <div
      className="gv-rise border-border bg-card overflow-hidden rounded-2xl border shadow-[var(--card-shadow)]"
      style={rise(index)}
    >
      <div className="border-border bg-muted/50 flex items-center justify-between gap-2 border-b px-3.5 py-2 text-[13.5px] font-bold">
        <span className="min-w-0 truncate">{team.name}</span>
        <span className="dark:bg-accent dark:text-primary shrink-0 rounded-full bg-[#ccfbf1] px-2.5 text-xs font-bold text-[#0f766e] tabular-nums">
          {team.count}
        </span>
      </div>
      {(team.lead || edit) && (
        <DropZone
          target={{ deptId: team.deptId, slot: "lead" }}
          label="หัวหน้าทีม"
          className="border-border border-b border-dashed p-2.5"
        >
          {team.lead ? (
            <PersonCard node={team.lead} tag={`ดูแล ${team.lead.under} คน`} />
          ) : (
            <DropHint>วางที่นี่เพื่อตั้งเป็นหัวหน้าทีม</DropHint>
          )}
        </DropZone>
      )}
      <DropZone target={{ deptId: team.deptId, slot: "member" }} label="สมาชิก">
        {shown.length > 0 && (
          <ul className="dark:before:bg-border relative m-0 list-none py-1.5 pr-2 pl-[22px] before:absolute before:top-0 before:bottom-[22px] before:left-6 before:w-0.5 before:bg-[#e6ebee]">
            {shown.map((p) => (
              <li
                key={p.id}
                className="dark:before:bg-border relative before:absolute before:top-1/2 before:left-0.5 before:h-0.5 before:w-3.5 before:bg-[#e6ebee]"
              >
                <MemberLink person={p} />
              </li>
            ))}
          </ul>
        )}
        {edit && shown.length === 0 && <DropHint>วางที่นี่เพื่อย้ายเข้าแผนกนี้</DropHint>}
      </DropZone>
      {!edit && (hidden > 0 || expanded) && team.members.length > MEMBERS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="dark:text-primary mb-2.5 ml-10 text-[12.5px] font-semibold text-[#0f766e] hover:underline"
        >
          {expanded ? "ย่อรายชื่อ" : `+ ดูอีก ${hidden} คน`}
        </button>
      )}
    </div>
  );
}

function MemberLink({ person, className }: { person: OrgPerson; className?: string }) {
  const edit = useOrgEdit();
  const rowClass = cn(
    "flex min-w-0 items-center gap-2 rounded-[10px] py-1.5 pr-1.5 pl-[18px] text-[13px] hover:bg-muted/60",
    className,
  );
  const body = (moved: boolean) => (
    <>
      <PersonAvatar
        name={person.name}
        gender={person.gender ?? null}
        seed={person.id}
        className="size-[26px] text-[10.5px]"
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate">{person.name}</span>
        <Subtitle moved={moved} className="text-[11.5px]">
          {person.positionTitle ?? "ไม่ระบุตำแหน่ง"}
        </Subtitle>
      </span>
    </>
  );
  if (edit) {
    return (
      <EditableRow person={person} className={cn(rowClass, "border border-transparent pl-2")}>
        {body}
      </EditableRow>
    );
  }
  return (
    <Link href={employeeHref(person.id)} className={rowClass}>
      {body(false)}
    </Link>
  );
}

function UnassignedBox({ people }: { people: OrgPerson[] }) {
  return (
    <div className="dark:border-border mx-1 mt-3 rounded-2xl border border-dashed border-[#cfd6dc] p-3">
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
