ALTER TABLE "share_links" DROP CONSTRAINT "share_links_kind_check";--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "posture_assessment_id" uuid;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "include_photos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_posture_assessment_id_posture_assessments_id_fk" FOREIGN KEY ("posture_assessment_id") REFERENCES "public"."posture_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_posture_target_check" CHECK (("share_links"."kind" = 'posture') = ("share_links"."posture_assessment_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_kind_check" CHECK ("share_links"."kind" IN ('exercises', 'posture'));