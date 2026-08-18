"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HELP_GUIDES } from "./guides-data";
import { StepIllustration } from "./step-illustration";

/**
 * "5-second" HR guide: a grid of guide cards (icon + title + one-liner —
 * meant to be understood before anyone even opens one), each expanding
 * in place into a numbered step list with a small schematic illustration
 * per step. Single-open accordion so the page never turns into one long
 * scroll of every guide's steps at once.
 */
export function HelpView() {
  const [openId, setOpenId] = useState<string | null>(HELP_GUIDES[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {HELP_GUIDES.map((guide) => {
        const open = openId === guide.id;
        return (
          <Card key={guide.id} className={cn("transition-shadow", open && "shadow-sm ring-1 ring-primary/20")}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : guide.id)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
              aria-expanded={open}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <guide.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-semibold text-foreground">{guide.title}</p>
                <p className="truncate text-sm text-muted-foreground">{guide.summary}</p>
              </div>
              <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <CardContent className="space-y-4 border-t border-border pt-4">
                <ol className="space-y-4">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_220px] sm:items-center">
                      <div className="flex items-center gap-2.5 sm:items-start">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {i + 1}
                        </span>
                      </div>
                      <div className="min-w-0 sm:pt-0.5">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <step.icon className="size-4 shrink-0 text-primary" />
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                      <StepIllustration
                        kind={step.illustration}
                        icon={step.icon}
                        label={step.illustrationLabel}
                        chips={step.illustrationChips}
                      />
                    </li>
                  ))}
                </ol>
                <Link
                  href={guide.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  ไปที่หน้านี้ <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
