import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { avatarPathFromParts } from "@/lib/avatar";

/**
 * Photo address for each employee id that has one, without reading the photos themselves.
 * A stored photo is a data URL of about 200 KB, so asking the database for it just to build a
 * short address would move megabytes for a list of people. This asks for the length and the last
 * 12 characters only (what avatarSrc uses for its version), and returns the same address.
 * A normal link stored in the column is returned as it is; people with no photo are left out.
 *
 * @param ids Employee ids (duplicates and empty values are ignored).
 */
export async function avatarPaths(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  const CHUNK = 500;
  // Sequential on purpose: the pooled connection serves one query at a time.
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK);
    const rows = await prisma.$queryRaw<{ id: string; link: string | null; len: number | null; tail: string | null }[]>(Prisma.sql`
      SELECT "id",
             CASE WHEN "avatarUrl" LIKE 'data:%' THEN NULL ELSE "avatarUrl" END AS link,
             CASE WHEN "avatarUrl" LIKE 'data:%' THEN length("avatarUrl") END AS len,
             CASE WHEN "avatarUrl" LIKE 'data:%' THEN right("avatarUrl", 12) END AS tail
      FROM "employees"
      WHERE "id" IN (${Prisma.join(part)}) AND "avatarUrl" IS NOT NULL AND "avatarUrl" <> ''`);
    for (const r of rows) {
      if (r.link) out.set(r.id, r.link);
      else if (r.len != null && r.tail != null) out.set(r.id, avatarPathFromParts(r.id, Number(r.len), r.tail));
    }
  }
  return out;
}
