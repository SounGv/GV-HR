import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { getDashboardSummary } from "@/features/dashboard/service";
import { getReport } from "@/features/report/service";
import { REPORT_TYPES } from "@/features/report/schema";
import { listEmployees } from "@/features/employee/service";
import { createAnnouncement } from "@/features/announcement/service";
import { createNotification } from "@/features/notification/service";
import { computePayroll } from "@/features/payroll/calc";
import { fullName } from "@/lib/format";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

type Meta = { ip?: string; userAgent?: string };

export interface NexaTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Tool definitions exposed to the model. These make NEXA AI *grounded*: it
 * fetches real, company-scoped, permission-checked HR data instead of guessing.
 */
export const NEXA_TOOLS: NexaTool[] = [
  {
    name: "get_headcount",
    description:
      "Get the company's current headcount analytics: total employees, active, on leave, new hires this month, and the breakdown by department. Use for questions about how many people work here or department sizes.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_hr_report",
    description:
      "Get a structured HR report as rows. type=employees (roster), attendance (monthly present/late/hours per employee), leave (yearly used days by type), overtime (monthly OT hours + pay), payroll (per-period gross/deductions/net), expense (monthly approved/paid reimbursements per employee), training (per-employee enrolled/completed courses + hours). Use this to summarize absences, leave, OT, payroll, expenses, or training. period is YYYY-MM for monthly reports, YYYY for leave; omit for training/current.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...REPORT_TYPES] },
        period: { type: "string", description: "YYYY-MM or YYYY; omit for current period" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "search_employees",
    description: "Search employees by name, code, or email. Returns up to 20 matches with department and position.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_employee_context",
    description:
      "Get one employee's full context by name or employee code: department, position, employment type, manager, and recent performance band. Use this before generating a role-specific performance evaluation or answering questions about a specific person.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "employee name or code" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_recent_announcements",
    description: "List the most recent published company announcements.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "send_notification",
    description:
      "Send an in-app notification to an employee (by name/code) or to everyone (target='all'). Use when the user asks to notify or message staff. Requires permission.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "employee name/code, or 'all'" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["target", "title", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "create_announcement",
    description: "Publish a company-wide announcement. Use when the user asks to post/announce something. Requires permission.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" } },
      required: ["title", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "calculate_payroll",
    description:
      "Calculate a Thai monthly payslip using the real payroll engine: Social Security (5%, capped 750), progressive withholding income tax, and provident fund. Provide either `employee` (name/code) to use their base salary, or `baseSalary` directly. Optional: allowances, overtime, bonus, providentFundRate (%). ALWAYS use this for any salary/tax/social-security/take-home-pay computation — never calculate it yourself.",
    input_schema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "employee name or code (optional if baseSalary given)" },
        baseSalary: { type: "number" },
        allowances: { type: "number" },
        overtime: { type: "number" },
        bonus: { type: "number" },
        providentFundRate: { type: "number", description: "employee provident fund %, e.g. 3" },
      },
      additionalProperties: false,
    },
  },
];

async function resolveEmployees(companyId: string, target: string) {
  if (target.trim().toLowerCase() === "all") {
    return prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });
  }
  return prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [
        { employeeCode: { equals: target, mode: "insensitive" } },
        { firstName: { contains: target, mode: "insensitive" } },
        { lastName: { contains: target, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: 50,
  });
}

