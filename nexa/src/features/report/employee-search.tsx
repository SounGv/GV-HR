"use client";

import { useId, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { MultiSelectOption } from "@/components/shared/multi-select-field";

const MAX_SUGGESTIONS = 8;

/**
 * A search box that is always visible on the Reports page: type part of a name, nickname or employee code, pick the
 * person from the list and the report narrows to them (picked people show as chips with an x). It writes to the same
 * list as the "พนักงาน" filter, so the table, the export and the filter count all follow.
 *
 * `options` are labelled "name · code", so one substring match covers name, nickname and code, case-insensitive.
 */
export function EmployeeSearch({
  options,
  selected,
  onChange,
  hasOtherFilters,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** True when another filter is already narrowing the list, so "not found" can say why. */
  hasOtherFilters: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => !selected.includes(o.value) && o.label.toLowerCase().includes(q)) : [];
  const shown = matches.slice(0, MAX_SUGGESTIONS);
  const chips = selected.map((id) => options.find((o) => o.value === id)).filter((o): o is MultiSelectOption => !!o);

  function pick(value: string) {
    onChange([...selected, value]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="space-y-1">
      <label htmlFor={`${listId}-input`} className="text-sm text-muted-foreground">
        ค้นหาพนักงาน
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={open && q !== ""}
            aria-controls={listId}
            autoComplete="off"
            placeholder="พิมพ์ชื่อ ชื่อเล่น หรือรหัส"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown[0]) {
                e.preventDefault();
                pick(shown[0].value);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="w-[260px] pl-8"
          />
          {open && q !== "" && (
            <ul
              id={listId}
              role="listbox"
              className="absolute top-full left-0 z-30 mt-1 max-h-72 w-full min-w-[260px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
            >
              {shown.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  {hasOtherFilters ? "ไม่พบคนที่ตรงกับตัวกรองที่เลือกไว้ ลองล้างตัวกรองอื่น" : "ไม่พบพนักงานที่ตรงกับคำค้น"}
                </li>
              ) : (
                shown.map((o) => (
                  <li key={o.value} role="option" aria-selected={false}>
                    {/* mousedown (not click) with preventDefault keeps the input focused, so the list does not close before the pick lands */}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(o.value);
                      }}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm break-words hover:bg-accent"
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
              {matches.length > shown.length && (
                <li className="px-3 py-2 text-xs text-muted-foreground">แสดง {shown.length} จาก {matches.length} คน พิมพ์เพิ่มเพื่อให้แคบลง</li>
              )}
            </ul>
          )}
        </div>
        {chips.map((o) => (
          <span key={o.value} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-card py-0.5 pr-1 pl-3 text-sm">
            {o.label}
            <button
              type="button"
              aria-label={`เอา ${o.label} ออก`}
              onClick={() => onChange(selected.filter((v) => v !== o.value))}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
