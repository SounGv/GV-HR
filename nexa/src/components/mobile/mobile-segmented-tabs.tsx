"use client";



import { arrowSelect } from "@/lib/arrow-select";

import { cn } from "@/lib/utils";



export function MobileSegmentedTabs<T extends string>({

  value,

  onChange,

  options,

  className,

  variant = "default",

}: {

  value: T;

  onChange: (value: T) => void;

  options: { value: T; label: string }[];

  className?: string;

  variant?: "default" | "onPrimary";

}) {

  const onPrimary = variant === "onPrimary";



  return (

    <div

      className={cn(

        "flex gap-1 rounded-lg p-1",

        onPrimary ? "bg-white/15" : "bg-surface-muted",

        className,

      )}

      role="tablist"

      onKeyDown={arrowSelect}

    >

      {options.map((opt, i) => {

        const active = value === opt.value;

        return (

          <button

            key={opt.value}

            type="button"

            role="tab"

            aria-selected={active}

            tabIndex={active || (i === 0 && !options.some((o) => o.value === value)) ? 0 : -1}

            onClick={() => onChange(opt.value)}

            className={cn(

              "flex-1 rounded-lg py-2 text-sm font-semibold transition active:scale-[0.99]",

              onPrimary

                ? active

                  ? "bg-card text-primary shadow-sm"

                  : "text-primary-foreground/85"

                : active

                  ? "bg-card text-primary shadow-sm"

                  : "text-muted-foreground",

            )}

          >

            {opt.label}

          </button>

        );

      })}

    </div>

  );

}



export function MobileFilterChip({

  label,

  active,

  onClick,

}: {

  label: string;

  active?: boolean;

  onClick?: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={cn(

        "rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95",

        active

          ? "border-primary bg-primary text-primary-foreground"

          : "border-border bg-card text-muted-foreground",

      )}

    >

      {label}

    </button>

  );

}


