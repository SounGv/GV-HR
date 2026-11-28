import { type NextRequest, NextResponse } from "next/server";
import { runDueSchedules } from "@/features/evaluation-schedule/generate";
import { constantTimeEqual } from "@/lib/auth/bearer-token";

export const runtime = "nodejs";
// A run walks many people one at a time (database writes and LINE pushes), so give it a full minute.
export const maxDuration = 60;

/**
 * Triggered by Vercel Cron (see `vercel.json`). Vercel automatically attaches
 * `Authorization: Bearer <CRON_SECRET>` to its own invocations once that env
 * var is set in the project — no other configuration needed on their end.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || !auth || !constantTimeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDueSchedules();
  return NextResponse.json(summary);
}
