/* eslint-disable @typescript-eslint/no-explicit-any -- the transaction client is passed in by the tests */
import fs from "node:fs";
import path from "node:path";

/**
 * The score adjustment migration may not be on the live database yet, while the generated client already expects its columns.
 * Inside a test's transaction (rolled back at the end) this runs the migration file when the column is missing, so the tests
 * work before and after the real migration, and the live database is never changed by a test. Returns true when it applied it.
 */
export async function applyPendingMigration(tx: any): Promise<boolean> {
  const has = await tx.$queryRawUnsafe("select 1 from information_schema.columns where table_name = 'appraisal_participants' and column_name = 'adjustedAt'");
  if (has.length > 0) return false;
  const dir = path.resolve(process.cwd(), "prisma/migrations");
  const folder = fs.readdirSync(dir).find((d) => d.endsWith("_appraisal_score_adjustments"));
  if (!folder) throw new Error("the appraisal_score_adjustments migration folder is missing");
  const sql = fs.readFileSync(path.join(dir, folder, "migration.sql"), "utf8");
  const statements = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (statements.length < 5) throw new Error(`unexpected migration shape: ${statements.length} statements`);
  for (const s of statements) await tx.$executeRawUnsafe(s);
  return true;
}
