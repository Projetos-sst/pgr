CREATE TABLE "tenant_probe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_probe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_tenant_probe_organization_id" ON "tenant_probe" USING btree ("organization_id");--> statement-breakpoint
CREATE POLICY "tenant_probe_isolation" ON "tenant_probe" AS PERMISSIVE FOR ALL TO "app_runtime" USING (organization_id = current_setting('app.current_org', true)) WITH CHECK (organization_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_probe TO app_runtime;