CREATE TABLE "aso_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"signed_document_id" uuid NOT NULL,
	"document_sha256" text NOT NULL,
	"kind" text NOT NULL,
	"method" text,
	"channel_description" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"evidence_reference" text,
	"evidence_kind" text,
	"evidence_path" text,
	"evidence_sha256" text,
	"evidence_size_bytes" integer,
	"evidence_content_type" text,
	"voids_id" uuid,
	"void_reason" text,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_aso_deliveries_kind" CHECK ("aso_deliveries"."kind" in ('made_available','physical_copy_requested','voided')),
	CONSTRAINT "ck_aso_deliveries_hash" CHECK ("aso_deliveries"."document_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_aso_deliveries_made_available" CHECK (("aso_deliveries"."kind" = 'made_available') = ("aso_deliveries"."method" is not null)
        and ("aso_deliveries"."method" is null or "aso_deliveries"."method" in ('physical_copy','digital_copy'))
        and ("aso_deliveries"."kind" <> 'made_available' or char_length(btrim(coalesce("aso_deliveries"."evidence_reference", ''))) >= 5)
        and ("aso_deliveries"."method" is distinct from 'digital_copy' or char_length(btrim(coalesce("aso_deliveries"."channel_description", ''))) >= 5)),
	CONSTRAINT "ck_aso_deliveries_evidence" CHECK ((("aso_deliveries"."evidence_kind" is null) = ("aso_deliveries"."evidence_path" is null)
          and ("aso_deliveries"."evidence_path" is null) = ("aso_deliveries"."evidence_sha256" is null)
          and ("aso_deliveries"."evidence_path" is null) = ("aso_deliveries"."evidence_size_bytes" is null)
          and ("aso_deliveries"."evidence_path" is null) = ("aso_deliveries"."evidence_content_type" is null))
        and ("aso_deliveries"."evidence_kind" is null or ("aso_deliveries"."kind" = 'made_available' and "aso_deliveries"."evidence_kind" in ('signed_receipt','channel_confirmation')))
        and ("aso_deliveries"."evidence_sha256" is null or "aso_deliveries"."evidence_sha256" ~ '^[0-9a-f]{64}$')
        and ("aso_deliveries"."evidence_size_bytes" is null or "aso_deliveries"."evidence_size_bytes" > 0)
        and ("aso_deliveries"."evidence_content_type" is null or "aso_deliveries"."evidence_content_type" in ('application/pdf','image/jpeg','image/png'))),
	CONSTRAINT "ck_aso_deliveries_void" CHECK (("aso_deliveries"."kind" = 'voided') = ("aso_deliveries"."voids_id" is not null)
        and ("aso_deliveries"."voids_id" is null) = ("aso_deliveries"."void_reason" is null)
        and ("aso_deliveries"."void_reason" is null or char_length(btrim("aso_deliveries"."void_reason")) >= 10)
        and ("aso_deliveries"."voids_id" is null or "aso_deliveries"."voids_id" <> "aso_deliveries"."id"))
);
--> statement-breakpoint
ALTER TABLE "aso_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "aso_deliveries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "fk_aso_deliveries_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "fk_aso_deliveries_exam" FOREIGN KEY ("health_exam_id","org_id","company_id") REFERENCES "public"."health_exams"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "fk_aso_deliveries_signed" FOREIGN KEY ("signed_document_id","org_id","health_exam_id") REFERENCES "public"."aso_signed_documents"("id","org_id","health_exam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_deliveries_id_scope" ON "aso_deliveries" USING btree ("id","org_id","health_exam_id");--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "fk_aso_deliveries_voids" FOREIGN KEY ("voids_id","org_id","health_exam_id") REFERENCES "public"."aso_deliveries"("id","org_id","health_exam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_deliveries_voids" ON "aso_deliveries" USING btree ("voids_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_deliveries_evidence_path" ON "aso_deliveries" USING btree ("evidence_path");--> statement-breakpoint
CREATE INDEX "idx_aso_deliveries_exam" ON "aso_deliveries" USING btree ("org_id","health_exam_id","recorded_at");--> statement-breakpoint
CREATE POLICY "aso_deliveries_isolation" ON "aso_deliveries" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "aso_deliveries_module_access" ON "aso_deliveries" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "aso_deliveries"."org_id" and cm.company_id = "aso_deliveries"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "aso_deliveries"."org_id" and cm.company_id = "aso_deliveries"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "aso_deliveries_insert" ON "aso_deliveries" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("aso_deliveries"."recorded_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.org_memberships om where om.org_id = "aso_deliveries"."org_id"
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member'))
        and exists (select 1 from public.health_exams h where h.id = "aso_deliveries"."health_exam_id" and h.org_id = "aso_deliveries"."org_id"
          and h.company_id = "aso_deliveries"."company_id" and h.employee_id = "aso_deliveries"."employee_id")
        and exists (select 1 from public.aso_signed_documents s where s.id = "aso_deliveries"."signed_document_id" and s.org_id = "aso_deliveries"."org_id"
          and s.health_exam_id = "aso_deliveries"."health_exam_id" and s.file_sha256 = "aso_deliveries"."document_sha256")
        and ("aso_deliveries"."kind" = 'voided' or not exists (select 1 from public.aso_signed_documents r
          where r.org_id = "aso_deliveries"."org_id" and r.replaces_id = "aso_deliveries"."signed_document_id")));--> statement-breakpoint
-- Custom: entrega do ASO só inclusão (sem UPDATE/DELETE para o app_runtime).
GRANT SELECT, INSERT ON public.aso_deliveries TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.aso_deliveries FROM app_runtime;