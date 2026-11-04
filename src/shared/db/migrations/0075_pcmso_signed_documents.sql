CREATE TABLE "pcmso_signed_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"preview_document_id" uuid NOT NULL,
	"preview_sha256" text NOT NULL,
	"exam_plan_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"signature_method" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_registration" text NOT NULL,
	"signer_uf" text NOT NULL,
	"signed_on" date NOT NULL,
	"verification_kind" text DEFAULT 'documentary' NOT NULL,
	"verification_reference" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"replaces_id" uuid,
	"change_kind" text,
	"replace_reason" text,
	"registered_by" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_pcmso_signed_origin" CHECK ("pcmso_signed_documents"."origin" in ('coordinator','office_received')),
	CONSTRAINT "ck_pcmso_signed_method" CHECK ("pcmso_signed_documents"."signature_method" in ('icp_brasil','electronic','handwritten')),
	CONSTRAINT "ck_pcmso_signed_verification_kind" CHECK ("pcmso_signed_documents"."verification_kind" = 'documentary'),
	CONSTRAINT "ck_pcmso_signed_verification" CHECK (char_length(btrim("pcmso_signed_documents"."verification_reference")) >= 5),
	CONSTRAINT "ck_pcmso_signed_uf" CHECK ("pcmso_signed_documents"."signer_uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_pcmso_signed_signer" CHECK (btrim("pcmso_signed_documents"."signer_name") <> '' and btrim("pcmso_signed_documents"."signer_registration") <> ''),
	CONSTRAINT "ck_pcmso_signed_hashes" CHECK ("pcmso_signed_documents"."file_sha256" ~ '^[0-9a-f]{64}$' and "pcmso_signed_documents"."preview_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_pcmso_signed_size" CHECK ("pcmso_signed_documents"."size_bytes" > 0),
	CONSTRAINT "ck_pcmso_signed_replace" CHECK (("pcmso_signed_documents"."replaces_id" is null) = ("pcmso_signed_documents"."replace_reason" is null)
        and ("pcmso_signed_documents"."replaces_id" is null) = ("pcmso_signed_documents"."change_kind" is null)
        and ("pcmso_signed_documents"."change_kind" is null or "pcmso_signed_documents"."change_kind" in ('administrative','documentary_update','clinical_revision','correction'))
        and ("pcmso_signed_documents"."replace_reason" is null or char_length(btrim("pcmso_signed_documents"."replace_reason")) >= 10)
        and ("pcmso_signed_documents"."replaces_id" is null or "pcmso_signed_documents"."replaces_id" <> "pcmso_signed_documents"."id"))
);
--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "pcmso_signed_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_id_scope" ON "pcmso_signed_documents" USING btree ("id","org_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_replaces" ON "pcmso_signed_documents" USING btree ("replaces_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_storage_path" ON "pcmso_signed_documents" USING btree ("storage_path");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_documents_id_scope" ON "pcmso_documents" USING btree ("id","org_id","company_id");--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_preview" FOREIGN KEY ("preview_document_id","org_id","company_id") REFERENCES "public"."pcmso_documents"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_plan" FOREIGN KEY ("exam_plan_id","org_id","company_id") REFERENCES "public"."medical_exam_plans"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_replaces" FOREIGN KEY ("replaces_id","org_id","company_id") REFERENCES "public"."pcmso_signed_documents"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_signed_company" ON "pcmso_signed_documents" USING btree ("org_id","company_id","registered_at");--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_isolation" ON "pcmso_signed_documents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_module_access" ON "pcmso_signed_documents" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_signed_documents"."org_id" and cm.company_id = "pcmso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_signed_documents"."org_id" and cm.company_id = "pcmso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_insert" ON "pcmso_signed_documents" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_signed_documents"."registered_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.pcmso_documents d where d.id = "pcmso_signed_documents"."preview_document_id" and d.org_id = "pcmso_signed_documents"."org_id"
          and d.company_id = "pcmso_signed_documents"."company_id" and d.content_sha256 = "pcmso_signed_documents"."preview_sha256" and d.exam_plan_id = "pcmso_signed_documents"."exam_plan_id")
        and exists (select 1 from public.medical_exam_plans p where p.id = "pcmso_signed_documents"."exam_plan_id" and p.org_id = "pcmso_signed_documents"."org_id"
          and p.company_id = "pcmso_signed_documents"."company_id" and p.status = 'approved')
        and exists (select 1 from public.pcmso_coordinator_assignments a join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id
          where a.org_id = "pcmso_signed_documents"."org_id" and a.company_id = "pcmso_signed_documents"."company_id" and a.ends_on is null
            and m.crm = "pcmso_signed_documents"."signer_registration" and m.registration_uf = "pcmso_signed_documents"."signer_uf"
            and ("pcmso_signed_documents"."origin" <> 'coordinator' or a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        and ("pcmso_signed_documents"."origin" <> 'office_received' or exists (select 1 from public.org_memberships om where om.org_id = "pcmso_signed_documents"."org_id"
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member'))));--> statement-breakpoint
-- Custom: PCMSO assinado só inclusão (sem UPDATE/DELETE para o app_runtime).
GRANT SELECT, INSERT ON public.pcmso_signed_documents TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_signed_documents FROM app_runtime;