CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_mr" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"description_mr" text,
	"repetitions" text NOT NULL,
	"repetitions_mr" text NOT NULL,
	"days_per_week" text NOT NULL,
	"days_per_week_mr" text NOT NULL,
	"steps" text[] NOT NULL,
	"steps_mr" text[] NOT NULL,
	"tip" text,
	"tip_mr" text,
	"image_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prescribed_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"repetitions" text,
	"days_per_week" text,
	"custom_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescribed_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prescribed_exercises" ADD CONSTRAINT "prescribed_exercises_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescribed_exercises" ADD CONSTRAINT "prescribed_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prescribed_exercises_patient_idx" ON "prescribed_exercises" USING btree ("patient_id");