ALTER TYPE "public"."user_role" ADD VALUE 'manager';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'employee';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "employee_id" uuid;