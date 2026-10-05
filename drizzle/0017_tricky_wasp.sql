CREATE TABLE "exercise_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"share_link_id" uuid,
	"checkin_date" date NOT NULL,
	"done" text NOT NULL,
	"pain_scale" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_checkins_done_check" CHECK ("exercise_checkins"."done" IN ('all', 'some', 'none')),
	CONSTRAINT "exercise_checkins_pain_check" CHECK ("exercise_checkins"."pain_scale" IS NULL OR "exercise_checkins"."pain_scale" BETWEEN 0 AND 10)
);
--> statement-breakpoint
ALTER TABLE "exercise_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_checkins" ADD CONSTRAINT "exercise_checkins_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_checkins" ADD CONSTRAINT "exercise_checkins_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_checkins_patient_date_uq" ON "exercise_checkins" USING btree ("patient_id","checkin_date");