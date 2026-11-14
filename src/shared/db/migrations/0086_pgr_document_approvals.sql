CREATE TABLE "pgr_document_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "pgr_document_approvals_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"assignment_id" uuid,
	"decision_id" uuid,
	"supersedes_issue_id" uuid,
	"cancelled_issue_id" uuid,
	"author_user_id" text,
	"reviewer_user_id" text,
	"reviewer_identity" jsonb,
	"snapshot_sha256" text,
	"template_sha256" text,
	"file_sha256" text,
	"document_id" uuid,
	"snapshot" jsonb,
	"actor" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pgr_document_approval_context" UNIQUE("id","org_id","pgr_id"),
	CONSTRAINT "pgr_document_approvals_kind" CHECK ("pgr_document_approvals"."kind" in ('required','assigned','revoked','approved','rejected','issued','issue_cancelled')),
	CONSTRAINT "pgr_document_approvals_separate" CHECK ("pgr_document_approvals"."author_user_id" <> "pgr_document_approvals"."reviewer_user_id"),
	CONSTRAINT "pgr_document_approvals_shape" CHECK (case "pgr_document_approvals"."kind"
          when 'required' then "pgr_document_approvals"."reason" is not null
          when 'assigned' then "pgr_document_approvals"."author_user_id" is not null and "pgr_document_approvals"."reviewer_user_id" is not null and "pgr_document_approvals"."reviewer_identity" is not null and "pgr_document_approvals"."reason" is not null
          when 'revoked' then "pgr_document_approvals"."assignment_id" is not null and "pgr_document_approvals"."reason" is not null
          when 'approved' then "pgr_document_approvals"."assignment_id" is not null and "pgr_document_approvals"."author_user_id" is not null and "pgr_document_approvals"."reviewer_user_id" is not null and "pgr_document_approvals"."snapshot_sha256" is not null and "pgr_document_approvals"."template_sha256" is not null
          when 'rejected' then "pgr_document_approvals"."assignment_id" is not null and "pgr_document_approvals"."author_user_id" is not null and "pgr_document_approvals"."reviewer_user_id" is not null and "pgr_document_approvals"."snapshot_sha256" is not null and "pgr_document_approvals"."template_sha256" is not null and "pgr_document_approvals"."reason" is not null
          when 'issued' then "pgr_document_approvals"."assignment_id" is not null and "pgr_document_approvals"."decision_id" is not null and "pgr_document_approvals"."document_id" is not null and "pgr_document_approvals"."file_sha256" is not null and "pgr_document_approvals"."snapshot_sha256" is not null and "pgr_document_approvals"."template_sha256" is not null and "pgr_document_approvals"."snapshot" is not null
          when 'issue_cancelled' then "pgr_document_approvals"."cancelled_issue_id" is not null and "pgr_document_approvals"."reason" is not null
        end)
);
--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_assignment_fk" FOREIGN KEY ("assignment_id","org_id","pgr_id") REFERENCES "public"."pgr_document_approvals"("id","org_id","pgr_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_decision_fk" FOREIGN KEY ("decision_id","org_id","pgr_id") REFERENCES "public"."pgr_document_approvals"("id","org_id","pgr_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_supersedes_fk" FOREIGN KEY ("supersedes_issue_id","org_id","pgr_id") REFERENCES "public"."pgr_document_approvals"("id","org_id","pgr_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_cancelled_fk" FOREIGN KEY ("cancelled_issue_id","org_id","pgr_id") REFERENCES "public"."pgr_document_approvals"("id","org_id","pgr_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pgr_document_approvals" ON "pgr_document_approvals" USING btree ("org_id","pgr_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pgr_document_approval_requirement" ON "pgr_document_approvals" USING btree ("org_id","pgr_id") WHERE "pgr_document_approvals"."kind"='required';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pgr_document_approval_cancellation" ON "pgr_document_approvals" USING btree ("cancelled_issue_id") WHERE "pgr_document_approvals"."kind"='issue_cancelled';--> statement-breakpoint
CREATE POLICY "pgr_document_approvals_tenant" ON "pgr_document_approvals" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "pgr_document_approvals_context" ON "pgr_document_approvals" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id")) WITH CHECK (exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id"));--> statement-breakpoint
CREATE POLICY "pgr_document_approvals_actor" ON "pgr_document_approvals" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pgr_document_approvals"."actor"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "pgr_document_approvals_rule" ON "pgr_document_approvals" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (case
          when "pgr_document_approvals"."kind" in ('required','revoked','issue_cancelled') then exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))
          when "pgr_document_approvals"."kind"='assigned' then exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and exists(select 1 from public.org_memberships m where m.org_id="pgr_document_approvals"."org_id" and m.user_id="pgr_document_approvals"."reviewer_user_id" and m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null) and exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id" and (p.created_by is null or p.created_by="pgr_document_approvals"."author_user_id"))
          when "pgr_document_approvals"."kind" in ('approved','rejected') then "pgr_document_approvals"."actor"="pgr_document_approvals"."reviewer_user_id" and exists(select 1 from public.org_memberships m where m.org_id="pgr_document_approvals"."org_id" and m.user_id="pgr_document_approvals"."reviewer_user_id" and m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null) and exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id" and p.created_by is distinct from "pgr_document_approvals"."actor" and (p.created_by is null or p.created_by="pgr_document_approvals"."author_user_id"))
          when "pgr_document_approvals"."kind"='issued' then exists(select 1 from public.org_memberships m where m.org_id="pgr_document_approvals"."org_id" and m.user_id="pgr_document_approvals"."actor" and m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null) and exists(select 1 from public.documents doc where doc.id="pgr_document_approvals"."document_id" and doc.org_id="pgr_document_approvals"."org_id" and doc.related_entity_type='pgr' and doc.related_entity_id="pgr_document_approvals"."pgr_id")
          else false
        end);--> statement-breakpoint
