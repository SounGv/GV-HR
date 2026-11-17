/**
 * Report types whose data is more sensitive than plain "report:read" implies. One table for the Reports page's route and
 * the assistant's report tool, so asking the assistant can never reach what the page refuses.
 *
 * - payroll: pay figures. "payroll:create" is held by HR and Finance only; every employee holds "payroll:read" for their
 *   own payslip, and a manager who is also an employee would otherwise read the whole team's pay.
 * - appraisal_detail: per-topic scores and the examples raters wrote, for the people who manage evaluation rounds.
 */
export const REPORT_TYPE_PERMISSION: Partial<Record<string, string>> = {
  payroll: "payroll:create",
  appraisal_detail: "campaign:manage",
};
