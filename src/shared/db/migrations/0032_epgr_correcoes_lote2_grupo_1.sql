CREATE TABLE "epi_catalog_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"epi_catalog_id" uuid NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epi_catalog_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD COLUMN "replacement_date" date;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "batch" text;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "manager_name" text;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "manager_role" text;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "professional_title" text;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "professional_registration" text;--> statement-breakpoint
ALTER TABLE "epi_catalog_audit_log" ADD CONSTRAINT "epi_catalog_audit_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_catalog_audit_log" ADD CONSTRAINT "epi_catalog_audit_log_epi_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("epi_catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_epi_catalog_audit_log_org_id" ON "epi_catalog_audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_epi_catalog_audit_log_epi_catalog_id" ON "epi_catalog_audit_log" USING btree ("epi_catalog_id");--> statement-breakpoint
CREATE POLICY "epi_catalog_audit_log_isolation" ON "epi_catalog_audit_log" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT ON public.epi_catalog_audit_log TO app_runtime;