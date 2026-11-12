// Checks which permissions a role really grants (system roles follow their preset), with made-up rows only.
// Run: node --experimental-strip-types scripts/check-role-permissions.mjs
import assert from "node:assert/strict";
import { ALL_PERMISSION_KEYS, rolePermissionKeys } from "../src/config/permissions.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const rows = (...keys) => keys.map((key) => ({ permission: { key } }));

check("Super Admin set up before the 'manage' permissions existed still gets them", () => {
  const keys = rolePermissionKeys({
    name: "Super Admin",
    isSystem: true,
    permissions: rows("leave:read", "leave:approve"),
  });
  for (const k of ["leave:manage", "overtime:manage", "attendance:manage"])
    assert.ok(keys.includes(k), k);
  assert.equal(new Set(keys).size, ALL_PERMISSION_KEYS.length);
});
check("HR Manager gets its module wildcards topped up (leave:* covers leave:manage)", () => {
  const keys = rolePermissionKeys({
    name: "HR Manager",
    isSystem: true,
    permissions: rows("leave:read"),
  });
  assert.ok(keys.includes("leave:manage"));
  assert.ok(!keys.includes("admin:update"), "HR Manager has no admin rights in its preset");
});
check("a custom role grants exactly its rows, even if named like a system role", () => {
  const keys = rolePermissionKeys({
    name: "Super Admin",
    isSystem: false,
    permissions: rows("leave:read"),
  });
  assert.deepEqual(keys, ["leave:read"]);
});
check("a system role with no preset keeps its rows", () => {
  const keys = rolePermissionKeys({
    name: "Something Else",
    isSystem: true,
    permissions: rows("kpi:read"),
  });
  assert.deepEqual(keys, ["kpi:read"]);
});
check("rows outside the preset are never taken away", () => {
  const keys = rolePermissionKeys({
    name: "Employee",
    isSystem: true,
    permissions: rows("report:export"),
  });
  assert.ok(keys.includes("report:export"));
});

console.log(`\n${n} checks passed`);
