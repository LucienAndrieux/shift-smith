CREATE TYPE "public"."absence_source" AS ENUM('import', 'manual', 'constraint');--> statement-breakpoint
CREATE TYPE "public"."absence_status" AS ENUM('approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."constraint_status" AS ENUM('pending', 'parsed', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."day_code_kind" AS ENUM('rest', 'absence', 'other');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."holiday_type" AS ENUM('public', 'regional', 'company');--> statement-breakpoint
CREATE TYPE "public"."hour_bank_entry_kind" AS ENUM('opening_balance', 'monthly_close', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('same_days_off', 'different_weekend_off');--> statement-breakpoint
CREATE TYPE "public"."rule_scope" AS ENUM('global', 'section', 'employee');--> statement-breakpoint
CREATE TYPE "public"."schedule_source" AS ENUM('import', 'manual', 'solver');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."shift_preference" AS ENUM('preferred', 'normal', 'rare');--> statement-breakpoint
CREATE TYPE "public"."solver_run_status" AS ENUM('queued', 'running', 'succeeded', 'infeasible', 'failed');--> statement-breakpoint
CREATE TYPE "public"."unavailability_source" AS ENUM('manual', 'constraint');--> statement-breakpoint
CREATE TYPE "public"."access_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'viewer');--> statement-breakpoint
CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_code" text NOT NULL,
	"day_code_kind" "day_code_kind" DEFAULT 'absence' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "absence_status" DEFAULT 'approved' NOT NULL,
	"source" "absence_source" DEFAULT 'manual' NOT NULL,
	"constraint_id" uuid,
	"end_to_confirm" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "absences_kind_check" CHECK ("absences"."day_code_kind" = 'absence'),
	CONSTRAINT "absences_dates_check" CHECK ("absences"."end_date" >= "absences"."start_date")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" "day_code_kind" NOT NULL,
	"is_due_day" boolean DEFAULT true NOT NULL,
	"credits_time" boolean DEFAULT false NOT NULL,
	"color" text DEFAULT '#9ca3af' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_codes_code_kind_unique" UNIQUE("code","kind"),
	CONSTRAINT "day_codes_color_check" CHECK ("day_codes"."color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "employee_fixed_days_off" (
	"employee_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_fixed_days_off_employee_id_weekday_pk" PRIMARY KEY("employee_id","weekday"),
	CONSTRAINT "employee_fixed_days_off_weekday_check" CHECK ("employee_fixed_days_off"."weekday" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "employee_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_a_id" uuid NOT NULL,
	"employee_b_id" uuid NOT NULL,
	"type" "relation_type" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_relations_distinct_check" CHECK ("employee_relations"."employee_a_id" <> "employee_relations"."employee_b_id")
);
--> statement-breakpoint
CREATE TABLE "employee_shift_eligibility" (
	"employee_id" uuid NOT NULL,
	"shift_type_id" uuid NOT NULL,
	"preference" "shift_preference" DEFAULT 'normal' NOT NULL,
	"max_per_week" smallint,
	"exact_per_week" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_shift_eligibility_employee_id_shift_type_id_pk" PRIMARY KEY("employee_id","shift_type_id"),
	CONSTRAINT "employee_shift_eligibility_limits_check" CHECK (("employee_shift_eligibility"."max_per_week" is null or "employee_shift_eligibility"."max_per_week" between 0 and 7) and ("employee_shift_eligibility"."exact_per_week" is null or "employee_shift_eligibility"."exact_per_week" between 0 and 7))
);
--> statement-breakpoint
CREATE TABLE "employee_unavailabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_minute" smallint,
	"end_minute" smallint,
	"reason" text,
	"source" "unavailability_source" DEFAULT 'manual' NOT NULL,
	"constraint_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_unavailabilities_window_check" CHECK (("employee_unavailabilities"."start_minute" is null and "employee_unavailabilities"."end_minute" is null) or ("employee_unavailabilities"."start_minute" between 0 and 1440 and "employee_unavailabilities"."end_minute" between 0 and 1440 and "employee_unavailabilities"."end_minute" > "employee_unavailabilities"."start_minute"))
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_number" text,
	"display_name" text NOT NULL,
	"full_name" text,
	"primary_section_id" uuid NOT NULL,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"weekly_contract_minutes" smallint DEFAULT 2250 NOT NULL,
	"reduced_schedule" boolean DEFAULT false NOT NULL,
	"monthly_tl_days" smallint DEFAULT 0 NOT NULL,
	"requires_monthly_weekend_off" boolean DEFAULT false NOT NULL,
	"birthday_month" smallint,
	"birthday_day" smallint,
	"hired_on" date,
	"left_on" date,
	"notes" text,
	"to_confirm" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employeeNumber_unique" UNIQUE("employee_number"),
	CONSTRAINT "employees_displayName_unique" UNIQUE("display_name"),
	CONSTRAINT "employees_contract_check" CHECK ("employees"."weekly_contract_minutes" > 0 and "employees"."weekly_contract_minutes" <= 3600),
	CONSTRAINT "employees_tl_check" CHECK ("employees"."monthly_tl_days" between 0 and 31),
	CONSTRAINT "employees_birthday_check" CHECK (("employees"."birthday_month" is null and "employees"."birthday_day" is null) or ("employees"."birthday_month" between 1 and 12 and "employees"."birthday_day" between 1 and 31)),
	CONSTRAINT "employees_dates_check" CHECK ("employees"."left_on" is null or "employees"."hired_on" is null or "employees"."left_on" >= "employees"."hired_on")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"type" "holiday_type" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "hour_bank_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"kind" "hour_bank_entry_kind" NOT NULL,
	"schedule_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "natural_language_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_text" text NOT NULL,
	"target_year" smallint NOT NULL,
	"target_month" smallint NOT NULL,
	"status" "constraint_status" DEFAULT 'pending' NOT NULL,
	"parsed" jsonb,
	"parse_error" text,
	"model" text,
	"created_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "natural_language_constraints_month_check" CHECK ("natural_language_constraints"."target_month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "schedule_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_type_id" uuid,
	"day_code" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_assignments_scheduleId_employeeId_date_unique" UNIQUE("schedule_id","employee_id","date"),
	CONSTRAINT "schedule_assignments_one_value_check" CHECK (("schedule_assignments"."shift_type_id" is null) <> ("schedule_assignments"."day_code" is null))
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"version" smallint NOT NULL,
	"status" "schedule_status" DEFAULT 'draft' NOT NULL,
	"source" "schedule_source" DEFAULT 'manual' NOT NULL,
	"title" text,
	"notes" text,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_year_month_version_unique" UNIQUE("year","month","version"),
	CONSTRAINT "schedules_month_check" CHECK ("schedules"."month" between 1 and 12),
	CONSTRAINT "schedules_version_check" CHECK ("schedules"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "scheduling_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"scope" "rule_scope" DEFAULT 'global' NOT NULL,
	"section_id" uuid,
	"employee_id" uuid,
	"value" jsonb NOT NULL,
	"is_hard" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduling_rules_target_unique" UNIQUE NULLS NOT DISTINCT("code","scope","section_id","employee_id"),
	CONSTRAINT "scheduling_rules_scope_check" CHECK (("scheduling_rules"."scope" = 'global' and "scheduling_rules"."section_id" is null and "scheduling_rules"."employee_id" is null)
        or ("scheduling_rules"."scope" = 'section' and "scheduling_rules"."section_id" is not null and "scheduling_rules"."employee_id" is null)
        or ("scheduling_rules"."scope" = 'employee' and "scheduling_rules"."employee_id" is not null and "scheduling_rules"."section_id" is null))
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"coverage_note" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sections_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "shift_type_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_type_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"unpaid_break_minutes" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_type_periods_shiftTypeId_position_unique" UNIQUE("shift_type_id","position"),
	CONSTRAINT "shift_type_periods_start_check" CHECK ("shift_type_periods"."start_minute" between 0 and 1440),
	CONSTRAINT "shift_type_periods_end_check" CHECK ("shift_type_periods"."end_minute" between 0 and 1440),
	CONSTRAINT "shift_type_periods_order_check" CHECK ("shift_type_periods"."end_minute" > "shift_type_periods"."start_minute"),
	CONSTRAINT "shift_type_periods_break_check" CHECK ("shift_type_periods"."unpaid_break_minutes" >= 0 and "shift_type_periods"."unpaid_break_minutes" < "shift_type_periods"."end_minute" - "shift_type_periods"."start_minute")
);
--> statement-breakpoint
CREATE TABLE "shift_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"to_confirm" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_types_sectionId_code_unique" UNIQUE("section_id","code"),
	CONSTRAINT "shift_types_code_check" CHECK ("shift_types"."code" ~ '^[A-Z]$'),
	CONSTRAINT "shift_types_color_check" CHECK ("shift_types"."color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "solver_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"schedule_id" uuid,
	"status" "solver_run_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staffing_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"shift_type_id" uuid,
	"date" date NOT NULL,
	"min_staff" smallint DEFAULT 0 NOT NULL,
	"max_staff" smallint,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staffing_overrides_target_unique" UNIQUE NULLS NOT DISTINCT("section_id","shift_type_id","date"),
	CONSTRAINT "staffing_overrides_staff_check" CHECK ("staffing_overrides"."min_staff" >= 0 and ("staffing_overrides"."max_staff" is null or "staffing_overrides"."max_staff" >= "staffing_overrides"."min_staff"))
);
--> statement-breakpoint
CREATE TABLE "staffing_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"shift_type_id" uuid,
	"weekday" smallint,
	"min_staff" smallint DEFAULT 0 NOT NULL,
	"max_staff" smallint,
	"valid_from" date,
	"valid_to" date,
	"to_confirm" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staffing_requirements_weekday_check" CHECK ("staffing_requirements"."weekday" is null or "staffing_requirements"."weekday" between 1 and 7),
	CONSTRAINT "staffing_requirements_staff_check" CHECK ("staffing_requirements"."min_staff" >= 0 and ("staffing_requirements"."max_staff" is null or "staffing_requirements"."max_staff" >= "staffing_requirements"."min_staff")),
	CONSTRAINT "staffing_requirements_validity_check" CHECK ("staffing_requirements"."valid_from" is null or "staffing_requirements"."valid_to" is null or "staffing_requirements"."valid_to" >= "staffing_requirements"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"access_status" "access_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_constraint_id_natural_language_constraints_id_fk" FOREIGN KEY ("constraint_id") REFERENCES "public"."natural_language_constraints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_day_code_fk" FOREIGN KEY ("day_code","day_code_kind") REFERENCES "public"."day_codes"("code","kind") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_fixed_days_off" ADD CONSTRAINT "employee_fixed_days_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_relations" ADD CONSTRAINT "employee_relations_employee_a_id_employees_id_fk" FOREIGN KEY ("employee_a_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_relations" ADD CONSTRAINT "employee_relations_employee_b_id_employees_id_fk" FOREIGN KEY ("employee_b_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_eligibility" ADD CONSTRAINT "employee_shift_eligibility_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_eligibility" ADD CONSTRAINT "employee_shift_eligibility_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_unavailabilities" ADD CONSTRAINT "employee_unavailabilities_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_unavailabilities" ADD CONSTRAINT "employee_unavailabilities_constraint_id_natural_language_constraints_id_fk" FOREIGN KEY ("constraint_id") REFERENCES "public"."natural_language_constraints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_primary_section_id_sections_id_fk" FOREIGN KEY ("primary_section_id") REFERENCES "public"."sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_bank_entries" ADD CONSTRAINT "hour_bank_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natural_language_constraints" ADD CONSTRAINT "natural_language_constraints_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natural_language_constraints" ADD CONSTRAINT "natural_language_constraints_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_day_code_day_codes_code_fk" FOREIGN KEY ("day_code") REFERENCES "public"."day_codes"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_rules" ADD CONSTRAINT "scheduling_rules_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_rules" ADD CONSTRAINT "scheduling_rules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_type_periods" ADD CONSTRAINT "shift_type_periods_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_types" ADD CONSTRAINT "shift_types_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solver_runs" ADD CONSTRAINT "solver_runs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solver_runs" ADD CONSTRAINT "solver_runs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_overrides" ADD CONSTRAINT "staffing_overrides_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_overrides" ADD CONSTRAINT "staffing_overrides_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_requirements" ADD CONSTRAINT "staffing_requirements_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_requirements" ADD CONSTRAINT "staffing_requirements_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absences_employee_id_index" ON "absences" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "absences_day_code_index" ON "absences" USING btree ("day_code");--> statement-breakpoint
CREATE INDEX "absences_start_date_end_date_index" ON "absences" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "absences_status_index" ON "absences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "absences_constraint_id_index" ON "absences" USING btree ("constraint_id");--> statement-breakpoint
CREATE INDEX "absences_created_by_index" ON "absences" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_index" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_entity_id_index" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "employee_relations_employee_a_id_index" ON "employee_relations" USING btree ("employee_a_id");--> statement-breakpoint
CREATE INDEX "employee_relations_employee_b_id_index" ON "employee_relations" USING btree ("employee_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_relations_pair_unique" ON "employee_relations" USING btree (least("employee_a_id", "employee_b_id"),greatest("employee_a_id", "employee_b_id"),"type");--> statement-breakpoint
CREATE INDEX "employee_shift_eligibility_shift_type_id_index" ON "employee_shift_eligibility" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "employee_unavailabilities_employee_id_date_index" ON "employee_unavailabilities" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "employee_unavailabilities_date_index" ON "employee_unavailabilities" USING btree ("date");--> statement-breakpoint
CREATE INDEX "employee_unavailabilities_constraint_id_index" ON "employee_unavailabilities" USING btree ("constraint_id");--> statement-breakpoint
CREATE INDEX "employees_primary_section_id_index" ON "employees" USING btree ("primary_section_id");--> statement-breakpoint
CREATE INDEX "employees_status_index" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hour_bank_entries_employee_id_entry_date_index" ON "hour_bank_entries" USING btree ("employee_id","entry_date");--> statement-breakpoint
CREATE INDEX "hour_bank_entries_kind_index" ON "hour_bank_entries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "hour_bank_entries_schedule_id_index" ON "hour_bank_entries" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "hour_bank_entries_created_by_index" ON "hour_bank_entries" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "hour_bank_entries_close_unique" ON "hour_bank_entries" USING btree ("employee_id","schedule_id") WHERE "hour_bank_entries"."kind" = 'monthly_close';--> statement-breakpoint
CREATE INDEX "natural_language_constraints_status_index" ON "natural_language_constraints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "natural_language_constraints_target_year_target_month_index" ON "natural_language_constraints" USING btree ("target_year","target_month");--> statement-breakpoint
CREATE INDEX "natural_language_constraints_created_by_index" ON "natural_language_constraints" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "natural_language_constraints_reviewed_by_index" ON "natural_language_constraints" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "schedule_assignments_schedule_id_index" ON "schedule_assignments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "schedule_assignments_employee_id_date_index" ON "schedule_assignments" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "schedule_assignments_shift_type_id_index" ON "schedule_assignments" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "schedule_assignments_day_code_index" ON "schedule_assignments" USING btree ("day_code");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_one_published_per_month" ON "schedules" USING btree ("year","month") WHERE "schedules"."status" = 'published';--> statement-breakpoint
CREATE INDEX "schedules_year_month_index" ON "schedules" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "schedules_status_index" ON "schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedules_created_by_index" ON "schedules" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "scheduling_rules_code_index" ON "scheduling_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "scheduling_rules_section_id_index" ON "scheduling_rules" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "scheduling_rules_employee_id_index" ON "scheduling_rules" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "shift_type_periods_shift_type_id_index" ON "shift_type_periods" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "shift_types_section_id_index" ON "shift_types" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "shift_types_is_active_index" ON "shift_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "solver_runs_year_month_index" ON "solver_runs" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "solver_runs_schedule_id_index" ON "solver_runs" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "solver_runs_status_index" ON "solver_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "solver_runs_created_by_index" ON "solver_runs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "staffing_overrides_section_id_index" ON "staffing_overrides" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "staffing_overrides_shift_type_id_index" ON "staffing_overrides" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "staffing_overrides_date_index" ON "staffing_overrides" USING btree ("date");--> statement-breakpoint
CREATE INDEX "staffing_requirements_section_id_index" ON "staffing_requirements" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "staffing_requirements_shift_type_id_index" ON "staffing_requirements" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "staffing_requirements_weekday_index" ON "staffing_requirements" USING btree ("weekday");--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_access_status_index" ON "user" USING btree ("access_status");--> statement-breakpoint
CREATE INDEX "user_approved_by_index" ON "user" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE VIEW "public"."shift_type_durations" AS (select shift_type_id,
    sum(end_minute - start_minute - unpaid_break_minutes)::integer as paid_minutes,
    min(start_minute)::integer as first_start_minute,
    max(end_minute)::integer as last_end_minute
  from shift_type_periods
  group by shift_type_id);