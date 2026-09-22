ALTER TABLE "auth_tokens" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "opt_ins" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "opt_outs" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "request_logs" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "sent_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "created_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';--> statement-breakpoint
ALTER TABLE "sms_messages" ALTER COLUMN "updated_at" SET DEFAULT now() AT TIME ZONE 'Africa/Nairobi';