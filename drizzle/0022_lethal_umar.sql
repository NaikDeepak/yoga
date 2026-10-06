CREATE TABLE "flexibility_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"shot" text NOT NULL,
	"file_path" text,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"landmarks" jsonb NOT NULL,
	"landmarks_edited" boolean DEFAULT false NOT NULL,
	"camera_check" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flexibility_tests_shot_check" CHECK ("flexibility_tests"."shot" IN ('shoulderExtLeft', 'shoulderExtRight', 'forwardFold', 'butterfly'))
);
--> statement-breakpoint
ALTER TABLE "flexibility_tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "flexibility_tests" ADD CONSTRAINT "flexibility_tests_assessment_id_posture_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."posture_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flexibility_tests_assessment_shot_uq" ON "flexibility_tests" USING btree ("assessment_id","shot");