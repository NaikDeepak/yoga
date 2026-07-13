ALTER TABLE "user_preferences" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "language_check" CHECK (language IN ('en', 'mr'));