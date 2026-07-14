CREATE UNIQUE INDEX "prescribed_exercises_patient_exercise_uq" ON "prescribed_exercises" USING btree ("patient_id","exercise_id");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_category_check" CHECK (category IN ('neck', 'back', 'core', 'lower_body', 'shoulder'));