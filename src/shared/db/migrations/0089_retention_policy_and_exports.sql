CREATE TABLE "retention_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "retention_exports_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"status" text NOT NULL,
	"content_sha256" text,
	"item_count" integer NOT NULL,
	"missing_count" integer NOT NULL,
	"hash_mismatch_count" integer NOT NULL,
	"failure_reason" text,
	"exported_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retention_exports_status" CHECK ("retention_exports"."status" in ('complete','incomplete','failed')),
	CONSTRAINT "retention_exports_counts" CHECK ("retention_exports"."item_count" >= 0 and "retention_exports"."missing_count" >= 0 and "retention_exports"."hash_mismatch_count" >= 0),
	CONSTRAINT "retention_exports_shape" CHECK (case "retention_exports"."status"
          when 'failed' then "retention_exports"."content_sha256" is null and "retention_exports"."failure_reason" in ('storage_unavailable')
          when 'complete' then "retention_exports"."content_sha256" ~ '^[a-f0-9]{64}$' and "retention_exports"."failure_reason" is null and "retention_exports"."missing_count" = 0 and "retention_exports"."hash_mismatch_count" = 0
          else "retention_exports"."content_sha256" ~ '^[a-f0-9]{64}$' and "retention_exports"."failure_reason" is null and "retention_exports"."missing_count" + "retention_exports"."hash_mismatch_count" > 0
        end)
);
--> statement-breakpoint
ALTER TABLE "retention_exports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retention_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "retention_policy_versions_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"status" text NOT NULL,
	"terms" jsonb NOT NULL,
	"terms_sha256" text NOT NULL,
	"approver_name" text,
	"approver_role" text,
	"approved_on" date,
	"approval_reference" text,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retention_policy_versions_status" CHECK ("retention_policy_versions"."status" in ('proposed','approved')),
	CONSTRAINT "retention_policy_versions_sha256" CHECK ("retention_policy_versions"."terms_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "retention_policy_versions_approval" CHECK (case "retention_policy_versions"."status"
        when 'approved' then btrim(coalesce("retention_policy_versions"."approver_name",'')) <> '' and btrim(coalesce("retention_policy_versions"."approver_role",'')) <> '' and "retention_policy_versions"."approved_on" is not null and btrim(coalesce("retention_policy_versions"."approval_reference",'')) <> ''
        else "retention_policy_versions"."approver_name" is null and "retention_policy_versions"."approver_role" is null and "retention_policy_versions"."approved_on" is null and "retention_policy_versions"."approval_reference" is null
      end)
);
--> statement-breakpoint
ALTER TABLE "retention_policy_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retention_exports" ADD CONSTRAINT "retention_exports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_exports" ADD CONSTRAINT "retention_exports_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_policy_versions" ADD CONSTRAINT "retention_policy_versions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_retention_exports" ON "retention_exports" USING btree ("org_id","pgr_id","seq");--> statement-breakpoint
CREATE INDEX "idx_retention_policy_versions" ON "retention_policy_versions" USING btree ("org_id","seq");--> statement-breakpoint
CREATE POLICY "retention_exports_tenant" ON "retention_exports" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "retention_exports_context" ON "retention_exports" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.pgr p where p.id="retention_exports"."pgr_id" and p.org_id="retention_exports"."org_id")) WITH CHECK (exists(select 1 from public.pgr p where p.id="retention_exports"."pgr_id" and p.org_id="retention_exports"."org_id"));--> statement-breakpoint
CREATE POLICY "retention_exports_actor" ON "retention_exports" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("retention_exports"."exported_by"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "retention_policy_versions_tenant" ON "retention_policy_versions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "retention_policy_versions_owner_insert" ON "retention_policy_versions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("retention_policy_versions"."recorded_by"=current_setting('app.current_actor',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
GRANT SELECT, INSERT ON public.retention_policy_versions TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.retention_policy_versions FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.retention_exports TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.retention_exports FROM app_runtime;
