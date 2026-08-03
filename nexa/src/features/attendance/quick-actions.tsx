"use client";

import Link from "next/link";
import { Timer, CalendarDays, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

interface Action {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

const ACTIONS: Action[] = [
  { label: "ขอ OT", href: "/overtime", icon: Timer, permission: "overtime:read" },
  { label: "ขอลา", href: "/leave", icon: CalendarDays, permission: "leave:read" },
  { label: "เบิกจ่าย", href: "/expenses", icon: ReceiptText, permission: "expense:read" },
  { label: "เงินเดือน", href: "/payroll", icon: Wallet, permission: "payroll:read" },
];

/** Contextual shortcuts under the clock card — makes OT/leave reachable in one tap. */
export function AttendanceQuickActions() {
  const { can } = useAuth();
  const actions = ACTIONS.filter((a) => can(a.permission));
  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-4 transition hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <a.icon className="size-5 text-primary" />
          </span>
          <span className="text-sm font-medium text-foreground">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
