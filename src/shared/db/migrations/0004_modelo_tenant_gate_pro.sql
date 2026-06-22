CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"cnpj" text,
	"razao_social" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "scoped_company_id" uuid;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "clerk_org_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_org_id" ON "companies" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_companies_org_id_cnpj" ON "companies" USING btree ("org_id","cnpj");--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_scoped_company_id_companies_id_fk" FOREIGN KEY ("scoped_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_clerk_org_id_unique" ON "orgs" USING btree ("clerk_org_id");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_plan_check" CHECK ("orgs"."plan" in ('free','pro'));--> statement-breakpoint
CREATE POLICY "companies_isolation" ON "companies" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO app_runtime;