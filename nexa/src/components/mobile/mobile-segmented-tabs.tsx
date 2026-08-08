"use client";

import { cn } from "@/lib/utils";

export interface MobileSegmentedTab {
  value: string;
  label: string;
}

export interface MobileSegmentedTabsProps {
  tabs: MobileSegmentedTab[];
  value: string;
  onChange: (value: string) => void;
  variant?: "default" | "onPrimary";
  className?: string;
}

export function MobileSegmentedTabs({
  tabs,
  value,
  onChange,
  variant = "default",
  className,
}: MobileSegmentedTabsProps) {
  const onPrimary = variant === "onPrimary";

  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-xl p-1",
        onPrimary ? "bg-white/15" : "bg-card border border-border",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              onPrimary
                ? active
                  ? "bg-white text-primary shadow-sm"
                  : "text-primary-foreground/80"
                : active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export interface MobileFilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MobileFilterChip({ label, active, onClick, className }: MobileFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition active:scale-95",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}
