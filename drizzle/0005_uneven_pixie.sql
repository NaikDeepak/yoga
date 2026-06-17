CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'en' NOT NULL CHECK ("language" IN ('en', 'mr')),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
