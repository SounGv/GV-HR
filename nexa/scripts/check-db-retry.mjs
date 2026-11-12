// Checks which failed database queries are run a second time.
// Run: node --experimental-strip-types scripts/check-db-retry.mjs
import assert from "node:assert/strict";
import { shouldRetryRead } from "../src/lib/db-retry.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const closed = Object.assign(new Error("Server has closed the connection."), { code: "P1017" });

check("a read on a closed connection is run again", () => {
  for (const op of [
    "findMany",
    "findFirst",
    "findUnique",
    "findUniqueOrThrow",
    "count",
    "aggregate",
    "groupBy",
  ]) {
    assert.equal(shouldRetryRead(op, closed), true, op);
  }
});
check("a write on a closed connection is not (it may already be saved)", () => {
  for (const op of [
    "create",
    "update",
    "upsert",
    "delete",
    "createMany",
    "updateMany",
    "deleteMany",
    "$executeRaw",
  ]) {
    assert.equal(shouldRetryRead(op, closed), false, op);
  }
});
check("other errors are not retried", () => {
  assert.equal(
    shouldRetryRead("findMany", Object.assign(new Error("unique"), { code: "P2002" })),
    false,
  );
  assert.equal(
    shouldRetryRead("findMany", Object.assign(new Error("timeout"), { code: "P2024" })),
    false,
  );
  assert.equal(shouldRetryRead("findMany", new Error("no code")), false);
  assert.equal(shouldRetryRead("findMany", null), false);
  assert.equal(shouldRetryRead("findMany", "P1017"), false);
});
console.log(`\n${n} checks passed`);
