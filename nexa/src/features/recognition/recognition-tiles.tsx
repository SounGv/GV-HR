"use client";

import { Award, Heart, Sparkle } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { StarIllustrationIcon } from "@/components/shared/illustrated-icons";
import { useRecognitionSummary } from "./hooks";

// Star gets the full illustrated icon; Award/Heart/Point each get their own
// color for now (a matching illustrated icon for those is a follow-up, per
// gv-hr-menu-icons.md) — no two of the four share the same color anymore.
const TILES = [
  { key: "star" as const, label: "Star", icon: StarIllustrationIcon, color: undefined },
  { key: "award" as const, label: "Award", icon: Award, color: "#F5A524" },
  { key: "heart" as const, label: "Heart", icon: Heart, color: "#E5484D" },
  { key: "point" as const, label: "Point", icon: Sparkle, color: "#6366F1" },
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
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">{t.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {isLoading ? "…" : (value ?? 0)}
              </span>
              {t.key === "star" ? <Icon size={22} /> : <Icon className="size-5" style={{ color: t.color }} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
