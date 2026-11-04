CREATE TABLE "aso_signed_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"preview_document_id" uuid,
	"signature_method" text NOT NULL,
	"verification_reference" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_registration" text NOT NULL,
	"signer_uf" text NOT NULL,
	"conclusion" text NOT NULL,
	"signed_on" date NOT NULL,
	"storage_path" text NOT NULL,
	"file_sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"replaces_id" uuid,
	"replace_reason" text,
	"registered_by" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_aso_signed_origin" CHECK ("aso_signed_documents"."origin" in ('examiner','external_clinic')),
	CONSTRAINT "ck_aso_signed_preview" CHECK (("aso_signed_documents"."origin" = 'examiner') = ("aso_signed_documents"."preview_document_id" is not null)),
	CONSTRAINT "ck_aso_signed_method" CHECK ("aso_signed_documents"."signature_method" in ('icp_brasil','electronic','handwritten')),
	CONSTRAINT "ck_aso_signed_verification" CHECK (char_length(btrim("aso_signed_documents"."verification_reference")) >= 5),
	CONSTRAINT "ck_aso_signed_conclusion" CHECK ("aso_signed_documents"."conclusion" in ('fit','unfit')),
	CONSTRAINT "ck_aso_signed_uf" CHECK ("aso_signed_documents"."signer_uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_aso_signed_signer" CHECK (btrim("aso_signed_documents"."signer_name") <> '' and btrim("aso_signed_documents"."signer_registration") <> ''),
	CONSTRAINT "ck_aso_signed_hash" CHECK ("aso_signed_documents"."file_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_aso_signed_size" CHECK ("aso_signed_documents"."size_bytes" > 0),
	CONSTRAINT "ck_aso_signed_replace" CHECK (("aso_signed_documents"."replaces_id" is null) = ("aso_signed_documents"."replace_reason" is null) and ("aso_signed_documents"."replace_reason" is null or char_length(btrim("aso_signed_documents"."replace_reason")) >= 10)),
	CONSTRAINT "ck_aso_signed_not_self" CHECK ("aso_signed_documents"."replaces_id" is null or "aso_signed_documents"."replaces_id" <> "aso_signed_documents"."id")
);
--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ADD CONSTRAINT "aso_signed_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ADD CONSTRAINT "fk_aso_signed_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ADD CONSTRAINT "fk_aso_signed_exam" FOREIGN KEY ("health_exam_id","org_id","company_id") REFERENCES "public"."health_exams"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ADD CONSTRAINT "fk_aso_signed_preview" FOREIGN KEY ("preview_document_id") REFERENCES "public"."aso_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_signed_id_scope" ON "aso_signed_documents" USING btree ("id","org_id","health_exam_id");--> statement-breakpoint
ALTER TABLE "aso_signed_documents" ADD CONSTRAINT "fk_aso_signed_replaces" FOREIGN KEY ("replaces_id","org_id","health_exam_id") REFERENCES "public"."aso_signed_documents"("id","org_id","health_exam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_signed_replaces" ON "aso_signed_documents" USING btree ("replaces_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_signed_storage_path" ON "aso_signed_documents" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "idx_aso_signed_exam" ON "aso_signed_documents" USING btree ("org_id","health_exam_id","registered_at");--> statement-breakpoint
CREATE POLICY "aso_signed_documents_isolation" ON "aso_signed_documents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "aso_signed_documents_module_access" ON "aso_signed_documents" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "aso_signed_documents"."org_id" and cm.company_id = "aso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "aso_signed_documents"."org_id" and cm.company_id = "aso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "aso_signed_documents_insert" ON "aso_signed_documents" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("aso_signed_documents"."registered_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.health_exams h where h.id = "aso_signed_documents"."health_exam_id" and h.org_id = "aso_signed_documents"."org_id" and h.company_id = "aso_signed_documents"."company_id")
        and (
          ("aso_signed_documents"."origin" = 'examiner'
            and exists (select 1 from public.health_exams h join public.medicos m on m.id = h.doctor_id and m.org_id = h.org_id
              where h.id = "aso_signed_documents"."health_exam_id" and h.org_id = "aso_signed_documents"."org_id"
                and m.crm = "aso_signed_documents"."signer_registration" and m.registration_uf = "aso_signed_documents"."signer_uf"
                and h.doctor_id in (select public.actor_clinical_medico_ids(h.org_id)))
            and exists (select 1 from public.aso_documents d where d.id = "aso_signed_documents"."preview_document_id" and d.org_id = "aso_signed_documents"."org_id" and d.health_exam_id = "aso_signed_documents"."health_exam_id"))
          or ("aso_signed_documents"."origin" = 'external_clinic'
            and exists (select 1 from public.org_memberships om where om.org_id = "aso_signed_documents"."org_id"
              and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))
        ));--> statement-breakpoint
-- Custom: ASO assinado só inclusão (sem UPDATE/DELETE para o app_runtime).
GRANT SELECT, INSERT ON public.aso_signed_documents TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.aso_signed_documents FROM app_runtime;