import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// TEMPORARY diagnostic — remove after fixing Vercel DB connectivity.
function mask(url: string | undefined) {
  if (!url) return "(missing)";
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");
}

export async function GET() {
  const out: Record<string, unknown> = {
    DATABASE_URL: mask(process.env.DATABASE_URL),
    DIRECT_URL: mask(process.env.DIRECT_URL),
    node: process.version,
  };
  const t = Date.now();
  try {
    const r = await prisma.$queryRaw`SELECT 1 as ok`;
    out.query = "OK";
    out.result = r;
  } catch (e) {
    out.query = "FAILED";
    out.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  out.ms = Date.now() - t;
  return Response.json(out);
}
