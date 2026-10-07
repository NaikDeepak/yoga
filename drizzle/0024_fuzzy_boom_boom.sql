CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_email" text,
	"action" text NOT NULL,
	"patient_id" uuid,
	"client_code" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_seq_uq" ON "audit_log" USING btree ("seq");