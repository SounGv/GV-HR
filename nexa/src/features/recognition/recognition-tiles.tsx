"use client";

import { Award, Heart, Sparkle, Star } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useRecognitionSummary } from "./hooks";

// Four plain line icons in the one blue; the label says which is which.
const TILES = [
  { key: "star" as const, label: "Star", icon: Star },
  { key: "award" as const, label: "Award", icon: Award },
  { key: "heart" as const, label: "Heart", icon: Heart },
  { key: "point" as const, label: "Point", icon: Sparkle },
];

/** Recognition summary tiles — shows how many Star/Award/Heart/Point the current employee has received. */
export function RecognitionTiles() {
  const { user, can } = useAuth();
  const employeeId = user.employee?.id;
  const { data, isLoading } = useRecognitionSummary(can("recognition:read") ? employeeId : undefined);
  const summary = data?.data;

  if (!employeeId || !can("recognition:read")) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {TILES.map((t) => {
        const Icon = t.icon;
        const value = summary ? summary[t.key] : undefined;
        return (
          <div
            key={t.key}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">{t.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {isLoading ? "…" : (value ?? 0)}
              </span>
              <Icon className="size-5 text-primary" aria-hidden="true" />
            </span>
          </div>
        );
      })}
    </div>
  );
}
