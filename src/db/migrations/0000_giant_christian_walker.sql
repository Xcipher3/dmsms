CREATE TYPE "public"."sms_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sms_event_type" AS ENUM('submitted', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "api_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"query" text,
	"status_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"ip" text,
	"user_agent" text,
	"headers" jsonb,
	"error" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"created_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi'
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"endpoint" text NOT NULL,
	"request_id" text,
	"status_code" integer NOT NULL,
	"msg_id" text,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi',
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours'
);
--> statement-breakpoint
CREATE TABLE "sms_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"event_type" "sms_event_type" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi'
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"msg_id" text NOT NULL,
	"msg" text NOT NULL,
	"dlr_url" text NOT NULL,
	"category" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"status" "sms_delivery_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi',
	"created_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi',
	"updated_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi'
);
--> statement-breakpoint
CREATE TABLE "sms_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"status" "sms_delivery_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi',
	"updated_at" timestamp DEFAULT now() AT TIME ZONE 'Africa/Nairobi'
);
--> statement-breakpoint
ALTER TABLE "sms_events" ADD CONSTRAINT "sms_events_message_id_sms_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."sms_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_events" ADD CONSTRAINT "sms_events_recipient_id_sms_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."sms_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_recipients" ADD CONSTRAINT "sms_recipients_message_id_sms_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."sms_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_requests_request_id_idx" ON "api_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "api_requests_created_at_idx" ON "api_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_requests_status_code_idx" ON "api_requests" USING btree ("status_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_endpoint_key_idx" ON "idempotency_keys" USING btree ("endpoint","idempotency_key");--> statement-breakpoint
CREATE INDEX "sms_events_message_id_idx" ON "sms_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "sms_events_recipient_id_idx" ON "sms_events" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "sms_events_created_at_idx" ON "sms_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_messages_msg_id_idx" ON "sms_messages" USING btree ("msg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_recipients_message_phone_idx" ON "sms_recipients" USING btree ("message_id","phone");--> statement-breakpoint
CREATE INDEX "sms_recipients_status_idx" ON "sms_recipients" USING btree ("status");