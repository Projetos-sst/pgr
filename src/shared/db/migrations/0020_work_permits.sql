CREATE TYPE "public"."work_permit_status" AS ENUM('draft', 'active', 'suspended', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_permit_type" AS ENUM('hot_work', 'confined_space', 'height', 'electrical', 'excavation', 'cold_work', 'other');--> statement-breakpoint
CREATE TABLE "work_permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text NOT NULL,
	"type" "work_permit_type" NOT NULL,
	"status" "work_permit_status" DEFAULT 'draft' NOT NULL,
	"company_id" uuid,
	"area" text,
	"description" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"requested_by" text,
	"approved_by" text,
	"precautions" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_permits_valid_range_check" CHECK ("work_permits"."valid_until" >= "work_permits"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "work_permits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_work_permits_org_id" ON "work_permits" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_work_permits_org_status" ON "work_permits" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_permits_org_number" ON "work_permits" USING btree ("org_id","number");--> statement-breakpoint
CREATE POLICY "work_permits_isolation" ON "work_permits" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_permits TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_work_permits ON public.work_permits;--> statement-breakpoint
CREATE TRIGGER set_updated_at_work_permits BEFORE UPDATE ON public.work_permits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
