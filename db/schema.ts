import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["employee", "manager", "hr"]);
export const leaveTypeEnum = pgEnum("leave_type", [
  "annual",
  "sick",
  "personal",
  "unpaid",
  "ot",
  "correction",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
]);
export const holidayTypeEnum = pgEnum("holiday_type", ["company", "national"]);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeCode: varchar("employee_code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  department: text("department").notNull(),
  position: text("position").notNull(),
  managerId: integer("manager_id"),
  phone: varchar("phone", { length: 30 }),
  startDate: date("start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workplaces = pgTable("workplaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  radiusMeters: integer("radius_meters").notNull(),
  qrToken: varchar("qr_token", { length: 60 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  workDate: date("work_date").notNull(),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  clockInLat: doublePrecision("clock_in_lat"),
  clockInLng: doublePrecision("clock_in_lng"),
  clockOutLat: doublePrecision("clock_out_lat"),
  clockOutLng: doublePrecision("clock_out_lng"),
  clockInWorkplaceId: integer("clock_in_workplace_id").references(() => workplaces.id),
  clockOutWorkplaceId: integer("clock_out_workplace_id").references(() => workplaces.id),
  clockInDistance: doublePrecision("clock_in_distance"),
  clockOutDistance: doublePrecision("clock_out_distance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leaveBalances = pgTable("leave_balances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  year: integer("year").notNull(),
  leaveKey: varchar("leave_key", { length: 20 }).notNull(),
  label: text("label").notNull(),
  totalDays: integer("total_days").notNull(),
  usedDays: integer("used_days").notNull().default(0),
});

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  requestCode: varchar("request_code", { length: 20 }).notNull().unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  type: leaveTypeEnum("type").notNull(),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  halfDay: boolean("half_day").notNull().default(false),
  otStartTime: varchar("ot_start_time", { length: 5 }),
  otEndTime: varchar("ot_end_time", { length: 5 }),
  otHours: doublePrecision("ot_hours"),
  reason: text("reason"),
  attachmentUrl: text("attachment_url"),
  status: requestStatusEnum("status").notNull().default("Pending"),
  approverId: integer("approver_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  dateISO: date("date_iso").notNull(),
  name: text("name").notNull(),
  type: holidayTypeEnum("type").notNull().default("company"),
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  icon: varchar("icon", { length: 60 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  bg: varchar("bg", { length: 20 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payrollRecords = pgTable("payroll_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  period: varchar("period", { length: 20 }).notNull(),
  periodLabel: text("period_label").notNull(),
  earnings: jsonb("earnings").notNull(),
  deductions: jsonb("deductions").notNull(),
  gross: integer("gross").notNull(),
  totalDeductions: integer("total_deductions").notNull(),
  net: integer("net").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const performanceRecords = pgTable("performance_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  cycle: text("cycle").notNull(),
  overallScore: doublePrecision("overall_score").notNull(),
  band: text("band").notNull(),
  kpis: jsonb("kpis").notNull(),
  competencies: jsonb("competencies").notNull(),
  idpTitle: text("idp_title"),
  idpDescription: text("idp_description"),
  idpTargetDate: text("idp_target_date"),
  idpProgressPercent: integer("idp_progress_percent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiCriteriaTemplates = pgTable("ai_criteria_templates", {
  id: serial("id").primaryKey(),
  department: text("department").notNull(),
  role: text("role"),
  summary: text("summary").notNull(),
  competencies: jsonb("competencies").notNull(),
  kpis: jsonb("kpis").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiDraftReviews = pgTable("ai_draft_reviews", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  overall: text("overall").notNull(),
  strengths: jsonb("strengths").notNull(),
  improvements: jsonb("improvements").notNull(),
  development: jsonb("development").notNull(),
  summary: text("summary").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
