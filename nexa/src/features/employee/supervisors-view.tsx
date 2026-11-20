"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MultiSelectField, type MultiSelectOption } from "@/components/shared/multi-select-field";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateEmployee } from "./api";
import { employeeKeys, useOrgOptions } from "./hooks";
import type { OrgOptions } from "./types";

type Person = OrgOptions["managers"][number];

/** Only people who work here now take part: a person who has left is not anyone's supervisor or team member. */
const WORKING = new Set(["ACTIVE", "ON_LEAVE"]);
const NONE = "__none__";

/**
 * Supervisors and their teams in two panels (the Favpo "หัวหน้างาน" page): the supervisors on the left with how many people
 * each has, the selected supervisor's team on the right. HR can bring people into the team or take them out; each change is
 * the same one the employee form makes (the employee's supervisor), including its check that nobody ends up above themselves.
 *
 * @param canEdit Whether this person may change reporting lines (employee:update). Everyone else only reads.
 */
export function SupervisorsView({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, isError, refetch } = useOrgOptions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string>("");
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const departments = useMemo(() => new Map((data?.data.departments ?? []).map((d) => [d.id, d.name])), [data]);
  const people = useMemo(() => (data?.data.managers ?? []).filter((p) => WORKING.has(p.status)), [data]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const teamOf = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of people) if (p.managerId && byId.has(p.managerId)) m.set(p.managerId, [...(m.get(p.managerId) ?? []), p]);
    for (const list of m.values()) list.sort((a, b) => a.firstName.localeCompare(b.firstName, "th"));
    return m;
  }, [people, byId]);
  const supervisors = useMemo(
    () => people.filter((p) => teamOf.has(p.id)).sort((a, b) => a.firstName.localeCompare(b.firstName, "th")),
    [people, teamOf],
  );
  const withoutSupervisor = useMemo(() => people.filter((p) => !p.managerId || !byId.has(p.managerId)), [people, byId]);

  const q = search.trim().toLowerCase();
  const shown = q ? supervisors.filter((p) => `${displayName(p)} ${p.employeeCode}`.toLowerCase().includes(q)) : supervisors;
  const current = picked === NONE ? NONE : (byId.has(picked) ? picked : (supervisors[0]?.id ?? NONE));
  const supervisor = current === NONE ? null : (byId.get(current) ?? null);
  const team = supervisor ? (teamOf.get(supervisor.id) ?? []) : withoutSupervisor;

  // Who could join this team: everyone working who is not already in it, not the supervisor, and not above the supervisor
  // (the server refuses that too; hiding them here saves a pointless error).
  const above = useMemo(() => {
    const set = new Set<string>();
    let cursor = supervisor?.managerId ?? null;
    while (cursor && !set.has(cursor)) {
      set.add(cursor);
      cursor = byId.get(cursor)?.managerId ?? null;
    }
    return set;
  }, [supervisor, byId]);
  const options: MultiSelectOption[] = useMemo(() => {
    if (!supervisor) return [];
    return people
      .filter((p) => p.id !== supervisor.id && p.managerId !== supervisor.id && !above.has(p.id))
      .map((p) => {
        const mgr = p.managerId ? byId.get(p.managerId) : null;
        return { value: p.id, label: `${displayName(p)} · ${p.employeeCode}${mgr ? ` (ตอนนี้ใต้ ${displayName(mgr)})` : " (ยังไม่มีหัวหน้า)"}` };
      });
  }, [people, supervisor, above, byId]);

  async function apply(ids: string[], managerId: string | null) {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    // One after the other: each save is checked on its own, and one that fails does not stop the rest.
    for (const id of ids) {
      try {
        await updateEmployee(id, { managerId });
        ok++;
      } catch (e) {
        failed.push(`${displayName(byId.get(id) ?? { firstName: id, lastName: "", nickname: null })}: ${e instanceof ApiError ? e.message : "บันทึกไม่ได้"}`);
      }
    }
    await qc.invalidateQueries({ queryKey: employeeKeys.orgOptions });
    await qc.invalidateQueries({ queryKey: employeeKeys.all });
    setBusy(false);
    if (ok > 0) toast.success(managerId ? `ย้ายเข้าทีมแล้ว ${ok} คน` : `นำออกจากทีมแล้ว ${ok} คน`);
    if (failed.length > 0) toast.error(`บันทึกไม่ได้ ${failed.length} คน`, { description: failed.slice(0, 3).join("\n") });
    return failed.length === 0;
  }

  if (isLoading) return <TableLoadingState rows={8} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  if (people.length === 0) return <EmptyState icon={Users} title="ยังไม่มีพนักงานในรายการนี้" description="เพิ่มพนักงานก่อน แล้วกำหนดหัวหน้างานที่หน้านี้" />;

  const moving = toAdd.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const fromOthers = moving.filter((p) => p.managerId).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {/* Left: supervisors */}
      <section aria-label="หัวหน้างาน" className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาหัวหน้า ชื่อหรือรหัส" className="pl-9" aria-label="ค้นหาหัวหน้า" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          หัวหน้างาน <span className="tabular-nums">({supervisors.length})</span>
        </h2>
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPicked(p.id)}
                aria-current={current === p.id ? "true" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                  current === p.id && "bg-accent font-semibold",
                )}
              >
                <PersonAvatar name={displayName(p)} gender={p.gender} seed={p.id} src={p.avatarUrl} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm break-words text-foreground">{displayName(p)}</span>
                  <span className="block text-xs text-muted-foreground">{p.employeeCode}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{teamOf.get(p.id)?.length ?? 0} คน</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="py-3 text-sm text-muted-foreground">ไม่พบหัวหน้าที่ตรงกับคำค้นหา</li>}
        </ul>
        <button
          type="button"
          onClick={() => setPicked(NONE)}
          aria-current={current === NONE ? "true" : undefined}
          className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 text-sm hover:bg-muted", current === NONE && "bg-accent font-semibold")}
        >
          <span>ยังไม่มีหัวหน้า</span>
          <span className="tabular-nums text-muted-foreground">{withoutSupervisor.length} คน</span>
        </button>
      </section>

      {/* Right: the selected team */}
      <section aria-label="ลูกทีม" className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {supervisor ? (
              <>
                ทีมของ {displayName(supervisor)} <span className="font-normal tabular-nums text-muted-foreground">({team.length} คน)</span>
              </>
            ) : (
              <>
                พนักงานที่ยังไม่มีหัวหน้า <span className="font-normal tabular-nums text-muted-foreground">({team.length} คน)</span>
              </>
            )}
          </h2>
          {supervisor && (
            <Button variant="outline" render={<Link href={`/employees/${supervisor.id}`} />}>
              ดูโปรไฟล์หัวหน้า
            </Button>
          )}
        </div>

        {team.length === 0 ? (
          <EmptyState icon={Users} title="ยังไม่มีลูกทีม" description={canEdit ? "เลือกพนักงานด้านล่าง แล้วกด เพิ่มเข้าทีม" : "หัวหน้าคนนี้ยังไม่มีลูกทีม"} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="w-12 px-3 py-2 font-semibold">ที่</th>
                  <th className="px-3 py-2 font-semibold">พนักงาน</th>
                  <th className="px-3 py-2 font-semibold">แผนก</th>
                  {supervisor && canEdit && <th className="w-20 px-3 py-2 text-right font-semibold">ทำรายการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.map((p, i) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/employees/${p.id}`} className="flex min-h-11 items-center gap-2.5 text-primary hover:underline">
                        <PersonAvatar name={displayName(p)} gender={p.gender} seed={p.id} src={p.avatarUrl} className="size-8" />
                        <span className="min-w-0">
                          <span className="block break-words">{displayName(p)}</span>
                          <span className="block text-xs text-muted-foreground">{p.employeeCode}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">{(p.departmentId && departments.get(p.departmentId)) || "ไม่มีแผนก"}</td>
                    {supervisor && canEdit && (
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" className="size-11" aria-label={`นำ ${displayName(p)} ออกจากทีม`} onClick={() => setRemoving(p)} disabled={busy}>
                          <UserMinus className="size-4" aria-hidden="true" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {supervisor && canEdit && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <MultiSelectField label="เพิ่มลูกทีม" placeholder="เลือกพนักงาน" options={options} selected={toAdd} onChange={setToAdd} />
            <Button onClick={() => setConfirmAdd(true)} disabled={toAdd.length === 0 || busy}>
              <UserPlus className="size-4" aria-hidden="true" /> เพิ่มเข้าทีม{toAdd.length > 0 ? ` (${toAdd.length})` : ""}
            </Button>
          </div>
        )}
        {!canEdit && <p className="text-sm text-muted-foreground">ดูได้อย่างเดียว การเปลี่ยนหัวหน้าทำได้เฉพาะ HR</p>}
      </section>

      <ConfirmDialog
        open={confirmAdd}
        onOpenChange={setConfirmAdd}
        title={`เพิ่ม ${moving.length} คนเข้าทีมของ ${supervisor ? displayName(supervisor) : ""}`}
        description={
          fromOthers > 0
            ? `${fromOthers} คนมีหัวหน้าอยู่แล้ว จะย้ายมาอยู่ใต้หัวหน้าคนนี้ และเปลี่ยนว่าใครอนุมัติคำขอและประเมินเขา`
            : "คนเหล่านี้ยังไม่มีหัวหน้า จะมีหัวหน้าคนนี้ และหัวหน้าจะเห็นและอนุมัติคำขอของเขา"
        }
        confirmLabel="เพิ่มเข้าทีม"
        loading={busy}
        onConfirm={async () => {
          if (!supervisor) return;
          const done = await apply(toAdd, supervisor.id);
          if (done) setToAdd([]);
          setConfirmAdd(false);
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? `นำ ${displayName(removing)} ออกจากทีม` : ""}
        description="เขาจะไม่มีหัวหน้า คำขอของเขาจะไปที่ HR และหัวหน้าเดิมจะไม่เห็นเขาอีก"
        confirmLabel="นำออกจากทีม"
        destructive
        loading={busy}
        onConfirm={async () => {
          if (!removing) return;
          await apply([removing.id], null);
          setRemoving(null);
        }}
      />
    </div>
  );
}
