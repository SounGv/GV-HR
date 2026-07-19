CREATE TABLE "workplaces" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_meters" integer NOT NULL,
	"qr_token" varchar(60) NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_in_workplace_id" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_out_workplace_id" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_in_distance" double precision;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_out_distance" double precision;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "ot_start_time" varchar(5);--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "ot_end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "ot_hours" double precision;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_clock_in_workplace_id_workplaces_id_fkey" FOREIGN KEY ("clock_in_workplace_id") REFERENCES "workplaces"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_clock_out_workplace_id_workplaces_id_fkey" FOREIGN KEY ("clock_out_workplace_id") REFERENCES "workplaces"("id");