// Audit B1 closing check (13 Nov 2026): an account with no employee record must get
// empty "my" lists, never BAD_REQUEST / FORBIDDEN. Read-only; runs against the DB in .env.
//   node --env-file=.env node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/check-no-employee.ts
import { listAttendanceCorrections } from "@/features/attendance-correction/service";
import { listRequests } from "@/features/workflow/service";
import { listExpenses } from "@/features/expense/service";
import { listLoans } from "@/features/company-loan/service";
import { listPayroll } from "@/features/payroll/service";
import { listMeetings } from "@/features/meeting/service";
import { listMyEnrollments } from "@/features/training/service";
import { listMyAssignments as listMyAppraisalTasks } from "@/features/appraisal-round/service";
import { listMyResults } from "@/features/appraisal-round/results-service";
import { getMyProfile } from "@/features/profile/service";
import { AppError } from "@/lib/api/errors";

const companyId = "00000000-0000-0000-0000-000000000001";
const s = { sub: "check-no-employee", companyId, roles: [], perms: [], employeeId: undefined } as never;

const lists: [string, () => Promise<unknown[]>][] = [
  ["attendance/corrections?scope=me", () => listAttendanceCorrections(companyId, s, { scope: "me" } as never)],
  ["workflows/requests?scope=me", () => listRequests(companyId, s, { scope: "me" } as never)],
  ["expenses?scope=me", () => listExpenses(companyId, s, { scope: "me" } as never)],
  ["company-loans?scope=me", () => listLoans(companyId, s, { scope: "me" } as never)],
  ["payroll?scope=me", () => listPayroll(companyId, s, { scope: "me" } as never)],
  ["meetings?scope=invitee", () => listMeetings(companyId, s, { scope: "invitee" } as never)],
  ["training/enrollments", () => listMyEnrollments(companyId, s)],
  ["appraisal-tasks", () => listMyAppraisalTasks(companyId, s)],
  ["appraisal-my-results", () => listMyResults(companyId, s)],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of lists) {
    try {
      const rows = await fn();
      const ok = Array.isArray(rows) && rows.length === 0;
      if (!ok) failed++;
      console.log(`${ok ? "ok  " : "FAIL"} ${name} -> 200, ${Array.isArray(rows) ? rows.length : "?"} rows`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name} -> ${e instanceof AppError ? `${e.status} ${e.code}` : String(e)}`);
    }
  }
  // Not a list: "my profile" for a non-employee is NO_EMPLOYEE (the page shows the not-linked state), never 400.
  try {
    await getMyProfile(s);
    failed++; console.log("FAIL profile -> returned data");
  } catch (e) {
    const ok = e instanceof AppError && e.code === "NO_EMPLOYEE";
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} profile -> ${e instanceof AppError ? `${e.status} ${e.code}` : String(e)}`);
  }
  console.log(failed ? `${failed} failed` : "all passed");
  process.exit(failed ? 1 : 0);
})();
