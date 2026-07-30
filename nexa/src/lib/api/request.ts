import type { NextRequest } from "next/server";

/** Best-effort client IP + user agent from proxy headers. */
export function getRequestMeta(req: NextRequest): { ip?: string; userAgent?: string } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ip, userAgent };
}
