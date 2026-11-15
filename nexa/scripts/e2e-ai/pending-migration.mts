/* eslint-disable @typescript-eslint/no-explicit-any -- the transaction client is passed in by the tests */
import fs from "node:fs";
import path from "node:path";

/**
 * The appraisal adjustment and recurring-round migration may not be on the live database yet, while the generated client already
 * expects its columns. Inside a test's transaction (rolled back at the end) this runs the migration file when it is missing, so the
 * tests work before and after the real migration, and the live database is never changed by a test. Returns true when it applied it.
 */
export async function applyPendingMigration(tx: any): Promise<boolean> {
  const hasColumn = (await tx.$queryRawUnsafe("select 1 from information_schema.columns where table_name = 'appraisal_participants' and column_name = 'adjustedAt'")).length > 0;
  const hasTable = (await tx.$queryRawUnsafe("select 1 from information_schema.tables where table_name = 'appraisal_recurrences'")).length > 0;
  if (hasColumn && hasTable) return false;
  if (hasColumn !== hasTable) throw new Error("the live database has only part of the appraisal adjust-and-recurring migration; check it by hand");
  const dir = path.resolve(process.cwd(), "prisma/migrations");
  const folder = fs.readdirSync(dir).find((d) => d.endsWith("_appraisal_adjust_and_recurring"));
  if (!folder) throw new Error("the appraisal_adjust_and_recurring migration folder is missing");
  const sql = fs.readFileSync(path.join(dir, folder, "migration.sql"), "utf8");
  const statements = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (statements.length < 12) throw new Error(`unexpected migration shape: ${statements.length} statements`);
  for (const s of statements) await tx.$executeRawUnsafe(s);
  return true;
}
