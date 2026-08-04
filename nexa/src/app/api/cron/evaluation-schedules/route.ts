import { type NextRequest, NextResponse } from "next/server";
import { runDueSchedules } from "@/features/evaluation-schedule/generate";

export const runtime = "nodejs";

/**
 * Triggered by Vercel Cron (see `vercel.json`). Vercel automatically attaches
 * `Authorization: Bearer <CRON_SECRET>` to its own invocations once that env
 * var is set in the project — no other configuration needed on their end.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runDueSchedules();
  return NextResponse.json(summary);
}
