ALTER TABLE "posture_assessments" ADD COLUMN "ai_report" jsonb;--> statement-breakpoint
ALTER TABLE "posture_assessments" ADD COLUMN "ai_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "posture_assessments" ADD COLUMN "ai_approved_at" timestamp;