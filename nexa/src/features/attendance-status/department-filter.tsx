"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DepartmentOption } from "./types";

const ALL = "ALL";

/**
 * One department filter for the whole attendance overview. The choice lives in
 * the URL (`?dept=<id>`), so a link keeps it and every card and list reads the
 * same value.
 */
export function DepartmentFilter({ departments, selected }: { departments: DepartmentOption[]; selected: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete("dept");
    else next.set("dept", value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground">แผนก</label>
      <Select value={selected ?? ALL} onValueChange={choose}>
        <SelectTrigger className="min-h-11 min-w-[200px] w-auto max-w-[320px]" aria-label="กรองตามแผนก">
          <SelectValue placeholder="ทุกแผนก" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value={ALL}>ทุกแผนก</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