/** Execute one tool call. Returns a string (JSON or message) for the tool_result. */
export async function executeTool(
  session: AccessClaims,
  name: string,
  rawInput: unknown,
  meta?: Meta,
): Promise<string> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const companyId = session.companyId;
  const deny = (perm: string) => `ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ ${perm} จึงจะใช้เครื่องมือนี้ได้`;

  try {
    switch (name) {
      case "get_headcount": {
        if (!can(session.perms, "dashboard:read") && !can(session.perms, "report:read"))
          return deny("dashboard:read");
        return JSON.stringify(await getDashboardSummary(companyId));
      }

      case "get_hr_report": {
        if (!can(session.perms, "report:read")) return deny("report:read");
        // Convert the tool's period (YYYY-MM or YYYY) into a from/to date range.
        const period = typeof input.period === "string" ? input.period : undefined;
        let from: string | undefined;
        let to: string | undefined;
        if (period && /^\d{4}-\d{2}$/.test(period)) {
          const [y, m] = period.split("-").map(Number);
          from = `${period}-01`;
          to = `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
        } else if (period && /^\d{4}$/.test(period)) {
          from = `${period}-01-01`;
          to = `${period}-12-31`;
        }
        const report = await getReport(companyId, {
          type: input.type as (typeof REPORT_TYPES)[number],
          from,
          to,
        });
        return JSON.stringify({
          title: report.title,
          period: report.period,
          totalRows: report.rows.length,
          rows: report.rows.slice(0, 100),
        });
      }

      case "search_employees": {
        if (!can(session.perms, "employee:read")) return deny("employee:read");
        const { items } = await listEmployees(companyId, {
          page: 1,
          pageSize: 20,
          sortDir: "asc",
          search: String(input.query ?? ""),
        });
        return JSON.stringify(
          items.map((e) => ({
            code: e.employeeCode,
            name: fullName(e.firstName, e.lastName),
            department: e.department?.name ?? null,
            position: e.position?.title ?? null,
            status: e.status,
          })),
        );
      }

      case "get_employee_context": {
        if (!can(session.perms, "employee:read")) return deny("employee:read");
        const q = String(input.query ?? "");
        const emp = await prisma.employee.findFirst({
          where: {
            companyId,
            deletedAt: null,
            OR: [
              { employeeCode: { equals: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            employmentType: true,
            department: { select: { name: true } },
            position: { select: { title: true, level: true } },
            manager: { select: { firstName: true, lastName: true } },
            performanceReviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { cycle: true, overallScore: true, band: true },
            },
          },
        });
        if (!emp) return "ไม่พบพนักงานที่ตรงกับคำค้น";
        return JSON.stringify({
          code: emp.employeeCode,
          name: fullName(emp.firstName, emp.lastName),
          department: emp.department?.name ?? null,
          position: emp.position?.title ?? null,
          level: emp.position?.level ?? null,
          employmentType: emp.employmentType,
          manager: emp.manager ? fullName(emp.manager.firstName, emp.manager.lastName) : null,
          latestReview: emp.performanceReviews[0] ?? null,
        });
      }

      case "list_recent_announcements": {
        if (!can(session.perms, "announcement:read")) return deny("announcement:read");
        const anns = await prisma.announcement.findMany({
          where: { companyId, deletedAt: null, status: "PUBLISHED" },
          orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
          take: 10,
          select: { title: true, body: true, authorName: true, publishedAt: true },
        });
        return JSON.stringify(anns);
      }

      case "send_notification": {
        if (!can(session.perms, "notification:create")) return deny("notification:create");
        const targets = await resolveEmployees(companyId, String(input.target ?? ""));
        if (targets.length === 0) return "ไม่พบพนักงานปลายทาง";
        for (const t of targets) {
          await createNotification(
            companyId,
            t.id,
            { title: String(input.title ?? ""), body: String(input.body ?? ""), category: "ai" },
            session.sub,
          );
        }
        return `ส่งการแจ้งเตือนถึง ${targets.length} คนเรียบร้อย`;
      }

      case "create_announcement": {
        if (!can(session.perms, "announcement:create")) return deny("announcement:create");
        const rec = await createAnnouncement(
          companyId,
          session,
          {
            title: String(input.title ?? ""),
            body: String(input.body ?? ""),
            pinned: false,
            status: "PUBLISHED",
          },
          meta,
        );
        return `เผยแพร่ประกาศเรียบร้อย (id: ${rec.id})`;
      }

      case "calculate_payroll": {
        if (!can(session.perms, "payroll:read")) return deny("payroll:read");
        let base = num(input.baseSalary);
        let who: string | null = null;
        if (input.employee) {
          const q = String(input.employee);
          const emp = await prisma.employee.findFirst({
            where: {
              companyId,
              deletedAt: null,
              OR: [
                { employeeCode: { equals: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { firstName: true, lastName: true, baseSalary: true },
          });
          if (!emp) return "ไม่พบพนักงานที่ตรงกับคำค้น";
          if (emp.baseSalary == null) return "พนักงานคนนี้ยังไม่ได้กำหนดเงินเดือนฐานในระบบ";
          base = Number(emp.baseSalary);
          who = fullName(emp.firstName, emp.lastName);
        }
        if (base == null) return "กรุณาระบุพนักงาน (employee) หรือเงินเดือนฐาน (baseSalary)";
        const comp = computePayroll({
          baseSalary: base,
          allowances: num(input.allowances),
          overtime: num(input.overtime),
          bonus: num(input.bonus),
          providentFundRate: num(input.providentFundRate),
        });
        return JSON.stringify({ employee: who, currency: "THB", ...comp });
      }

      default:
        return `ไม่รู้จักเครื่องมือ: ${name}`;
    }
  } catch (err) {
    return `เกิดข้อผิดพลาดในการเรียกข้อมูล: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

/* ── Convert our JSON-schema tool defs into Gemini function declarations ── */

/* eslint-disable @typescript-eslint/no-explicit-any */
function toGeminiSchema(s: any): any {
  if (!s || typeof s !== "object") return undefined;
  const out: any = {};
  if (s.type) out.type = s.type as SchemaType; // JSON-schema type strings match SchemaType values
  if (s.description) out.description = s.description;
  if (Array.isArray(s.enum)) {
    out.enum = s.enum;
    out.format = "enum";
  }
  if (s.type === "object") {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    out.properties = {};
    for (const [k, v] of Object.entries(props)) out.properties[k] = toGeminiSchema(v);
    if (Array.isArray(s.required)) out.required = s.required;
  }
  if (s.type === "array" && s.items) out.items = toGeminiSchema(s.items);
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** JSON schema → Gemini responseSchema (for structured JSON output). */
export function jsonSchemaToGemini(schema: Record<string, unknown>) {
  return toGeminiSchema(schema);
}

/** All NEXA tools as Gemini function declarations. */
export function toGeminiTools(): FunctionDeclaration[] {
  return NEXA_TOOLS.map((t) => {
    const hasProps = Object.keys(t.input_schema.properties ?? {}).length > 0;
    return {
      name: t.name,
      description: t.description,
      ...(hasProps ? { parameters: toGeminiSchema(t.input_schema) } : {}),
    } as FunctionDeclaration;
  });
}
