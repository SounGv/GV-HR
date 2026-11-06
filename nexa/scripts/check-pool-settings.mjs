// Checks the database URL settings that stop P2024 pool timeouts.
// Run: node --experimental-strip-types scripts/check-pool-settings.mjs
import assert from "node:assert/strict";
import { POOL_CONNECTIONS, POOL_TIMEOUT_SECONDS, withPoolSettings } from "../src/lib/pool-settings.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const pooled = "postgresql://u:p%40ss@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

check("the pooler URL gets more connections and a longer wait", () => {
  const u = new URL(withPoolSettings(pooled));
  assert.equal(u.searchParams.get("connection_limit"), String(POOL_CONNECTIONS));
  assert.equal(u.searchParams.get("pool_timeout"), String(POOL_TIMEOUT_SECONDS));
});
check("other settings, the password and the host are kept", () => {
  const u = new URL(withPoolSettings(pooled));
  assert.equal(u.searchParams.get("pgbouncer"), "true");
  assert.equal(u.password, "p%40ss");
  assert.equal(u.host, "aws-0-ap-southeast-1.pooler.supabase.com:6543");
});
check("a higher value already set is not lowered", () => {
  const u = new URL(withPoolSettings(pooled.replace("connection_limit=1", "connection_limit=10&pool_timeout=60")));
  assert.equal(u.searchParams.get("connection_limit"), "10");
  assert.equal(u.searchParams.get("pool_timeout"), "60");
});
check("a direct connection (5432) and a local database are left alone", () => {
  const direct = "postgresql://u:p@host:5432/postgres";
  assert.equal(withPoolSettings(direct), direct);
  assert.equal(withPoolSettings("postgresql://u:p@localhost/db"), "postgresql://u:p@localhost/db");
});
check("missing or unreadable values come back unchanged", () => {
  assert.equal(withPoolSettings(undefined), undefined);
  assert.equal(withPoolSettings("not a url"), "not a url");
});

console.log(`\n${n} checks passed`);
