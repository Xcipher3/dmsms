CREATE TABLE "auth_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"access_token" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'Africa/Nairobi'),
	CONSTRAINT "auth_tokens_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "api_requests" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_events" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "submitted_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_recipients" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');--> statement-breakpoint
ALTER TABLE "sms_recipients" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'Africa/Nairobi');