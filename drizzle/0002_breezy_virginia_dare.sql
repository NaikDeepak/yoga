CREATE TABLE "lifestyle_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"chief_complaint" text,
	"duration" text,
	"aggravating_factors" text,
	"relieving_factors" text,
	"previous_treatment" text,
	"current_medications" text,
	"doctor_diagnosis" text,
	"doctor_restrictions" text,
	"work_type" text,
	"daily_sitting" text,
	"activity_level" text,
	"sleep_hours" text,
	"sleep_quality" integer,
	"stress_level" integer,
	"screen_time" text,
	"previous_exercise" text,
	"fitness_level" text,
	"fear_of_movement" boolean,
	"primary_goal" text,
	"activity_struggle" text,
	"has_contraindications" boolean,
	"contraindication_details" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lifestyle_assessments_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
ALTER TABLE "lifestyle_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lifestyle_assessments" ADD CONSTRAINT "lifestyle_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;