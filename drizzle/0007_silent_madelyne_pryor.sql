ALTER TABLE "user_preferences" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "language_check" CHECK (language IN ('en', 'mr'));--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "whatsapp_number_check" CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^[0-9]{10}$');