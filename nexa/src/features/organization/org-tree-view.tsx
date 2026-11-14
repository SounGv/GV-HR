"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Building2, Printer, Users } from "lucide-react";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";

import type { DivisionTree, OrgPerson, PersonNode, TreeLead, TreeTeam } from "./org-tree";

const employeeHref = (id: string) => `/employees/${id}`;
const rise = (i: number) => ({ "--i": i }) as CSSProperties;
/** A team card switches to two name columns past this many names. */
const WIDE_AFTER = 8;

/**
 * One division drawn as a reporting tree (org-tree-mock.html): head → team
 * heads → team cards with assistants first and a รายวัน box. Read-only; the
 * org chart's edit mode keeps its own column layout with drop zones.
 */
export function DivisionTreeChart({
  tree,
  divisionName,
}: {
  tree: DivisionTree;
  divisionName: string;
}) {
  const [fit, setFit] = useState(true);
  const [showDaily, setShowDaily] = useState(true);
  const [scale, setScale] = useState(1);
  const boardRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // พอดีจอ: shrink the tree to the board's width (desktop only; phones get the indented list).
  useLayoutEffect(() => {
    const board = boardRef.current;
    const inner = treeRef.current;
    if (!board || !inner) return;
    const measure = () => {
      if (!fit || !window.matchMedia("(min-width: 768px)").matches) {
        setScale(1);
        return;
      }
      inner.style.zoom = "1";
      const natural = inner.scrollWidth;
      const room = board.clientWidth - 32;
      const next = natural > room ? Math.max(0.4, room / natural) : 1;
      inner.style.zoom = String(next);
      setScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    return () => ro.disconnect();
  }, [fit, showDaily, tree]);

  useEffect(() => {
    const done = () => document.documentElement.classList.remove("gv-print-org");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  function printChart() {
    document.documentElement.classList.add("gv-print-org");
    window.print();
  }

  const branches = tree.leads.length + tree.direct.length;
  let order = 1;

  return (
    <div className="grid gap-3">
      <div className="ot-noprint flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-muted-foreground mr-auto flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-[4px] bg-[#0f766e]" aria-hidden="true" />
            ผู้ช่วยหัวหน้า
          </span>
          {tree.dailyCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <i
                className="inline-block size-3 rounded-[4px] border border-dashed border-[#efdfae] bg-[#fdf8ea]"
                aria-hidden="true"
              />
              พนักงานรายวัน
            </span>
          )}
        </div>
        <span className="text-muted-foreground hidden text-xs font-semibold md:inline">
          ขนาด{" "}
          <b className="text-foreground inline-block min-w-[38px] text-right tabular-nums">
            {Math.round(scale * 100)}%
          </b>
        </span>
        <Toggle label="พอดีจอ" on={fit} onChange={setFit} className="hidden md:inline-flex" />
        {tree.dailyCount > 0 && (
          <Toggle label="แสดงรายวัน" on={showDaily} onChange={setShowDaily} />
        )}
        <button
          type="button"
          onClick={printChart}
          className="border-border bg-card hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold hover:border-[#0d9488] md:inline-flex"
        >
          <Printer className="size-4" aria-hidden="true" />
          พิมพ์ผัง
        </button>
      </div>

      <div
        ref={boardRef}
        className={cn("gv-otree-board", fit && scale < 1 && "is-fit", !showDaily && "no-daily")}
      >
        <div ref={treeRef} className="gv-otree">
          <ul className="br">
            <li className="nd">
              {tree.heads.length > 0 ? (
                <div className="ot-tops">
                  {tree.heads.map((h) => (
                    <TopCard key={h.person.id} node={h} />
                  ))}
                </div>
              ) : (
                <div className="ot-empty">
                  <Building2
                    className="dark:text-primary size-5 shrink-0 text-[#0f766e]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <b className="block truncate text-sm leading-snug">{divisionName}</b>
                    <small className="text-muted-foreground block text-xs">
                      ยังไม่มีหัวหน้าฝ่ายในข้อมูลพนักงาน
                    </small>
                  </span>
                </div>
              )}
              {branches > 0 && (
                <ul className="br">
                  {tree.leads.map((lead) => (
                    <li key={lead.person.id} className="nd">
                      <HeadCard lead={lead} index={order++} />
                      {lead.teams.length > 0 && (
                        <ul className="br">
                          {lead.teams.map((t) => (
                            <li key={t.deptId ?? "none"} className="nd">
                              <TeamCard team={t} index={order++} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {tree.direct.map((t) => (
                    <li key={`direct-${t.deptId ?? "none"}`} className="nd">
                      <TeamCard team={t} index={order++} direct={tree.heads.length > 0} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
  className,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex min-h-10 items-center gap-2.5 text-[13px] font-semibold",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors after:absolute after:top-[3px] after:size-[18px] after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,.25)] after:transition-[left] after:duration-200 motion-reduce:after:transition-none",
          on ? "bg-[#0f766e] after:left-[19px]" : "dark:bg-muted bg-[#cfd6dc] after:left-[3px]",
        )}
      />
      {label}
    </button>
  );
}

function TopCard({ node }: { node: PersonNode }) {
  const p = node.person;
  return (
    <Link href={employeeHref(p.id)} className="ot-top ot-rise" style={rise(0)}>
      <span className="ot-av shrink-0">
        <PersonAvatar
          name={p.name}
          gender={p.gender ?? null}
          seed={p.id}
          src={p.avatarUrl}
          className="size-[52px] text-base"
        />
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[18px] leading-snug">{p.name}</b>
        <small className="block truncate text-[12.5px] text-white/80">
          {p.positionTitle ?? "หัวหน้าฝ่าย"}
        </small>
        <span className="mt-1 inline-block rounded-md bg-[#CDEB03] px-2 text-[11px] font-bold text-[#131516] tabular-nums">
          ดูแล {node.under} คน
        </span>
      </span>
    </Link>
  );
}

function HeadCard({ lead, index }: { lead: TreeLead; index: number }) {
  const p = lead.person;
  return (
    <Link href={employeeHref(p.id)} className="ot-head ot-rise" style={rise(index)}>
      <PersonAvatar
        name={p.name}
        gender={p.gender ?? null}
        seed={p.id}
        src={p.avatarUrl}
        className="size-11 text-sm"
      />
      <span className="min-w-0">
        <b className="block truncate text-[15px] leading-snug">{p.name}</b>
        <small className="text-muted-foreground block truncate text-xs">
          {p.positionTitle ?? "หัวหน้า"}
        </small>
      </span>
      <span className="dark:bg-accent dark:text-primary ml-auto shrink-0 rounded-full bg-[#ccfbf1] px-2 text-[11.5px] font-bold whitespace-nowrap text-[#0f766e] tabular-nums">
        ดูแล {lead.under} คน
      </span>
    </Link>
  );
}

function TeamCard({ team, index, direct }: { team: TreeTeam; index: number; direct?: boolean }) {
  const named = team.assistants.length + team.members.length;
  return (
    <div className={cn("ot-team ot-rise", named > WIDE_AFTER && "is-wide")} style={rise(index)}>
      <div className="ot-th">
        <span className="ot-ic" aria-hidden="true">
          <Users className="size-4" />
        </span>
        <span className="min-w-0">
          <b className="block truncate text-sm leading-tight">{team.name}</b>
          {direct ? (
            <small className="text-muted-foreground block text-[11px]">ขึ้นตรงกับหัวหน้าฝ่าย</small>
          ) : (
            team.code && <span className="ot-code">{team.code}</span>
          )}
        </span>
        <span className="text-muted-foreground ml-auto text-right text-[11px] leading-tight">
          <b className="text-foreground block text-lg tabular-nums">{team.count}</b>คน
        </span>
      </div>
      {named > 0 && (
        <ol className="ot-ml">
          {team.assistants.map((p) => (
            <li key={p.id} className="is-asst">
              <NameRow person={p} tag="ผู้ช่วยหัวหน้า" />
            </li>
          ))}
          {team.members.map((p) => (
            <li key={p.id}>
              <NameRow person={p} />
            </li>
          ))}
        </ol>
      )}
      {team.daily.length > 0 && (
        <div className={cn("ot-daily", named === 0 && "mt-2.5")}>
          <p className="mb-1.5 flex justify-between text-[11.5px] font-bold">
            <span>รายวัน</span>
            <span className="tabular-nums">{team.daily.length} คน</span>
          </p>
          <div className="ot-dl">
            {team.daily.map((p) => (
              <Link key={p.id} href={employeeHref(p.id)} title={p.positionTitle ?? undefined}>
                <PersonAvatar
                  name={p.name}
                  gender={p.gender ?? null}
                  seed={p.id}
                  src={p.avatarUrl}
                  className="size-5 text-[9px]"
                />
                <span className="truncate">{shortName(p)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NameRow({ person, tag }: { person: OrgPerson; tag?: string }) {
  return (
    <Link
      href={employeeHref(person.id)}
      className="ot-row"
      title={person.positionTitle ?? undefined}
    >
      <PersonAvatar
        name={person.name}
        gender={person.gender ?? null}
        seed={person.id}
        src={person.avatarUrl}
        className="size-[26px] text-[10.5px]"
      />
      <span className="min-w-0 flex-1 truncate">{person.name}</span>
      {tag && <span className="ot-tag">{tag}</span>}
    </Link>
  );
}

/** Nickname when there is one (the paper chart uses nicknames), else the first name. */
function shortName(p: OrgPerson): string {
  return p.nickname || p.name.split(" ")[0] || p.name;
}
