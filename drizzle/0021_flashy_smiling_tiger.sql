ALTER TABLE "posture_views" ALTER COLUMN "file_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posture_assessments" ADD COLUMN "photos_deleted_at" timestamp;