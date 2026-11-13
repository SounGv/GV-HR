import { AlertCircle, Inbox, Lock, RefreshCw, UserRoundX, type LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Empty state — no data yet. */
export function EmptyState({
  icon: Icon = Inbox,
  title = "ยังไม่มีข้อมูล",
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Why a request failed, as far as the page needs to know (audit B2, 13 Nov 2026). */
export type FailureKind = "no-employee" | "forbidden" | "server" | "network";

export function failureKind(error: unknown): FailureKind {
  if (error instanceof ApiError) {
    if (error.code === "NO_EMPLOYEE") return "no-employee";
    if (error.status === 403) return "forbidden";
    return "server";
  }
  return "network";
}

/** The account is not linked to an employee record, so it has nothing of its own here. */
export function NoEmployeeState({ description, action, className }: { description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <EmptyState
      icon={UserRoundX}
      title="บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน"
      description={description ?? "จึงไม่มีรายการของตัวเองในหน้านี้ ถ้าต้องใช้ ให้ HR ผูกบัญชีกับข้อมูลพนักงานก่อน"}
      action={action}
      className={className}
    />
  );
}

/**
 * Error state. Pass `error` (the query's error) and it tells apart: no employee
 * record (neutral), no permission (blue), and a real failure (red; the network
 * line is only shown when nothing came back). Without `error` it behaves as before.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  error,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  error?: unknown;
  className?: string;
}) {
  const kind = error === undefined ? "network" : failureKind(error);
  if (kind === "no-employee") return <NoEmployeeState description={description} className={className} />;
  if (kind === "forbidden") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-info/30 bg-info/5 px-6 py-14 text-center", className)}>
        <div className="flex size-12 items-center justify-center rounded-full bg-info/10 text-info">
          <Lock className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title ?? "บัญชีนี้ยังไม่มีสิทธิ์ดูหน้านี้"}</p>
          <p className="text-sm text-muted-foreground">ถ้าต้องใช้งาน ขอสิทธิ์จาก HR หรือผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }
  const server = kind === "server";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title ?? (server ? "ระบบขัดข้อง โหลดข้อมูลไม่สำเร็จ" : "โหลดข้อมูลไม่สำเร็จ")}</p>
        <p className="text-sm text-muted-foreground">
          {description ??
            (server
              ? "กด ลองใหม่ ถ้ายังไม่ได้ แจ้ง HR"
              : onRetry
                ? "ตรวจสัญญาณอินเทอร์เน็ต แล้วกด ลองใหม่ ถ้ายังไม่ได้ แจ้ง HR"
                : "ตรวจสัญญาณอินเทอร์เน็ต แล้วเปิดหน้านี้ใหม่ ถ้ายังไม่ได้ แจ้ง HR")}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" />
          ลองใหม่
        </Button>
      )}
      {server && error instanceof ApiError && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">รายละเอียดสำหรับผู้ดูแลระบบ</summary>
          <code>{error.status} · {error.code}</code>
        </details>
      )}
    </div>
  );
}

/** Loading skeleton for table-like content. */
export function TableLoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
