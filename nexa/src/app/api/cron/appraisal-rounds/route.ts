import { type NextRequest, NextResponse } from "next/server";
import { runRoundJobs } from "@/features/appraisal-round/service";
import { constantTimeEqual } from "@/lib/auth/bearer-token";

export const runtime = "nodejs";

/**
 * Triggered by Vercel Cron (see `vercel.json`): sends the invitations of rounds whose start day
 * has come and reminds people who have not submitted when a round is about to close.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || !auth || !constantTimeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runRoundJobs());
}
