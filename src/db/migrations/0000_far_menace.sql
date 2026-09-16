CREATE TABLE "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"access_token" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_tokens_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "opt_outs" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"ip" text,
	"user_agent" text,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"msg_id" text NOT NULL,
	"phone" text NOT NULL,
	"msg" text NOT NULL,
	"dlr_url" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'pending',
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
