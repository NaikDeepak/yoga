CREATE TABLE "posture_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"assessed_on" date NOT NULL,
	"height_cm" real,
	"note" text,
	"consent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posture_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posture_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"view" text NOT NULL,
	"file_path" text NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"landmarks" jsonb NOT NULL,
	"landmarks_edited" boolean DEFAULT false NOT NULL,
	"metrics" jsonb NOT NULL,
	CONSTRAINT "posture_views_view_check" CHECK ("posture_views"."view" IN ('front', 'back', 'left', 'right'))
);
--> statement-breakpoint
ALTER TABLE "posture_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posture_assessments" ADD CONSTRAINT "posture_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posture_views" ADD CONSTRAINT "posture_views_assessment_id_posture_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."posture_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posture_assessments_patient_idx" ON "posture_assessments" USING btree ("patient_id","assessed_on");--> statement-breakpoint
CREATE UNIQUE INDEX "posture_views_assessment_view_uq" ON "posture_views" USING btree ("assessment_id","view");