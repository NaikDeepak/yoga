CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"amount" numeric(12,2) NOT NULL CHECK ("amount" >= 0),
	"payment_date" date NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"course_fee" numeric(12,2) NOT NULL CHECK ("course_fee" >= 0),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fees_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
ALTER TABLE "fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "fee_payments_patient_history_idx" ON "fee_payments" USING btree ("patient_id","payment_date","created_at");--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;