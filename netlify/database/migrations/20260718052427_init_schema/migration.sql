CREATE TYPE "holiday_type" AS ENUM('company', 'national');--> statement-breakpoint
CREATE TYPE "leave_type" AS ENUM('annual', 'sick', 'personal', 'unpaid', 'ot', 'correction');--> statement-breakpoint
CREATE TYPE "request_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Cancelled');--> statement-breakpoint
CREATE TYPE "role" AS ENUM('employee', 'manager', 'hr');--> statement-breakpoint
CREATE TABLE "ai_criteria_templates" (
	"id" serial PRIMARY KEY,
	"department" text NOT NULL,
	"role" text,
	"summary" text NOT NULL,
	"competencies" jsonb NOT NULL,
	"kpis" jsonb NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_draft_reviews" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"overall" text NOT NULL,
	"strengths" jsonb NOT NULL,
	"improvements" jsonb NOT NULL,
	"development" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"clock_in_at" timestamp with time zone,
	"clock_out_at" timestamp with time zone,
	"clock_in_lat" double precision,
	"clock_in_lng" double precision,
	"clock_out_lat" double precision,
	"clock_out_lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY,
	"employee_code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'employee'::"role" NOT NULL,
	"department" text NOT NULL,
	"position" text NOT NULL,
	"manager_id" integer,
	"phone" varchar(30),
	"start_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY,
	"date_iso" date NOT NULL,
	"name" text NOT NULL,
	"type" "holiday_type" DEFAULT 'company'::"holiday_type" NOT NULL,
	"notify_enabled" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"year" integer NOT NULL,
	"leave_key" varchar(20) NOT NULL,
	"label" text NOT NULL,
	"total_days" integer NOT NULL,
	"used_days" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY,
	"request_code" varchar(20) NOT NULL UNIQUE,
	"employee_id" integer NOT NULL,
	"type" "leave_type" NOT NULL,
	"date_from" date,
	"date_to" date,
	"half_day" boolean DEFAULT false NOT NULL,
	"reason" text,
	"attachment_url" text,
	"status" "request_status" DEFAULT 'Pending'::"request_status" NOT NULL,
	"approver_id" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"icon" varchar(60) NOT NULL,
	"color" varchar(20) NOT NULL,
	"bg" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_label" text NOT NULL,
	"earnings" jsonb NOT NULL,
	"deductions" jsonb NOT NULL,
	"gross" integer NOT NULL,
	"total_deductions" integer NOT NULL,
	"net" integer NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "performance_records" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"cycle" text NOT NULL,
	"overall_score" double precision NOT NULL,
	"band" text NOT NULL,
	"kpis" jsonb NOT NULL,
	"competencies" jsonb NOT NULL,
	"idp_title" text,
	"idp_description" text,
	"idp_target_date" text,
	"idp_progress_percent" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_draft_reviews" ADD CONSTRAINT "ai_draft_reviews_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "performance_records" ADD CONSTRAINT "performance_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");