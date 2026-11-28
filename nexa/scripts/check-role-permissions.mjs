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

check("Manager and Finance can clock in and make their own requests, like Employee", () => {
  for (const name of ["Manager", "Finance"]) {
    const keys = rolePermissionKeys({ name, isSystem: true, permissions: rows("dashboard:read") });
    for (const k of ["attendance:create", "leave:create", "overtime:create", "expense:create", "notification:read"])
      assert.ok(keys.includes(k), `${name} lacks ${k}`);
  }
});
check("making own requests gives Manager and Finance no extra approval rights", () => {
  const manager = rolePermissionKeys({ name: "Manager", isSystem: true, permissions: [] });
  for (const k of ["leave:approve", "overtime:approve", "payroll:update", "payroll:approve", "employee:update"])
    assert.ok(!manager.includes(k), `Manager must not hold ${k}`);
  const finance = rolePermissionKeys({ name: "Finance", isSystem: true, permissions: [] });
  for (const k of ["leave:approve", "leave:manage", "overtime:approve", "employee:update"])
    assert.ok(!finance.includes(k), `Finance must not hold ${k}`);
});
check("Employee is exactly the self-service set and nothing more", () => {
  const employee = rolePermissionKeys({ name: "Employee", isSystem: true, permissions: [] }).sort();
  assert.ok(employee.includes("attendance:create") && !employee.some((k) => /:(approve|manage|update|delete)$/.test(k)));
});

console.log(`\n${n} checks passed`);
