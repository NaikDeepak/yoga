ALTER TABLE "share_links" DROP CONSTRAINT "share_links_kind_check";--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "hide_weight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_kind_check" CHECK ("share_links"."kind" IN ('exercises', 'posture', 'progress'));