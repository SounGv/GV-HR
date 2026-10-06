"use client";

import { useState } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/** Checkbox-dropdown filter (report-view.tsx's พนักงาน/สาขา/ศูนย์ต้นทุน
 * pickers) — picking several ids means "match any of these" (an `in` filter
 * server-side), unlike the single-select Select component elsewhere in the
 * app. Built on DropdownMenuCheckboxItem rather than the Select primitive:
 * Base UI's Select does technically support a `multiple` mode, but Select's
 * own trigger/value/item styling across the rest of the app assumes a single
 * scalar value, so reusing it here would mean special-casing every one of
 * those for an array — a parallel, purpose-built component is less invasive
 * than teaching the shared Select two different value shapes. */
export function MultiSelectField({
  label,
  placeholder,
  options,
  selected,
  onChange,
  searchThreshold = 8,
  className,
}: {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchThreshold?: number;
  /** Extra classes for the whole field (e.g. `w-full` on phones). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const showSearch = options.length > searchThreshold;
  const q = query.trim().toLowerCase();
  const filtered = showSearch && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
        : `เลือกแล้ว ${selected.length} รายการ`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn("flex h-8 w-auto min-w-[160px] max-w-[320px] items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", className && "h-11 w-full max-w-none min-w-0")}
            />
          }
        >
          <span className="flex-1 truncate text-left" data-placeholder={selected.length === 0 ? "" : undefined}>
            {triggerLabel}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-(--anchor-width) min-w-[240px] overflow-y-auto p-0">
          {showSearch && (
            <div className="sticky top-0 z-10 border-b border-border bg-popover p-1.5">
              <InputGroup className="h-8 rounded-md border-input/60">
                <InputGroupAddon>
                  <SearchIcon className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="ค้นหา…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key !== "Escape") e.stopPropagation();
                  }}
                  className="text-sm"
                />
              </InputGroup>
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
              เลือกทั้งหมด
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" className="text-primary hover:underline" onClick={() => onChange([])}>
              ล้างทั้งหมด
            </button>
          </div>
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">ไม่พบผลลัพธ์</p>
            ) : (
              filtered.map((o) => (
                <DropdownMenuCheckboxItem key={o.value} checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)}>
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
