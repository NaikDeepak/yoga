CREATE TABLE "capture_stats" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"shot" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "capture_stats_day_event_shot_pk" PRIMARY KEY("day","event","shot")
);
--> statement-breakpoint
ALTER TABLE "capture_stats" ENABLE ROW LEVEL SECURITY;