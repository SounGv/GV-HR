"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, User } from "lucide-react";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NAV_GROUPS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { fetchEmployees } from "@/features/employee/api";

type FlatNav = { label: string; href: string; group: string; icon: React.ElementType };

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Ctrl/⌘+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset the query whenever the palette closes.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // All navigable menu items the current user is allowed to see.
  const navItems = useMemo<FlatNav[]>(() => {
    const out: FlatNav[] = [];
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        if (item.ready !== false && can(item.permission)) {
          out.push({ label: item.label, href: item.href, group: g.label, icon: item.icon });
        }
      }
    }
    return out;
  }, [can]);

  const q = query.trim().toLowerCase();
  const filteredNav = q
    ? navItems.filter((n) => n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q))
    : navItems;

  // Employee lookup — only when the user can read employees and has typed enough.
  const employeeSearchEnabled = open && can("employee:read") && q.length >= 2;
  const { data: empData, isFetching } = useQuery({
    queryKey: ["command-palette", "employees", query.trim()],
    queryFn: () => fetchEmployees({ search: query.trim(), pageSize: 6, page: 1 }),
    enabled: employeeSearchEnabled,
    staleTime: 30_000,
  });
  const employees = employeeSearchEnabled ? (empData?.data ?? []) : [];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // On the reports page, picking an employee should search *within* the
  // report you're already looking at (apply it as the report's own
  // employee filter) instead of navigating you away to their profile —
  // ReportView reads this same "employeeId" param on mount, mirroring how
  // it already reads "view" for deep-linked report types.
  const goToEmployee = (id: string) => {
    setOpen(false);
    if (pathname?.startsWith("/reports")) {
      router.push(`/reports?employeeId=${id}`);
    } else {
      router.push(`/employees/${id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Single trigger element, always mounted (never display:none) so the
       * popover has a real anchor at every breakpoint — its visible content
       * just reflows responsively instead of swapping between two buttons. */}
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="ค้นหา"
            className="flex h-9 w-9 items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-0 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-muted/60 md:w-full md:max-w-md md:justify-start md:px-3"
          />
        }
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left md:inline">ค้นหาเมนู, พนักงาน, รายงาน…</span>
        <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
          Ctrl K
        </kbd>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[min(440px,calc(100vw-2rem))] max-h-[70vh] overflow-hidden p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="ค้นหาเมนู, พนักงาน…" value={query} onValueChange={setQuery} autoFocus />
          <CommandList>
            {filteredNav.length === 0 && employees.length === 0 && (
              <CommandEmpty>{isFetching ? "กำลังค้นหา…" : "ไม่พบผลลัพธ์"}</CommandEmpty>
            )}

            {filteredNav.length > 0 && (
              <CommandGroup heading="เมนู">
                {filteredNav.slice(0, 8).map((n) => (
                  <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                    <n.icon className="text-muted-foreground" />
                    <span>{n.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{n.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {employees.length > 0 && (
              <CommandGroup heading="พนักงาน">
                {employees.map((e) => (
                  <CommandItem key={e.id} value={`emp-${e.id}`} onSelect={() => goToEmployee(e.id)}>
                    <User className="text-muted-foreground" />
                    <span>
                      {e.firstName} {e.lastName}
                      <span className="ml-1.5 text-xs text-muted-foreground">{e.employeeCode}</span>
                    </span>
                    {e.department?.name && (
                      <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">
                        {e.department.name}
                      </span>
                    )}
                    <ArrowRight className="ml-2 size-3.5 text-muted-foreground opacity-0 group-data-selected/command-item:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
