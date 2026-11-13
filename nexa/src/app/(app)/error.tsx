"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for the authenticated app. Surfaces the real error
 * message + digest on screen (instead of the generic host message) so failures
 * are diagnosable in production without opening dev tools.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Also log to the console for anyone who does open dev tools.
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">เปิดหน้านี้ไม่ได้</h1>
        <p className="text-sm text-muted-foreground">
          กด ลองใหม่ ถ้ายังไม่ได้ ถ่ายรูปหน้าจอนี้ (กดเปิดรายละเอียดด้านล่างก่อน) ส่งให้ HR
        </p>
      </div>

      {/* Kept for debugging crashes that only happen on the live site; folded away for staff. */}
      <details className="max-w-full text-left">
        <summary className="cursor-pointer text-sm text-muted-foreground">รายละเอียดสำหรับผู้ดูแลระบบ</summary>
        <pre className="mt-2 max-w-full overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-left text-xs text-destructive">
          {error?.name ? `${error.name}: ` : ""}
          {error?.message || "Unknown error"}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        {error?.stack && (
          <pre className="mt-2 max-h-64 max-w-full overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-[11px] text-muted-foreground">
            {error.stack}
          </pre>
        )}
      </details>

      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        ลองใหม่
      </button>
    </div>
  );
}
