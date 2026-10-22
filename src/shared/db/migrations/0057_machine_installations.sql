CREATE TABLE "machine_installation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"event" text NOT NULL,
	"reason" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machine_installation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "machine_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"work_unit_id" uuid NOT NULL,
	"ges_id" uuid,
	"catalog_id" uuid NOT NULL,
	"catalog_name" text NOT NULL,
	"manufacturer" text,
	"mode" text NOT NULL,
	"quantity" integer NOT NULL,
	"identifier" text,
	"description" text NOT NULL,
	"operating_conditions" text,
	"safety_measures" text,
	"maintenance_notes" text,
	"responsible" text,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_installations_quantity" CHECK ("machine_installations"."quantity">0 and "machine_installations"."quantity"<=100000),
	CONSTRAINT "machine_installations_mode" CHECK ("machine_installations"."mode" in ('individual','group') and ("machine_installations"."mode"<>'individual' or ("machine_installations"."quantity"=1 and length(trim("machine_installations"."identifier"))>0 and "machine_installations"."identifier" is not null)))
);
--> statement-breakpoint
ALTER TABLE "machine_installations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_installation_events" ADD CONSTRAINT "machine_installation_events_installation_id_machine_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."machine_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_installations" ADD CONSTRAINT "machine_installations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_installations" ADD CONSTRAINT "machine_installations_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_installations" ADD CONSTRAINT "machine_installations_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_installations" ADD CONSTRAINT "machine_installations_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_machine_installation_events" ON "machine_installation_events" USING btree ("org_id","installation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_machine_installations_context" ON "machine_installations" USING btree ("org_id","company_id","work_unit_id","ges_id");--> statement-breakpoint
CREATE POLICY "machine_installation_events_tenant" ON "machine_installation_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "machine_installation_events_parent" ON "machine_installation_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.machine_installations m where m.id="machine_installation_events"."installation_id" and m.org_id="machine_installation_events"."org_id" and m.company_id="machine_installation_events"."company_id")) WITH CHECK (exists(select 1 from public.machine_installations m where m.id="machine_installation_events"."installation_id" and m.org_id="machine_installation_events"."org_id" and m.company_id="machine_installation_events"."company_id"));--> statement-breakpoint
CREATE POLICY "machine_installations_tenant" ON "machine_installations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "machine_installations_module" ON "machine_installations" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "machine_installations"."org_id" and cm.company_id = "machine_installations"."company_id" and cm.module = 'pgr' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "machine_installations"."org_id" and cm.company_id = "machine_installations"."company_id" and cm.module = 'pgr' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "machine_installations_context" ON "machine_installations" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.work_units w where w.id="machine_installations"."work_unit_id" and w.org_id="machine_installations"."org_id" and w.company_id="machine_installations"."company_id")) WITH CHECK (exists(select 1 from public.work_units w where w.id="machine_installations"."work_unit_id" and w.org_id="machine_installations"."org_id" and w.company_id="machine_installations"."company_id") and ("machine_installations"."ges_id" is null or exists(select 1 from public.ges g where g.id="machine_installations"."ges_id" and g.org_id="machine_installations"."org_id" and g.company_id="machine_installations"."company_id" and g.work_unit_id="machine_installations"."work_unit_id")) and exists(select 1 from public.epi_catalog c where c.id="machine_installations"."catalog_id" and c.org_id="machine_installations"."org_id" and c.type='machine' and (c.company_id is null or c.company_id="machine_installations"."company_id")));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.machine_installations TO app_runtime;
--> statement-breakpoint
REVOKE DELETE ON public.machine_installations FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.machine_installation_events TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.machine_installation_events FROM app_runtime;
