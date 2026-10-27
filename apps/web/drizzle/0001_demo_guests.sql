ALTER TYPE "public"."user_role" ADD VALUE 'demo' BEFORE 'viewer';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "user_is_anonymous_created_at_index" ON "user" USING btree ("is_anonymous","created_at");