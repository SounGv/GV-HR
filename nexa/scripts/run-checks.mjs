// Runs every scripts/check-*.mjs one after another and exits non-zero when any fails.
// None of them touch the database or the network, so it is safe on a laptop and in CI.
// Run: node scripts/run-checks.mjs   (or: npm run check:all)
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
const failed = [];

for (const file of files) {
  const run = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(dir, file)], { encoding: "utf8" });
  if (run.status === 0) {
    console.log(`ok    ${file}`);
  } else {
    failed.push(file);
    console.log(`FAIL  ${file}\n${(run.stdout + run.stderr).split("\n").slice(-12).join("\n")}`);
  }
}

console.log(`\n${files.length - failed.length}/${files.length} check scripts passed`);
if (failed.length) {
  console.log(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}
