"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgOptions } from "@/features/employee/hooks";

type Mode = "company" | "department" | "team" | "manual";

const MODE_LABEL: Record<Mode, string> = {
  company: "ทั้งบริษัท",
  department: "ตามฝ่าย/แผนก",
  team: "ตามทีม (ลูกทีมของหัวหน้างานคนหนึ่ง)",
  manual: "เลือกเป็นรายคน",
};

/** Step 2 — resolve which employees become participants, by whole company,
 * department, one manager's team, or manual multi-select. Reuses the same
 * org-options data already used for rater invites, no new endpoint. */
export function PeopleStep({
  selectedIds,
  onChange,
}: {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const { data: orgData } = useOrgOptions();
  const employees = useMemo(() => orgData?.data.managers ?? [], [orgData]);
  const departments = orgData?.data.departments ?? [];

  const [mode, setMode] = useState<Mode>("company");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (mode === "department") return employees.filter((e) => e.departmentId === departmentId);
    if (mode === "team") return employees.filter((e) => e.managerId === managerId);
    return employees;
  }, [employees, mode, departmentId, managerId]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (e) => `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(q),
    );
  }, [filtered, search]);

  function selectAll() {
    onChange(new Set(searched.map((e) => e.id)));
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={mode === m ? "default" : "outline"}
            onClick={() => {
              setMode(m);
              onChange(new Set());
            }}
          >
            {MODE_LABEL[m]}
          </Button>
        ))}
      </div>

      {mode === "department" && (
        <Select
          value={departmentId}
          onValueChange={(v) => {
            setDepartmentId(v ?? "");
            onChange(new Set());
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="เลือกฝ่าย/แผนก" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "team" && (
        <Select
          value={managerId}
          onValueChange={(v) => {
            setManagerId(v ?? "");
            onChange(new Set());
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="เลือกหัวหน้างาน" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.firstName} {e.lastName} ({e.employeeCode})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "company" && (
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          เลือกทุกคน ({employees.length} คน)
        </Button>
      )}

      {(mode === "department" || mode === "team") && searched.length > 0 && (
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          เลือกทั้งกลุ่มนี้ ({searched.length} คน)
        </Button>
      )}

      {mode === "manual" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
        {searched.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">ไม่พบพนักงานในเงื่อนไขนี้</p>
        ) : (
          searched.map((e) => (
            <label
              key={e.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                checked={selectedIds.has(e.id)}
                onChange={() => toggle(e.id)}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {e.firstName} {e.lastName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{e.employeeCode}</span>
            </label>
          ))
        )}
      </div>

      <p className="text-sm font-medium text-foreground">เลือกแล้ว {selectedIds.size} คน</p>
    </div>
  );
}
