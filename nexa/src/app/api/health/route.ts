import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// TEMP diagnostic — remove after login works.
function shape(url: string | undefined) {
  if (!url) return "(missing)";
  // reveal structure + password LENGTH only (not the value)
  const m = url.match(/:\/\/([^:]+):([^@]+)@([^/]+)/);
  if (!m) return "(unparseable)";
  return { user: m[1], passwordLen: m[2].length, hostPort: m[3], hasPct26: m[2].includes("%26"), hasRawAmp: m[2].includes("&") };
}

export async function GET() {
  const out: Record<string, unknown> = {
    DATABASE_URL: shape(process.env.DATABASE_URL),
    DIRECT_URL: shape(process.env.DIRECT_URL),
  };
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    out.query = "OK";
  } catch (e) {
    out.query = "FAILED";
    out.error = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e);
  }
  out.ms = Date.now() - t;
  return Response.json(out);
}