GRANT SELECT, INSERT ON public.pgr_document_approvals TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pgr_document_approvals FROM app_runtime;
--> statement-breakpoint
CREATE FUNCTION public.enforce_pgr_document_approval_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  current_assignment public.pgr_document_approvals%ROWTYPE;
  broken boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.pgr_id::text, 179));
  SELECT a.* INTO current_assignment FROM public.pgr_document_approvals a
    WHERE a.org_id = NEW.org_id AND a.pgr_id = NEW.pgr_id AND a.kind IN ('assigned', 'revoked')
    ORDER BY a.seq DESC LIMIT 1;
  broken := CASE
    WHEN NEW.kind = 'required' THEN false
    WHEN NEW.kind = 'assigned' THEN NOT EXISTS (
      SELECT 1 FROM public.pgr_document_approvals a
      WHERE a.org_id = NEW.org_id AND a.pgr_id = NEW.pgr_id AND a.kind = 'required')
    WHEN NEW.kind = 'issue_cancelled' THEN NOT EXISTS (
      SELECT 1 FROM public.pgr_document_approvals a
      WHERE a.id = NEW.cancelled_issue_id AND a.kind = 'issued')
    WHEN current_assignment.kind IS DISTINCT FROM 'assigned'
      OR current_assignment.id IS DISTINCT FROM NEW.assignment_id THEN true
    WHEN NEW.kind IN ('approved', 'rejected') THEN
      current_assignment.author_user_id IS DISTINCT FROM NEW.author_user_id
      OR current_assignment.reviewer_user_id IS DISTINCT FROM NEW.reviewer_user_id
    WHEN NEW.kind = 'issued' THEN NOT EXISTS (
      SELECT 1 FROM public.pgr_document_approvals d
      WHERE d.id = NEW.decision_id AND d.kind = 'approved'
        AND d.assignment_id = NEW.assignment_id
        AND d.snapshot_sha256 = NEW.snapshot_sha256
        AND d.template_sha256 = NEW.template_sha256
        AND d.seq = (
          SELECT max(x.seq) FROM public.pgr_document_approvals x
          WHERE x.assignment_id = NEW.assignment_id AND x.kind IN ('approved', 'rejected')))
    ELSE false
  END;
  IF broken THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'A revisao deste PGR mudou ou o registro nao corresponde ao revisor designado.';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enforce_pgr_document_approval_chain() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER enforce_pgr_document_approval_chain BEFORE INSERT ON public.pgr_document_approvals
FOR EACH ROW EXECUTE FUNCTION public.enforce_pgr_document_approval_chain();
