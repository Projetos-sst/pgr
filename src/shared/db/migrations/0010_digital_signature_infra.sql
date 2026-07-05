CREATE TYPE "public"."signature_method" AS ENUM('qr', 'link', 'manual');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('pending', 'signed', 'cancelled');--> statement-breakpoint
CREATE TABLE "signature_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"image_data" text NOT NULL,
	"signer_name" text NOT NULL,
	"method" "signature_method" NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signature_captures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"token_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "signature_request_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signature_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_signature_captures_org_id" ON "signature_captures" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_signature_captures_request_id" ON "signature_captures" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_org_id" ON "signature_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_org_id_created_at" ON "signature_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_signature_requests_token_hash" ON "signature_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_target" ON "signature_requests" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE POLICY "signature_captures_isolation" ON "signature_captures" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "signature_requests_isolation" ON "signature_requests" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "signature_requests_token_capability" ON "signature_requests" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (token_hash = current_setting('app.signature_token', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_requests TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_captures TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_signature_requests ON public.signature_requests;--> statement-breakpoint
CREATE TRIGGER set_updated_at_signature_requests BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_signature_captures ON public.signature_captures;--> statement-breakpoint
CREATE TRIGGER set_updated_at_signature_captures BEFORE UPDATE ON public.signature_captures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();