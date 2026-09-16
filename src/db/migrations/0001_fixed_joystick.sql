CREATE TABLE "opt_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
