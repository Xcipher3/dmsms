ALTER TABLE "request_logs" ADD COLUMN "request_body" jsonb;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "response_body" jsonb;