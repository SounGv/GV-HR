/* eslint-disable @typescript-eslint/no-explicit-any -- the transaction client is passed in by the tests */
import fs from "node:fs";
import path from "node:path";

/**
 * The rater-pairs migration (a nullable JSON column on appraisal_rounds) may not be on the live database yet while the generated
 * client already expects it. Inside a test's transaction (rolled back at the end) this adds the column when it is missing, so the
 * tests work before and after the real migration, and the live database is never changed by a test. Returns true when it added it.
 */
export async function applyPendingRaterPairs(tx: any): Promise<boolean> {
  const has = (await tx.$queryRawUnsafe("select 1 from information_schema.columns where table_name = 'appraisal_rounds' and column_name = 'raterPairs'")).length > 0;
  if (has) return false;
  const dir = path.resolve(process.cwd(), "prisma/migrations");
  const folder = fs.readdirSync(dir).find((d) => d.endsWith("_appraisal_round_rater_pairs"));
  if (!folder) throw new Error("the appraisal_round_rater_pairs migration folder is missing");
  const sql = fs
    .readFileSync(path.join(dir, folder, "migration.sql"), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim();
  if (!/^ALTER TABLE "appraisal_rounds" ADD COLUMN\s+"raterPairs" JSONB;?$/.test(sql)) throw new Error(`unexpected migration shape: ${sql}`);
  await tx.$executeRawUnsafe(sql.replace(/;$/, ""));
  return true;
}
